import { getSupabaseClient } from './supabase-client.js';
import { PHOTOS_BUCKET } from './photo-storage-path.js';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — re-resolved on every db.js read, so short-lived is fine.

// Resolves a Storage object path (from photos.storage_path / photos.thumbnail_storage_path)
// to a displayable URL. The `photos` bucket is private, so a signed URL is required.
export async function resolvePhotoUrl(storagePath) {
  if (!storagePath) return null;

  const { data, error } = await getSupabaseClient()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}

// Batch form of resolvePhotoUrl: one Storage round-trip for a whole gallery/album page instead of
// one per photo. Returns a Map of path → signed URL; null/empty paths are skipped.
export async function resolvePhotoUrls(storagePaths) {
  const paths = [...new Set(storagePaths.filter(Boolean))];
  if (paths.length === 0) return new Map();

  const { data, error } = await getSupabaseClient()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;

  const urls = new Map();
  for (const entry of data) {
    if (entry.error) throw new Error(entry.error);
    urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
