import { getPhotoOriginalUrl } from '../modules/db.js';
import { openDialog } from './dialog.js';

// A photo's own resolved image can't reach Storage for a reason distinct from — but reported
// the same way as — the rest of the app's data operations (app.js's describeError()).
function describeViewerError(error) {
  if (error && error.code === 'network') {
    return "Can't load this photo right now — check your connection and try again.";
  }
  return `Failed to load photo: ${(error && error.message) || 'Unknown error'}`;
}

export function openPhotoViewer(photo) {
  const content = document.createElement('div');
  content.className = 'photo-viewer-content';

  const loading = document.createElement('div');
  loading.className = 'photo-viewer-loading';
  loading.innerHTML = '<div class="spinner"></div>';
  content.appendChild(loading);

  const dialog = openDialog({
    title: photo.filename || 'Photo',
    content,
    className: 'photo-viewer'
  });

  getPhotoOriginalUrl(photo.storage_path)
    .then((url) => {
      content.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'photo-viewer-image';
      img.src = url;
      img.alt = photo.filename ? `Full-resolution photo: ${photo.filename}` : 'Full-resolution photo';
      content.appendChild(img);
    })
    .catch((error) => {
      content.innerHTML = '';
      const errorEl = document.createElement('p');
      errorEl.className = 'photo-viewer-error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = describeViewerError(error);
      content.appendChild(errorEl);
    });

  return dialog;
}
