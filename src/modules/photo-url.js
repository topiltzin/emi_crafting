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
