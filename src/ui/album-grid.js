import { createEmptyState } from './empty-state.js';
import { showConfirmDialog } from './confirm-dialog.js';

const ACCENT_COUNT = 4;

export function renderAlbumGrid(albums) {
  const container = document.createElement('div');
  container.className = 'album-grid grid';
  container.setAttribute('data-total-albums', albums.length);

  if (albums.length === 0) {
    const empty = createEmptyState('albums');
    empty.style.gridColumn = '1 / -1';
    container.appendChild(empty);
    return container;
  }

  albums.forEach((album, index) => {
    const card = createAlbumCard(album, index);
    container.appendChild(card);
  });

  return container;
}

export function createAlbumCard(album, index = 0) {
  const card = document.createElement('div');
  const accent = (index % ACCENT_COUNT) + 1;
  card.className = `album-card album-card--accent-${accent}`;
  card.setAttribute('draggable', 'true');
  card.setAttribute('data-album-id', album.id);
  card.setAttribute('aria-label', `Album: ${album.album_date}, ${album.photo_count} photos`);
  card.setAttribute('tabindex', '0');

  const accentBar = document.createElement('div');
  accentBar.className = 'album-card-accent';
  card.appendChild(accentBar);

  // Cover image or placeholder
  const thumbnail = document.createElement('div');
  thumbnail.className = 'album-thumbnail';
  if (album.cover_thumbnail_url) {
    const img = document.createElement('img');
    img.className = 'album-thumbnail-img';
    img.src = album.cover_thumbnail_url;
    if (album.cover_thumbnail_path) img.dataset.storagePath = album.cover_thumbnail_path;
    img.alt = `Cover photo for ${album.title || formatAlbumDate(album.album_date)}`;
    img.loading = 'lazy';
    thumbnail.appendChild(img);
  } else {
    thumbnail.textContent = '📁';
    thumbnail.setAttribute('aria-hidden', 'true');
  }

  // Info section
  const info = document.createElement('div');
  info.className = 'album-info';

  const title = document.createElement('h3');
  title.className = 'album-title';
  title.textContent = album.title || formatAlbumDate(album.album_date);

  const date = document.createElement('p');
  date.className = 'album-date';
  date.textContent = album.album_date;

  const count = document.createElement('p');
  count.className = 'album-count';
  count.textContent = `${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''}`;

  const actions = document.createElement('div');
  actions.className = 'album-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn btn-primary btn-sm';
  viewBtn.textContent = 'View';
  viewBtn.setAttribute('data-action', 'view');
  viewBtn.setAttribute('data-album-id', album.id);

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary btn-sm';
  editBtn.textContent = 'Edit';
  editBtn.setAttribute('data-action', 'edit');
  editBtn.setAttribute('data-album-id', album.id);
  editBtn.setAttribute('aria-label', `Rename album: ${album.title || formatAlbumDate(album.album_date)}`);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger btn-sm';
  deleteBtn.textContent = 'Delete';
  deleteBtn.setAttribute('data-action', 'delete');
  deleteBtn.setAttribute('data-album-id', album.id);
  deleteBtn.setAttribute('data-album-title', album.title || formatAlbumDate(album.album_date));
  deleteBtn.setAttribute('data-photo-count', album.photo_count);

  actions.appendChild(viewBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  info.appendChild(title);
  info.appendChild(date);
  info.appendChild(count);
  info.appendChild(actions);

  card.appendChild(thumbnail);
  card.appendChild(info);

  return card;
}

export function attachAlbumGridEvents(gridElement, onViewAlbum, onDeleteAlbum, onEditAlbum) {
  gridElement.addEventListener('click', async (event) => {
    const card = event.target.closest('.album-card');
    if (!card) return;

    const albumId = card.getAttribute('data-album-id');
    const actionEl = event.target.closest('[data-action]');
    const action = actionEl ? actionEl.getAttribute('data-action') : null;

    if (action === 'delete') {
      const albumTitle = actionEl.getAttribute('data-album-title');
      const photoCount = actionEl.getAttribute('data-photo-count');
      const confirmed = await showConfirmDialog({
        title: 'Delete album?',
        message: `"${albumTitle}" and its ${photoCount} photo${photoCount !== '1' ? 's' : ''} will be removed. This can't be undone.`
      });
      if (confirmed) {
        onDeleteAlbum(albumId);
      }
      return;
    }

    if (action === 'edit') {
      if (typeof onEditAlbum === 'function') onEditAlbum(albumId);
      return;
    }

    // Anywhere else on the card — including the explicit "View" button — opens the album.
    // Cards look and hover like they're clickable everywhere, so they must behave that way.
    onViewAlbum(albumId);
  });

  gridElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // Only when the keypress originates on the card itself — a nested <button> (View/Delete/
    // Edit) already handles its own Enter/Space activation natively, so this must not also fire.
    if (!event.target.classList || !event.target.classList.contains('album-card')) return;

    event.preventDefault();
    onViewAlbum(event.target.getAttribute('data-album-id'));
  });
}

export function attachAlbumDragDrop(gridElement, onReorder) {
  // Import the drag-drop module
  import('./../modules/dnd.js').then(({ initDragDrop }) => {
    initDragDrop(gridElement, onReorder);
  });
}

export function formatAlbumDate(dateString) {
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
