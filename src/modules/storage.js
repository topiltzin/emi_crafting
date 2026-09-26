export async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function generateThumbnail(base64Data, maxSize = 150) {
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

export function getMimeType(file) {
  const mimeType = file.type;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
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
