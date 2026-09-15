import piexif from 'piexifjs';

export async function extractExifDate(file) {
  try {
    const base64 = await readFileAsBase64(file);
    const exifData = piexif.load(base64);

    if (exifData['0th'][piexif.ImageIFD.DateTime]) {
      const exifDate = exifData['0th'][piexif.ImageIFD.DateTime];
      return exifDate.toString();
    }

    if (exifData['Exif'][piexif.ExifIFD.DateTimeOriginal]) {
      const exifDate = exifData['Exif'][piexif.ExifIFD.DateTimeOriginal];
      return exifDate.toString();
    }

    return null;
  } catch (error) {
    console.warn('Failed to extract EXIF date:', error);
    return null;
  }
}

export function formatExifDate(exifDateString) {
  if (!exifDateString) return null;

  try {
    // Convert "2026:09:14 10:30:45" to "2026-09-14"
    const formatted = exifDateString.replace(/^(\d{4}):(\d{2}):(\d{2}).*/, '$1-$2-$3');

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return null;
    }

    return formatted;
  } catch (error) {
    console.warn('Failed to format EXIF date:', error);
    return null;
  }
}

export async function getPhotoDate(file) {
  // Try EXIF first
  const exifDate = await extractExifDate(file);
  if (exifDate) {
    const formatted = formatExifDate(exifDate);
    if (formatted) return formatted;
  }

  // Fallback to file modification date
  const fileDate = new Date(file.lastModified);
  return fileDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}

export async function getExifData(file) {
  try {
    const base64 = await readFileAsBase64(file);
    const exifData = piexif.load(base64);

    const result = {};

    // Extract common EXIF fields
    if (exifData['0th']) {
      result['DateTime'] = exifData['0th'][piexif.ImageIFD.DateTime]?.toString();
      result['Make'] = exifData['0th'][piexif.ImageIFD.Make]?.toString();
      result['Model'] = exifData['0th'][piexif.ImageIFD.Model]?.toString();
    }

    if (exifData['Exif']) {
      result['DateTimeOriginal'] = exifData['Exif'][piexif.ExifIFD.DateTimeOriginal]?.toString();
      result['LensModel'] = exifData['Exif'][piexif.ExifIFD.LensModel]?.toString();
      result['FocalLength'] = exifData['Exif'][piexif.ExifIFD.FocalLength]?.toString();
      result['FNumber'] = exifData['Exif'][piexif.ExifIFD.FNumber]?.toString();
      result['ISOSpeedRatings'] = exifData['Exif'][piexif.ExifIFD.ISOSpeedRatings]?.toString();
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('Failed to extract full EXIF data:', error);
    return null;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
