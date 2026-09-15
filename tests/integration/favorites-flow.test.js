import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAllPhotos, toggleFavorite } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { renderPhotoGallery, attachPhotoGalleryEvents } from '../../src/ui/photo-gallery.js';

function renderFavoritesView() {
  const container = document.createElement('div');
  const gallery = renderPhotoGallery(getAllPhotos({ favoritesOnly: true }), {
    emptyStateVariant: 'favorites'
  });
  container.appendChild(gallery);
  return container;
}

describe('Favorites flow', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('favoriting a photo makes it appear in the Favorites view, and it persists across a reload', async () => {
    const result = await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const photoId = result.uploaded[0].id;

    // Nothing favorited yet: Favorites view is empty.
    let favoritesView = renderFavoritesView();
    expect(favoritesView.querySelector('.empty-state')).not.toBeNull();

    // Favorite it via the card's toggle control (mirrors clicking the heart).
    const gallery = renderPhotoGallery(getAllPhotos());
    attachPhotoGalleryEvents(gallery, async (id) => {
      await toggleFavorite(id);
    });
    gallery.querySelector(`[data-photo-id="${photoId}"].photo-card-favorite`).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    favoritesView = renderFavoritesView();
    expect(favoritesView.querySelectorAll('.photo-card')).toHaveLength(1);
    expect(favoritesView.querySelector('.photo-card').getAttribute('data-photo-id')).toBe(String(photoId));

    // Simulate a fresh app load reading from the same persisted database.
    await initDB();
    const reloadedFavorites = getAllPhotos({ favoritesOnly: true });
    expect(reloadedFavorites).toHaveLength(1);
    expect(reloadedFavorites[0].id).toBe(photoId);

    // Unfavorite it from the Favorites view and confirm it disappears.
    await toggleFavorite(photoId);
    favoritesView = renderFavoritesView();
    expect(favoritesView.querySelector('.empty-state')).not.toBeNull();
  });

  it('renders the favorites empty state when nothing is favorited', () => {
    const favoritesView = renderFavoritesView();
    expect(favoritesView.querySelector('.empty-state-heading').textContent).toBe('No favorites yet!');
  });
});
