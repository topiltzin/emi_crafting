import { getSupabaseClient, getOwnerId } from './supabase-client.js';
import { buildOriginalPhotoPath, buildThumbnailPhotoPath, PHOTOS_BUCKET } from './photo-storage-path.js';
import { resolvePhotoUrl, resolvePhotoUrls } from './photo-url.js';
import { validationError, throwClassified } from './supabase-errors.js';

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

  return data;
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

  return data;
}

export async function getAlbum(albumId) {
  const { data, error } = await getSupabaseClient()
    .from('albums')
    .select('*')
    .eq('id', albumId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throwClassified(error, 'Failed to load album');
  return data;
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

  const urls = await signPaths([...coverByAlbum.values()], 'Failed to resolve album cover image');
  return albums.map((album) => ({
    ...album,
    cover_thumbnail_url: urls.get(coverByAlbum.get(album.id)) || null
  }));
}

// Lean lookups for upload/create paths: no cover query, no signed URLs.
export async function getAlbumByDate(albumDate) {
  const { data, error } = await getSupabaseClient()
    .from('albums')
    .select('*')
    .eq('owner_id', getOwnerId())
    .eq('album_date', albumDate)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throwClassified(error, 'Failed to load album');
  return data;
}

export async function getAlbumDates() {
  const { data, error } = await getSupabaseClient()
    .from('albums')
    .select('album_date')
    .eq('owner_id', getOwnerId())
    .is('deleted_at', null);

  if (error) throwClassified(error, 'Failed to load albums');
  return (data || []).map((a) => a.album_date);
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
    .select('id, position')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('position', { ascending: true, nullsFirst: false })
    .order('album_date', { ascending: false });

  if (error) throwClassified(error, 'Failed to load albums');

  const albumIds = (albums || []).map((a) => a.id);
  const positionById = new Map((albums || []).map((a) => [a.id, a.position]));
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

  // Only rows whose position actually changed are written, and those writes run concurrently —
  // a drag across a few slots touches a few rows instead of serially rewriting every album.
  const now = new Date().toISOString();
  const results = await Promise.all(
    albumIds
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => positionById.get(id) !== index)
      .map(({ id, index }) =>
        client.from('albums').update({ position: index, updated_at: now }).eq('id', id)
      )
  );
  const failed = results.find((result) => result.error);
  if (failed) throwClassified(failed.error, 'Failed to reorder albums');
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

// Resolves a photo's original, full-resolution image on demand — deliberately not called from
// toPhoto() (which every list/get call already funnels through), since eagerly resolving a
// second signed URL per photo would double Storage calls on every gallery/album load.
export async function getPhotoOriginalUrl(storagePath) {
  try {
    return await resolvePhotoUrl(storagePath);
  } catch (error) {
    throwClassified(error, 'Failed to load photo');
  }
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

  return withThumbnailUrls(data);
}

export async function getAllPhotos({
  favoritesOnly = false,
  tutorialChannelId = null,
  offset = 0,
  limit = 50
} = {}) {
  const ownerId = getOwnerId();
  const client = getSupabaseClient();

  let query = client.from('photos').select('*').eq('owner_id', ownerId).is('deleted_at', null);
  if (favoritesOnly) {
    query = query.eq('is_favorite', true);
  }
  if (tutorialChannelId) {
    query = query.eq('tutorial_link->>channelId', tutorialChannelId);
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
  const visiblePhotos = await withThumbnailUrls(photos.filter((p) => albumById.has(p.album_id)));

  for (const photo of visiblePhotos) {
    const album = albumById.get(photo.album_id);
    photo.album_date = album.album_date;
    photo.album_title = album.title;
  }
  return visiblePhotos;
}

// Head-only count: no rows transferred, no URLs signed.
export async function countPhotos() {
  const { count, error } = await getSupabaseClient()
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', getOwnerId())
    .is('deleted_at', null);

  if (error) throwClassified(error, 'Failed to count photos');
  return count || 0;
}

// Just the tutorial_link column of linked photos — enough to aggregate creators without
// loading every photo row and signing every thumbnail.
export async function getTutorialLinks() {
  const { data, error } = await getSupabaseClient()
    .from('photos')
    .select('tutorial_link')
    .eq('owner_id', getOwnerId())
    .is('deleted_at', null)
    .not('tutorial_link', 'is', null);

  if (error) throwClassified(error, 'Failed to load tutorial links');
  return (data || []).map((row) => row.tutorial_link);
}

export async function deletePhoto(photoId, hard = false) {
  const client = getSupabaseClient();

  const photo = await getPhotoRow(photoId, 'album_id, storage_path, thumbnail_storage_path');

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

export async function updatePhotoTutorialLink(photoId, tutorialLink) {
  const client = getSupabaseClient();

  await getPhotoRow(photoId, 'id');

  const { data, error } = await client
    .from('photos')
    .update({ tutorial_link: tutorialLink, updated_at: new Date().toISOString() })
    .eq('id', photoId)
    .select()
    .single();
  if (error) throwClassified(error, 'Failed to save tutorial link');

  return toPhoto(data);
}

export async function removePhotoTutorialLink(photoId) {
  return updatePhotoTutorialLink(photoId, null);
}

export async function toggleFavorite(photoId) {
  const client = getSupabaseClient();

  const photo = await getPhotoRow(photoId, 'is_favorite');

  const { data, error } = await client
    .from('photos')
    .update({ is_favorite: !photo.is_favorite, updated_at: new Date().toISOString() })
    .eq('id', photoId)
    .select()
    .single();
  if (error) throwClassified(error, 'Failed to update favorite');

  return toPhoto(data);
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

// Existence check + the few columns a mutation needs, without signing a thumbnail URL.
async function getPhotoRow(photoId, columns) {
  const { data, error } = await getSupabaseClient()
    .from('photos')
    .select(columns)
    .eq('id', photoId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throwClassified(error, 'Failed to load photo');
  if (!data) throw validationError('Photo not found');
  return data;
}

async function signPaths(paths, contextMessage) {
  try {
    return await resolvePhotoUrls(paths);
  } catch (error) {
    throwClassified(error, contextMessage);
  }
}

async function withThumbnailUrls(rows) {
  const urls = await signPaths(
    rows.map((row) => row.thumbnail_storage_path),
    'Failed to resolve photo thumbnail'
  );
  return rows.map((row) => ({ ...row, thumbnail_url: urls.get(row.thumbnail_storage_path) || null }));
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
