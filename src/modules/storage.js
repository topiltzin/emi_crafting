export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Thumbnails fill grid cards up to ~240 CSS px wide; 480 keeps them sharp on 2x screens.
export const THUMBNAIL_SIZE = 480;
// Longest edge of the stored original. Phone photos are 4000+ px and 5–15 MB; 2048 px is plenty
// for the full-screen viewer and the 3D worker, and uploads several times faster.
export const MAX_ORIGINAL_DIMENSION = 2048;

// EXIF lives in the JPEG's APP1 segment at the start of the file (max 64 KB), so this is enough
// to read it without loading a multi-megabyte photo into memory as a base64 string.
const EXIF_HEADER_BYTES = 256 * 1024;

export async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Data URL of just the JPEG header, for piexif. Null for formats piexif can't read.
export async function readExifHeader(file) {
  if (file.type !== 'image/jpeg') return null;
  return readFileAsBase64(file.slice(0, EXIF_HEADER_BYTES, 'image/jpeg'));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Decodes an image Blob. Drawing an <img> onto a canvas applies its EXIF orientation (CSS
// image-orientation: from-image is the default), so re-encoded output is upright even though
// the EXIF block itself is dropped. Call release() once done drawing.
export async function decodeImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(url)
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      type,
      quality
    );
  });
}

// Square, center-cropped JPEG thumbnail.
export async function createThumbnailBlob(image, maxSize = THUMBNAIL_SIZE) {
  const size = Math.min(maxSize, image.width, image.height);
  const srcSize = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    .drawImage(
      image.source,
      (image.width - srcSize) / 2,
      (image.height - srcSize) / 2,
      srcSize,
      srcSize,
      0,
      0,
      size,
      size
    );
  return canvasToBlob(canvas, 'image/jpeg', 0.8);
}

// The Blob to store as the photo's original: the untouched file when it's already small enough
// and in the target format (keeps full quality and EXIF), otherwise a downscaled re-encode.
export async function prepareOriginal(blob, image, targetType, maxDimension = MAX_ORIGINAL_DIMENSION) {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxDimension && blob.type === targetType) {
    return { blob, mimeType: targetType };
  }

  const scale = Math.min(1, maxDimension / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image.source, 0, 0, canvas.width, canvas.height);

  let encoded = await canvasToBlob(canvas, targetType, 0.9);
  // Browsers without an encoder for the type (e.g. older Safari and WebP) silently return PNG.
  if (encoded.type && encoded.type !== targetType) {
    encoded = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  }
  return { blob: encoded, mimeType: encoded.type || targetType };
}

export function generateThumbnail(base64Data, maxSize = THUMBNAIL_SIZE) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate dimensions
      const size = Math.min(maxSize, img.width, img.height);
      canvas.width = size;
      canvas.height = size;

      // Calculate source region (center crop for square)
      const srcSize = Math.min(img.width, img.height);
      const srcX = (img.width - srcSize) / 2;
      const srcY = (img.height - srcSize) / 2;

      // Draw resized thumbnail
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64Data;
  });
}

export function isHeic(file) {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
}

export function getMimeType(file) {
  const mimeType = file.type;
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  return mimeType;
}

export function validateFileSize(file, maxSizeBytes = 50 * 1024 * 1024) {
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`);
  }
  return file.size;
}
