import { createPhoto } from './db.js';
import { readFileAsBase64, generateThumbnail, validateFileSize, getMimeType } from './storage.js';
import { getPhotoMetadata } from './exif.js';
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

    // Read and parse the file once; the date and EXIF summary both come from this data URL.
    const photoDataUrl = await readFileAsBase64(file);
    const { photoDate, exifData } = getPhotoMetadata(file, photoDataUrl);
    const photoBase64 = photoDataUrl.split(',')[1];

    // Create or get album for this date
    let albumId = albumIdOrNull;
    if (!albumId) {
      const { album } = await createAlbumIfNeeded(photoDate);
      albumId = album.id;
    }

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
