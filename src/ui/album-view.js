import { formatAlbumDate } from './album-grid.js';
import { createPhotoCard } from './photo-card.js';
import { createEmptyState } from './empty-state.js';

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
  date.textContent = `${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''}`;

  headerInfo.appendChild(title);
  headerInfo.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'flex gap-md';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Add Photos';
  addBtn.setAttribute('data-action', 'add-photos');

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

export function attachAlbumViewEvents(container, onBack, onAddPhotos, onDeletePhoto) {
  container.addEventListener('click', async (event) => {
    const backBtn = event.target.closest('[data-action="back"]');
    const addBtn = event.target.closest('[data-action="add-photos"]');
    const deleteBtn = event.target.closest('[data-action="delete-photo"]');

    if (backBtn) {
      onBack();
      return;
    }

    if (addBtn) {
      onAddPhotos();
      return;
    }

    if (deleteBtn) {
      const photoId = parseInt(deleteBtn.getAttribute('data-photo-id'), 10);
      if (confirm('Delete this photo? This cannot be undone.')) {
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
