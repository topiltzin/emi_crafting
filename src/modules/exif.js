import piexif from 'piexifjs';
import { readFileAsBase64 } from './storage.js';

// Parses the EXIF block once; callers that need both the date and the metadata (addPhoto)
// share one parse instead of reading/decoding the file twice.
function loadExif(dataUrl) {
  try {
    return piexif.load(dataUrl);
  } catch (error) {
    console.warn('Failed to read EXIF data:', error);
    return null;
  }
}

function exifDateFrom(exif) {
  if (!exif) return null;
  const raw = exif['0th']?.[piexif.ImageIFD.DateTime] || exif['Exif']?.[piexif.ExifIFD.DateTimeOriginal];
  return raw ? raw.toString() : null;
}

function exifFieldsFrom(exif) {
  if (!exif) return null;

  const result = {};
  if (exif['0th']) {
    result['DateTime'] = exif['0th'][piexif.ImageIFD.DateTime]?.toString();
    result['Make'] = exif['0th'][piexif.ImageIFD.Make]?.toString();
    result['Model'] = exif['0th'][piexif.ImageIFD.Model]?.toString();
  }
  if (exif['Exif']) {
    result['DateTimeOriginal'] = exif['Exif'][piexif.ExifIFD.DateTimeOriginal]?.toString();
    result['LensModel'] = exif['Exif'][piexif.ExifIFD.LensModel]?.toString();
    result['FocalLength'] = exif['Exif'][piexif.ExifIFD.FocalLength]?.toString();
    result['FNumber'] = exif['Exif'][piexif.ExifIFD.FNumber]?.toString();
    result['ISOSpeedRatings'] = exif['Exif'][piexif.ExifIFD.ISOSpeedRatings]?.toString();
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function formatExifDate(exifDateString) {
  if (!exifDateString) return null;

  // Convert "2026:09:14 10:30:45" to "2026-09-14"
  const formatted = exifDateString.replace(/^(\d{4}):(\d{2}):(\d{2}).*/, '$1-$2-$3');
  return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null;
}

/**
 * Derives the album date and EXIF summary from an already-read data URL, so an upload reads
 * and parses each file exactly once.
 * @returns {{photoDate: string, exifData: object|null}}
 */
export function getPhotoMetadata(file, dataUrl) {
  const exif = loadExif(dataUrl);
  const photoDate =
    formatExifDate(exifDateFrom(exif)) || new Date(file.lastModified).toISOString().split('T')[0];
  return { photoDate, exifData: exifFieldsFrom(exif) };
}

export async function getPhotoDate(file) {
  return getPhotoMetadata(file, await readFileAsBase64(file)).photoDate;
}

export async function getExifData(file) {
  return exifFieldsFrom(loadExif(await readFileAsBase64(file)));
}
