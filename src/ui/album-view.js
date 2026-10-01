import { formatAlbumDate } from './album-grid.js';
import { createPhotoCard } from './photo-card.js';
import { createEmptyState } from './empty-state.js';
import { showConfirmDialog } from './confirm-dialog.js';

export function renderAlbumView(album, photos) {
  const container = document.createElement('div');
  container.className = 'album-view';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-button';
  backBtn.innerHTML = '← Back to Albums';
  backBtn.setAttribute('data-action', 'back');

  // Header
  const header = document.createElement('div');
  header.className = 'album-header';

  const headerInfo = document.createElement('div');
  headerInfo.className = 'album-header-info';

  const title = document.createElement('h2');
  title.textContent = album.title || formatAlbumDate(album.album_date);

  const date = document.createElement('p');
  date.className = 'album-photo-count';
  date.dataset.count = String(album.photo_count);
  date.textContent = `${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''}`;

  headerInfo.appendChild(title);
  headerInfo.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'flex gap-md';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary';
  editBtn.textContent = 'Edit';
  editBtn.setAttribute('data-action', 'edit-album');
  editBtn.setAttribute('aria-label', `Rename album: ${album.title || formatAlbumDate(album.album_date)}`);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Add Photos';
  addBtn.setAttribute('data-action', 'add-photos');

  actions.appendChild(editBtn);
  actions.appendChild(addBtn);
  header.appendChild(headerInfo);
  header.appendChild(actions);

  // Photo grid
  const grid = renderPhotoGrid(photos);

  container.appendChild(backBtn);
  container.appendChild(header);
  container.appendChild(grid);

  return container;
}

function renderPhotoGrid(photos) {
  const container = document.createElement('div');
  container.className = 'photo-grid grid';

  if (photos.length === 0) {
    const empty = createEmptyState('photos');
    empty.style.gridColumn = '1 / -1';
    container.appendChild(empty);
    return container;
  }

  photos.forEach((photo) => {
    container.appendChild(createPhotoCard(photo));
  });

  return container;
}

export function attachAlbumViewEvents(container, onBack, onAddPhotos, onDeletePhoto, onEditAlbum) {
  container.addEventListener('click', async (event) => {
    const backBtn = event.target.closest('[data-action="back"]');
    const addBtn = event.target.closest('[data-action="add-photos"]');
    const editBtn = event.target.closest('[data-action="edit-album"]');
    const deleteBtn = event.target.closest('[data-action="delete-photo"]');

    if (backBtn) {
      onBack();
      return;
    }

    if (addBtn) {
      onAddPhotos();
      return;
    }

    if (editBtn) {
      if (typeof onEditAlbum === 'function') onEditAlbum();
      return;
    }

    if (deleteBtn) {
      const photoId = deleteBtn.getAttribute('data-photo-id');
      const filename = deleteBtn.getAttribute('data-photo-filename');
      const confirmed = await showConfirmDialog({
        title: 'Delete photo?',
        message: `"${filename || 'This craft photo'}" will be removed. This can't be undone.`
      });
      if (confirmed) {
        try {
          await onDeletePhoto(photoId);
        } catch (error) {
          alert(`Failed to delete photo: ${error.message}`);
        }
      }
      return;
    }
  });
}
