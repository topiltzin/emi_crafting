import { createPhotoCard } from './photo-card.js';
import { createEmptyState } from './empty-state.js';

export function groupPhotosByMonth(photos) {
  const buckets = new Map();

  photos.forEach((photo) => {
    const dateValue = photo.photo_date || photo.upload_date;
    const key = monthYearKey(dateValue);

    if (!buckets.has(key.sortKey)) {
      buckets.set(key.sortKey, { label: key.label, photos: [] });
    }
    buckets.get(key.sortKey).photos.push(photo);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, bucket]) => bucket);
}

function monthYearKey(dateValue) {
  if (!dateValue) {
    return { sortKey: '0000-00', label: 'Undated' };
  }

  const date = new Date(dateValue.length <= 10 ? `${dateValue}T00:00:00Z` : dateValue);
  if (Number.isNaN(date.getTime())) {
    return { sortKey: '0000-00', label: 'Undated' };
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const sortKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });

  return { sortKey, label };
}

export function renderPhotoGallery(photos, options = {}) {
  const { emptyStateVariant = 'photos' } = options;

  const container = document.createElement('div');
  container.className = 'photo-gallery';

  if (photos.length === 0) {
    container.appendChild(createEmptyState(emptyStateVariant));
    return container;
  }

  const groups = groupPhotosByMonth(photos);

  groups.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'date-section';

    const header = document.createElement('div');
    header.className = 'date-section-header';

    const badge = document.createElement('h2');
    badge.className = 'photo-card-date';
    badge.textContent = group.label;
    header.appendChild(badge);

    const grid = document.createElement('div');
    grid.className = 'photo-gallery-grid grid';

    group.photos.forEach((photo) => {
      grid.appendChild(createPhotoCard(photo, { showAlbumLabel: true }));
    });

    section.appendChild(header);
    section.appendChild(grid);
    container.appendChild(section);
  });

  return container;
}

export function attachPhotoGalleryEvents(galleryElement, onToggleFavorite, onDeletePhoto) {
  galleryElement.addEventListener('photo-card:favorite-toggle', (event) => {
    onToggleFavorite(event.detail.photoId);
  });

  galleryElement.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('[data-action="delete-photo"]');
    if (deleteBtn && onDeletePhoto) {
      const photoId = parseInt(deleteBtn.getAttribute('data-photo-id'), 10);
      if (confirm('Delete this photo? This cannot be undone.')) {
        try {
          await onDeletePhoto(photoId);
        } catch (error) {
          alert(`Failed to delete photo: ${error.message}`);
        }
      }
    }

    const emptyStateCta = event.target.closest('[data-action="add-photos"], [data-action="browse-photos"]');
    if (emptyStateCta) {
      galleryElement.dispatchEvent(
        new CustomEvent('photo-gallery:empty-state-cta', {
          bubbles: true,
          detail: { action: emptyStateCta.getAttribute('data-action') }
        })
      );
    }
  });
}
