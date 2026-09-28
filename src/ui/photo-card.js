import { createTutorialBadge } from './tutorial-badge.js';
import { createModelBadge } from './model-badge.js';

export function createPhotoCard(photo, options = {}) {
  const { showAlbumLabel = false, showCheckbox = false } = options;

  const card = document.createElement('div');
  card.className = 'photo-card';
  card.setAttribute('data-photo-id', photo.id);
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View full-resolution photo: ${photo.filename || 'craft photo'}`);

  const thumbnailUrl = getThumbnailUrl(photo);

  const media = document.createElement('div');
  media.className = 'photo-card-media';

  const img = document.createElement('img');
  img.className = 'photo-card-image';
  img.src = thumbnailUrl;
  img.loading = 'lazy';
  img.alt = photo.filename ? `Craft photo: ${photo.filename}` : 'Craft photo';
  media.appendChild(img);

  if (showCheckbox) {
    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'photo-card-checkbox-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'photo-card-checkbox';
    checkbox.setAttribute('data-action', 'select-photo');
    checkbox.setAttribute('data-photo-id', photo.id);
    checkbox.setAttribute('aria-label', `Select photo: ${photo.filename || 'craft photo'}`);
    checkboxLabel.appendChild(checkbox);
    media.appendChild(checkboxLabel);
  }

  const favoriteBtn = document.createElement('button');
  favoriteBtn.type = 'button';
  favoriteBtn.className = `photo-card-favorite${photo.is_favorite ? ' is-favorite' : ''}`;
  favoriteBtn.setAttribute('data-action', 'toggle-favorite');
  favoriteBtn.setAttribute('data-photo-id', photo.id);
  favoriteBtn.setAttribute(
    'aria-label',
    photo.is_favorite ? 'Remove from favorites' : 'Add to favorites'
  );
  favoriteBtn.setAttribute('aria-pressed', photo.is_favorite ? 'true' : 'false');
  favoriteBtn.innerHTML = '<span aria-hidden="true">♥</span>';
  media.appendChild(favoriteBtn);

  if (photo.tutorial_link) {
    media.appendChild(createTutorialBadge());
  }

  if (photo.model_storage_path) {
    media.appendChild(createModelBadge());
  }

  const info = document.createElement('div');
  info.className = 'photo-card-info';

  const dateBadge = document.createElement('span');
  dateBadge.className = 'photo-card-date';
  dateBadge.textContent = formatPhotoDate(photo.photo_date || photo.upload_date);
  info.appendChild(dateBadge);

  if (showAlbumLabel && (photo.album_title || photo.album_date)) {
    const albumLabel = document.createElement('span');
    albumLabel.className = 'photo-card-album';
    albumLabel.textContent = photo.album_title || formatPhotoDate(photo.album_date);
    info.appendChild(albumLabel);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'photo-card-delete';
  deleteBtn.setAttribute('data-action', 'delete-photo');
  deleteBtn.setAttribute('data-photo-id', photo.id);
  deleteBtn.setAttribute('data-photo-filename', photo.filename || '');
  deleteBtn.setAttribute('aria-label', `Delete photo: ${photo.filename || 'craft photo'}`);
  deleteBtn.innerHTML = '<span aria-hidden="true">🗑️</span>';
  info.appendChild(deleteBtn);

  card.appendChild(media);
  card.appendChild(info);

  favoriteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    card.dispatchEvent(
      new CustomEvent('photo-card:favorite-toggle', {
        bubbles: true,
        detail: { photoId: photo.id }
      })
    );
  });

  return card;
}

function getThumbnailUrl(photo) {
  return photo.thumbnail_url || '';
}

export function formatPhotoDate(dateString) {
  if (!dateString) return 'Undated';
  const date = new Date(dateString.length <= 10 ? `${dateString}T00:00:00Z` : dateString);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
