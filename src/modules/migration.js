// One-time, resumable migration of pre-existing local albums/photos into Supabase.
// See specs/004-supabase-data-migration/research.md §3 and data-model.md.
import { hasLegacyLocalData, readLegacyAlbumsAndPhotos } from './legacy-local-db.js';
import {
  getMigrationStatus as getLedgerStatus,
  setMigrationStatus,
  isPhotoMigrated,
  recordMigratedPhoto,
  buildLocalPhotoKey
} from './migration-ledger.js';

export function getMigrationStatus() {
  return getLedgerStatus();
}

export async function runMigration(onProgress) {
  if (getLedgerStatus() === 'completed') {
    return { migrated: 0, alreadyDone: 0, failed: 0 };
  }

  // db.js is imported dynamically to avoid a circular import: db.js's initDB() calls
  // runMigration(), and runMigration() needs db.js's Album/Photo CRUD.
  const { createAlbum, getAlbums, getPhotos, createPhoto } = await import('./db.js');

  if (!(await hasLegacyLocalData())) {
    setMigrationStatus('completed');
    return { migrated: 0, alreadyDone: 0, failed: 0 };
  }

  setMigrationStatus('in_progress');

  const { albums: legacyAlbums, photos: legacyPhotos } = await readLegacyAlbumsAndPhotos();
  const legacyAlbumById = new Map(legacyAlbums.map((album) => [album.id, album]));

  const cloudAlbumsByDate = new Map((await getAlbums(false)).map((album) => [album.album_date, album]));
  const cloudPhotoKeysByAlbum = new Map();

  async function getCloudPhotoKeys(albumId) {
    if (!cloudPhotoKeysByAlbum.has(albumId)) {
      const photos = await getPhotos(albumId, 0, 10000);
      cloudPhotoKeysByAlbum.set(albumId, new Set(photos.map((p) => `${p.filename}:${p.file_size}`)));
    }
    return cloudPhotoKeysByAlbum.get(albumId);
  }

  let migrated = 0;
  let alreadyDone = 0;
  let failed = 0;
  let done = 0;
  const total = legacyPhotos.length;

  function reportProgress() {
    done += 1;
    if (typeof onProgress === 'function') onProgress(done, total);
  }

  for (const legacyPhoto of legacyPhotos) {
    const legacyAlbum = legacyAlbumById.get(legacyPhoto.album_id);
    if (!legacyAlbum) {
      failed += 1;
      reportProgress();
      continue;
    }

    const localKey = buildLocalPhotoKey(legacyAlbum.album_date, legacyPhoto.filename, legacyPhoto.upload_date);

    if (isPhotoMigrated(localKey)) {
      alreadyDone += 1;
      reportProgress();
      continue;
    }

    try {
      let cloudAlbum = cloudAlbumsByDate.get(legacyAlbum.album_date);
      if (!cloudAlbum) {
        cloudAlbum = await createAlbum(legacyAlbum.album_date, legacyAlbum.title || null);
        cloudAlbumsByDate.set(legacyAlbum.album_date, cloudAlbum);
      }

      // Guards against the narrow crash window between a photo successfully uploading/inserting
      // and its ledger entry being written: if the cloud album already has a photo with this
      // filename+size, treat it as already migrated instead of uploading a duplicate (FR-010).
      const cloudKeys = await getCloudPhotoKeys(cloudAlbum.id);
      const photoKey = `${legacyPhoto.filename}:${legacyPhoto.file_size}`;

      if (cloudKeys.has(photoKey)) {
        recordMigratedPhoto(localKey, null);
        alreadyDone += 1;
        reportProgress();
        continue;
      }

      const cloudPhoto = await createPhoto(cloudAlbum.id, {
        filename: legacyPhoto.filename,
        file_size: legacyPhoto.file_size,
        mime_type: legacyPhoto.mime_type,
        photo_date: legacyPhoto.photo_date,
        photo_data_base64: legacyPhoto.photo_data_base64,
        thumbnail_base64: legacyPhoto.thumbnail_base64,
        exif_json: legacyPhoto.exif_json ? JSON.parse(legacyPhoto.exif_json) : null
      });

      cloudKeys.add(photoKey);
      recordMigratedPhoto(localKey, cloudPhoto.id);
      migrated += 1;
    } catch {
      // Local data is never touched on failure (FR-005/FR-006) — just count it and move on so
      // one bad photo doesn't block the rest of the migration.
      failed += 1;
    }

    reportProgress();
  }

  if (failed === 0) {
    setMigrationStatus('completed');
  }

  return { migrated, alreadyDone, failed };
}
