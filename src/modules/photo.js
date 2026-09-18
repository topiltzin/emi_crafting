import { createPhoto } from './db.js';
import { readFileAsBase64, generateThumbnail, validateFileSize, getMimeType } from './storage.js';
import { getPhotoDate, getExifData } from './exif.js';
import { createAlbumIfNeeded } from './album.js';

export async function uploadPhotos(files, albumId = null) {
  const uploadedPhotos = [];
  const errors = [];

  for (const file of files) {
    try {
      const photo = await addPhoto(albumId, file);
      uploadedPhotos.push(photo);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      errors.push({
        filename: file.name,
        error: error.message
      });
    }
  }

  return {
    uploaded: uploadedPhotos,
    errors: errors
  };
}

export async function addPhoto(albumIdOrNull, file) {
  try {
    // Validate file
    validateFileSize(file);
    const mimeType = getMimeType(file);

    // Extract EXIF data and photo date
    const photoDate = await getPhotoDate(file);
    const exifData = await getExifData(file);

    // Create or get album for this date
    let albumId = albumIdOrNull;
    if (!albumId) {
      const { album } = await createAlbumIfNeeded(photoDate);
      albumId = album.id;
    }

    // Convert file to base64
    const photoDataUrl = await readFileAsBase64(file);
    const photoBase64 = photoDataUrl.split(',')[1];

    // Generate thumbnail
    const thumbnailDataUrl = await generateThumbnail(photoDataUrl, 150);
    const thumbnailBase64 = thumbnailDataUrl.split(',')[1];

    // Create photo record in database
    const photoData = {
      filename: file.name,
      file_size: file.size,
      mime_type: mimeType,
      photo_date: photoDate,
      photo_data_base64: photoBase64,
      thumbnail_base64: thumbnailBase64,
      exif_json: exifData
    };

    return await createPhoto(albumId, photoData);
  } catch (error) {
    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  }
}

export async function removePhoto(photoId) {
  // Soft delete
  const { deletePhoto } = await import('./db.js');
  return await deletePhoto(photoId, false);
}

export function getPhotoUrl(photoBase64) {
  if (photoBase64.startsWith('data:')) {
    return photoBase64;
  }
  return `data:image/jpeg;base64,${photoBase64}`;
}
