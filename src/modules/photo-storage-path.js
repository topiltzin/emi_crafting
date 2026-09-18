// Builds Supabase Storage object paths for a photo's original file and thumbnail.
// The first path segment MUST be the owner's uid — the Storage RLS policies in
// supabase/schema.sql grant access only when `(storage.foldername(name))[1] = auth.uid()::text`.

export const PHOTOS_BUCKET = 'photos';

export function buildOriginalPhotoPath(ownerId, photoId) {
  return `${ownerId}/${photoId}/original`;
}

export function buildThumbnailPhotoPath(ownerId, photoId) {
  return `${ownerId}/${photoId}/thumb`;
}
