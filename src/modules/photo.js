import { createPhoto } from './db.js';
import {
  readExifHeader,
  decodeImage,
  createThumbnailBlob,
  prepareOriginal,
  validateFileSize,
  getMimeType,
  isHeic
} from './storage.js';
import { getPhotoMetadata } from './exif.js';
import { createAlbumIfNeeded } from './album.js';

// A few uploads in flight at once hides per-request latency without saturating a phone's uplink.
const UPLOAD_CONCURRENCY = 3;

export async function uploadPhotos(files, albumId = null, { onProgress } = {}) {
  const list = Array.from(files);
  const results = new Array(list.length);

  // Photos from the same day upload concurrently; they must share one album lookup/creation or
  // two of them would both try to create it and collide on the (owner, album_date) constraint.
  const albumIdsByDate = new Map();
  const resolveAlbumId = (photoDate) => {
    if (!albumIdsByDate.has(photoDate)) {
      const pending = createAlbumIfNeeded(photoDate).then(({ album }) => album.id);
      pending.catch(() => albumIdsByDate.delete(photoDate));
      albumIdsByDate.set(photoDate, pending);
    }
    return albumIdsByDate.get(photoDate);
  };

  let nextIndex = 0;
  let completed = 0;
  async function runWorker() {
    while (nextIndex < list.length) {
      const index = nextIndex++;
      const file = list[index];
      try {
        results[index] = { photo: await addPhoto(albumId, file, { resolveAlbumId }) };
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        results[index] = { error: { filename: file.name, error: error.message } };
      }
      completed += 1;
      if (onProgress) onProgress(completed, list.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, list.length) }, runWorker));

  return {
    uploaded: results.filter((r) => r.photo).map((r) => r.photo),
    errors: results.filter((r) => r.error).map((r) => r.error)
  };
}

export async function addPhoto(albumIdOrNull, file, { resolveAlbumId } = {}) {
  let image = null;
  try {
    validateFileSize(file);

    const source = await loadUploadSource(file);
    image = source.image;

    // Read before any re-encode: the canvas output carries no EXIF.
    const exifHeader = source.converted ? null : await readExifHeader(file);
    const { photoDate, exifData } = getPhotoMetadata(file, exifHeader);

    let albumId = albumIdOrNull;
    if (!albumId) {
      albumId = resolveAlbumId
        ? await resolveAlbumId(photoDate)
        : (await createAlbumIfNeeded(photoDate)).album.id;
    }

    const original = await prepareOriginal(source.blob, image, source.mimeType);
    const thumbnail = await createThumbnailBlob(image);

    return await createPhoto(albumId, {
      filename: source.converted ? file.name.replace(/\.hei[cf]$/i, '.jpg') : file.name,
      file_size: original.blob.size,
      mime_type: original.mimeType,
      photo_date: photoDate,
      photo_blob: original.blob,
      thumbnail_blob: thumbnail,
      exif_json: exifData
    });
  } catch (error) {
    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  } finally {
    if (image) image.release();
  }
}

// Decoded image plus the Blob/type to store. HEIC (iPhone photos) is stored as JPEG: Safari
// decodes it natively, other browsers get it converted by the lazily-loaded heic-to (libheif).
async function loadUploadSource(file) {
  if (!isHeic(file)) {
    const mimeType = getMimeType(file);
    return { blob: file, mimeType, image: await decodeImage(file), converted: false };
  }

  try {
    return { blob: file, mimeType: 'image/jpeg', image: await decodeImage(file), converted: true };
  } catch {
    // Not natively decodable — fall through to the converter.
  }

  try {
    const { heicTo } = await import('heic-to');
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
    return { blob: jpeg, mimeType: 'image/jpeg', image: await decodeImage(jpeg), converted: true };
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error(
      "this iPhone photo (HEIC) couldn't be converted — try exporting it as JPEG first"
    );
  }
}
