import { getSupabaseClient, getOwnerId } from './supabase-client.js';
import { buildOriginalPhotoPath, buildThumbnailPhotoPath, PHOTOS_BUCKET } from './photo-storage-path.js';
import { resolvePhotoUrl } from './photo-url.js';
import { classifySupabaseError, validationError, throwClassified } from './supabase-errors.js';

const ALBUM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function initDB() {
  // Session establishment happens in app.js (getSession()/signInOwner()) before initDB() is
  // called; this just fails fast if that invariant is somehow violated.
  getSupabaseClient();
  getOwnerId();

  // Dynamic import avoids a circular dependency: migration.js needs this module's Album/Photo
  // CRUD to write into Supabase.
  const { getMigrationStatus, runMigration } = await import('./migration.js');
  if (getMigrationStatus() === 'completed') {
    return null;
  }
  return runMigration();
}

// ----- Albums -----

export async function createAlbum(albumDate, title = null) {
  if (!ALBUM_DATE_PATTERN.test(albumDate)) {
    throw validationError('album_date must be ISO 8601 format (YYYY-MM-DD)');
  }
  if (title && title.length > 255) {
    throw validationError('title must be max 255 characters');
  }

  const ownerId = getOwnerId();
  const { data, error } = await getSupabaseClient()
    .from('albums')
    .insert({ owner_id: ownerId, album_date: albumDate, title: title || null })
    .select()
    .single();

  if (error) throwClassified(error, 'Failed to create album');

  return toAlbum(data);
}

export async function updateAlbum(albumId, { title } = {}) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) {
    throw validationError('title is required and must not be blank');
  }
  if (trimmed.length > 255) {
    throw validationError('title must be max 255 characters');
  }

  const { data, error } = await getSupabaseClient()
    .from('albums')
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq('id', albumId)
    .select()
    .single();

  if (error) throwClassified(error, 'Failed to rename album');

  return toAlbum(data);
}

export async function getAlbum(albumId) {
  const { data, error } = await getSupabaseClient()
    .from('albums')
    .select('*')
    .eq('id', albumId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throwClassified(error, 'Failed to load album');
  return data ? toAlbum(data) : null;
}

export async function getAlbums(sortByCustom = true) {
  const ownerId = getOwnerId();
  const client = getSupabaseClient();

  let query = client.from('albums').select('*').eq('owner_id', ownerId).is('deleted_at', null);

  query = sortByCustom
    ? query
        .order('position', { ascending: true, nullsFirst: false })
        .order('album_date', { ascending: false })
    : query.order('album_date', { ascending: false });

  const { data: albums, error } = await query;
  if (error) throwClassified(error, 'Failed to load albums');
  if (!albums || albums.length === 0) return [];

  // Cover thumbnail: the most recently uploaded, non-deleted photo per album.
  const { data: coverPhotos, error: coverError } = await client
    .from('photos')
    .select('album_id, thumbnail_storage_path, upload_date')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .in(
      'album_id',
      albums.map((a) => a.id)
    )
    .order('upload_date', { ascending: false });

  if (coverError) throwClassified(coverError, 'Failed to load album covers');

  const coverByAlbum = new Map();
  for (const photo of coverPhotos || []) {
    if (!coverByAlbum.has(photo.album_id)) {
      coverByAlbum.set(photo.album_id, photo.thumbnail_storage_path);
    }
  }

  return Promise.all(
    albums.map((album) => toAlbum(album, { coverThumbnailPath: coverByAlbum.get(album.id) || null }))
  );
}

export async function deleteAlbum(albumId, hard = false) {
  const client = getSupabaseClient();

  const album = await getAlbum(albumId);
  if (!album) throw validationError('Album not found');

  if (hard) {
    const { data: photos, error: photosError } = await client
      .from('photos')
      .select('id, storage_path, thumbnail_storage_path')
      .eq('album_id', albumId);
    if (photosError) throwClassified(photosError, 'Failed to load photos for album deletion');

    const paths = [];
    for (const photo of photos || []) {
      if (photo.storage_path) paths.push(photo.storage_path);
      if (photo.thumbnail_storage_path) paths.push(photo.thumbnail_storage_path);
    }
    if (paths.length > 0) {
      const { error: removeError } = await client.storage.from(PHOTOS_BUCKET).remove(paths);
      if (removeError) throwClassified(removeError, 'Failed to delete photo files');
    }

    const { error: deletePhotosError } = await client
      .from('photos')
      .delete()
      .eq('album_id', albumId);
    if (deletePhotosError) throwClassified(deletePhotosError, 'Failed to delete photos');

    const { error: deleteAlbumError } = await client.from('albums').delete().eq('id', albumId);
    if (deleteAlbumError) throwClassified(deleteAlbumError, 'Failed to delete album');
  } else {
    const now = new Date().toISOString();

    const { error: softDeletePhotosError } = await client
      .from('photos')
      .update({ deleted_at: now })
      .eq('album_id', albumId);
    if (softDeletePhotosError) throwClassified(softDeletePhotosError, 'Failed to delete photos');

    const { error: softDeleteAlbumError } = await client
      .from('albums')
      .update({ deleted_at: now })
      .eq('id', albumId);
    if (softDeleteAlbumError) throwClassified(softDeleteAlbumError, 'Failed to delete album');
  }
}

export async function updateAlbumOrder(albumId, newPosition) {
  const ownerId = getOwnerId();
  const client = getSupabaseClient();

  const { data: albums, error } = await client
    .from('albums')
    .select('id')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('position', { ascending: true, nullsFirst: false })
    .order('album_date', { ascending: false });

  if (error) throwClassified(error, 'Failed to load albums');

  const albumIds = (albums || []).map((a) => a.id);
  const total = albumIds.length;

  if (newPosition < 0 || newPosition >= total) {
    throw validationError(`Invalid position. Must be between 0 and ${total - 1}`);
  }

  const currentPosition = albumIds.indexOf(albumId);
  if (currentPosition === -1) {
    throw validationError('Album not found');
  }

  albumIds.splice(currentPosition, 1);
  albumIds.splice(newPosition, 0, albumId);

  const now = new Date().toISOString();
  for (let i = 0; i < albumIds.length; i++) {
    const { error: updateError } = await client
      .from('albums')
      .update({ position: i, updated_at: now })
      .eq('id', albumIds[i]);
    if (updateError) throwClassified(updateError, 'Failed to reorder albums');
  }
}

// ----- Photos -----

export async function createPhoto(albumId, photoData) {
  const filename = photoData.filename;
  const fileSize = photoData.file_size;
  const mimeType = photoData.mime_type;
  const photoBase64 = photoData.photo_data_base64;
  const thumbnailBase64 = photoData.thumbnail_base64;

  if (!filename || filename.length > 255) {
    throw validationError('filename is required and must be max 255 characters');
  }
  if (!fileSize || fileSize <= 0) {
    throw validationError('file_size must be > 0');
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw validationError(`Unsupported file type: ${mimeType}`);
  }
  if (!photoBase64) {
    throw validationError('photo_data_base64 is required');
  }

  const ownerId = getOwnerId();
  const client = getSupabaseClient();
  const photoId = crypto.randomUUID();

  const originalPath = buildOriginalPhotoPath(ownerId, photoId);
  const thumbnailPath = thumbnailBase64 ? buildThumbnailPhotoPath(ownerId, photoId) : null;

  // Upload binaries FIRST — a photo row must never exist without its file already saved (FR-008).
  const { error: uploadError } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(originalPath, base64ToUint8Array(photoBase64), { contentType: mimeType, upsert: false });
  if (uploadError) throwClassified(uploadError, 'Failed to upload photo');

  if (thumbnailPath) {
    const { error: thumbnailUploadError } = await client.storage
      .from(PHOTOS_BUCKET)
      .upload(thumbnailPath, base64ToUint8Array(thumbnailBase64), {
        contentType: 'image/jpeg',
        upsert: false
      });
    if (thumbnailUploadError) throwClassified(thumbnailUploadError, 'Failed to upload thumbnail');
  }

  const { data: inserted, error: insertError } = await client
    .from('photos')
    .insert({
      id: photoId,
      owner_id: ownerId,
      album_id: albumId,
      filename,
      file_size: fileSize,
      mime_type: mimeType,
      photo_date: photoData.photo_date || null,
      storage_path: originalPath,
      thumbnail_storage_path: thumbnailPath,
      exif_json: photoData.exif_json || null
    })
    .select()
    .single();

  if (insertError) throwClassified(insertError, 'Failed to save photo');

  await incrementAlbumPhotoCount(client, albumId, 1);

  return toPhoto(inserted);
}

export async function getPhoto(photoId) {
  const { data, error } = await getSupabaseClient()
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throwClassified(error, 'Failed to load photo');
  return data ? toPhoto(data) : null;
}

export async function getPhotos(albumId, offset = 0, limit = 50) {
  const { data, error } = await getSupabaseClient()
    .from('photos')
    .select('*')
    .eq('album_id', albumId)
    .is('deleted_at', null)
    .order('upload_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throwClassified(error, 'Failed to load photos');
  if (!data || data.length === 0) return [];

  return Promise.all(data.map((row) => toPhoto(row)));
}

export async function getAllPhotos({ favoritesOnly = false, offset = 0, limit = 50 } = {}) {
  const ownerId = getOwnerId();
  const client = getSupabaseClient();

  let query = client.from('photos').select('*').eq('owner_id', ownerId).is('deleted_at', null);
  if (favoritesOnly) {
    query = query.eq('is_favorite', true);
  }

  query = query
    .order('photo_date', { ascending: false, nullsFirst: false })
    .order('upload_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: photos, error } = await query;
  if (error) throwClassified(error, 'Failed to load photos');
  if (!photos || photos.length === 0) return [];

  const albumIds = [...new Set(photos.map((p) => p.album_id))];
  const { data: albums, error: albumsError } = await client
    .from('albums')
    .select('id, album_date, title')
    .in('id', albumIds)
    .is('deleted_at', null);
  if (albumsError) throwClassified(albumsError, 'Failed to load albums for photos');

  const albumById = new Map((albums || []).map((a) => [a.id, a]));
  const visiblePhotos = photos.filter((p) => albumById.has(p.album_id));

  return Promise.all(
    visiblePhotos.map(async (row) => {
      const album = albumById.get(row.album_id);
      const photo = await toPhoto(row);
      photo.album_date = album.album_date;
      photo.album_title = album.title;
      return photo;
    })
  );
}

export async function deletePhoto(photoId, hard = false) {
  const client = getSupabaseClient();

  const photo = await getPhoto(photoId);
  if (!photo) throw validationError('Photo not found');

  if (hard) {
    const paths = [photo.storage_path, photo.thumbnail_storage_path].filter(Boolean);
    if (paths.length > 0) {
      const { error: removeError } = await client.storage.from(PHOTOS_BUCKET).remove(paths);
      if (removeError) throwClassified(removeError, 'Failed to delete photo file');
    }

    const { error: deleteError } = await client.from('photos').delete().eq('id', photoId);
    if (deleteError) throwClassified(deleteError, 'Failed to delete photo');
  } else {
    const { error: updateError } = await client
      .from('photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photoId);
    if (updateError) throwClassified(updateError, 'Failed to delete photo');
  }

  await incrementAlbumPhotoCount(client, photo.album_id, -1);
}

export async function toggleFavorite(photoId) {
  const client = getSupabaseClient();

  const photo = await getPhoto(photoId);
  if (!photo) throw validationError('Photo not found');

  const { error } = await client
    .from('photos')
    .update({ is_favorite: !photo.is_favorite, updated_at: new Date().toISOString() })
    .eq('id', photoId);
  if (error) throwClassified(error, 'Failed to update favorite');

  return getPhoto(photoId);
}

// ----- Helpers -----

async function incrementAlbumPhotoCount(client, albumId, delta) {
  const { data: album, error: fetchError } = await client
    .from('albums')
    .select('photo_count')
    .eq('id', albumId)
    .single();
  if (fetchError) throwClassified(fetchError, 'Failed to update album photo count');

  const { error: updateError } = await client
    .from('albums')
    .update({
      photo_count: Math.max(0, (album.photo_count || 0) + delta),
      updated_at: new Date().toISOString()
    })
    .eq('id', albumId);
  if (updateError) throwClassified(updateError, 'Failed to update album photo count');
}

function base64ToUint8Array(base64) {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function toAlbum(row, { coverThumbnailPath } = {}) {
  const album = { ...row };
  if (coverThumbnailPath !== undefined) {
    try {
      album.cover_thumbnail_url = coverThumbnailPath ? await resolvePhotoUrl(coverThumbnailPath) : null;
    } catch (error) {
      throwClassified(error, 'Failed to resolve album cover image');
    }
  }
  return album;
}

async function toPhoto(row) {
  const photo = { ...row };
  try {
    photo.thumbnail_url = row.thumbnail_storage_path
      ? await resolvePhotoUrl(row.thumbnail_storage_path)
      : null;
  } catch (error) {
    throwClassified(error, 'Failed to resolve photo thumbnail');
  }
  return photo;
}

// Re-exported so callers that only need error classification (e.g. app.js) don't need a
// separate import of supabase-errors.js.
export { classifySupabaseError };
