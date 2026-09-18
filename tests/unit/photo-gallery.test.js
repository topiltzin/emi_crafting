import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groupPhotosByMonth, renderPhotoGallery, attachPhotoGalleryEvents } from '../../src/ui/photo-gallery.js';
import { createPhotoCard } from '../../src/ui/photo-card.js';

describe('groupPhotosByMonth', () => {
  it('groups photos into correctly labeled month/year buckets', () => {
    const photos = [
      { id: 1, photo_date: '2026-09-05', thumbnail_base64: 'a' },
      { id: 2, photo_date: '2026-09-20', thumbnail_base64: 'a' },
      { id: 3, photo_date: '2026-08-01', thumbnail_base64: 'a' }
    ];

    const groups = groupPhotosByMonth(photos);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('September 2026');
    expect(groups[0].photos.map((p) => p.id)).toEqual([1, 2]);
    expect(groups[1].label).toBe('August 2026');
  });

  it('orders buckets most-recent month first', () => {
    const photos = [
      { id: 1, photo_date: '2026-01-15', thumbnail_base64: 'a' },
      { id: 2, photo_date: '2026-09-15', thumbnail_base64: 'a' },
      { id: 3, photo_date: '2026-05-15', thumbnail_base64: 'a' }
    ];

    const groups = groupPhotosByMonth(photos);

    expect(groups.map((g) => g.label)).toEqual(['September 2026', 'May 2026', 'January 2026']);
  });

  it('falls back to upload_date when photo_date is missing', () => {
    const photos = [{ id: 1, photo_date: null, upload_date: '2026-03-10 10:00:00', thumbnail_base64: 'a' }];

    const groups = groupPhotosByMonth(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('March 2026');
  });
});

describe('renderPhotoGallery', () => {
  it('renders an empty state when there are no photos', () => {
    const gallery = renderPhotoGallery([], { emptyStateVariant: 'photos' });
    expect(gallery.querySelector('.empty-state')).not.toBeNull();
    expect(gallery.querySelector('.date-section')).toBeNull();
  });

  it('renders one date-section per month with all its photos', () => {
    const photos = [
      { id: 1, photo_date: '2026-09-05', thumbnail_base64: 'a', filename: 'a.jpg' },
      { id: 2, photo_date: '2026-08-01', thumbnail_base64: 'a', filename: 'b.jpg' }
    ];

    const gallery = renderPhotoGallery(photos);
    const sections = gallery.querySelectorAll('.date-section');
    expect(sections).toHaveLength(2);
    expect(gallery.querySelectorAll('.photo-card')).toHaveLength(2);
  });
});

describe('createPhotoCard — keyboard reachability', () => {
  it('the card element is focusable and carries a descriptive aria-label', () => {
    const card = createPhotoCard({ id: 'photo-1', filename: 'craft.jpg' });
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toBe('View full-resolution photo: craft.jpg');
  });
});

describe('attachPhotoGalleryEvents — opening the full-resolution viewer', () => {
  let gallery;
  let onToggleFavorite;
  let onDeletePhoto;
  let onOpenPhoto;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    gallery = document.createElement('div');
    gallery.appendChild(createPhotoCard({ id: 'photo-1', filename: 'craft.jpg', is_favorite: false }));
    document.getElementById('app').appendChild(gallery);

    onToggleFavorite = vi.fn();
    onDeletePhoto = vi.fn().mockResolvedValue();
    onOpenPhoto = vi.fn();
    attachPhotoGalleryEvents(gallery, onToggleFavorite, onDeletePhoto, onOpenPhoto);
  });

  it('invokes onOpenPhoto when a click lands on the card outside any [data-action] control', () => {
    gallery.querySelector('.photo-card-media').click();
    expect(onOpenPhoto).toHaveBeenCalledWith('photo-1');
  });

  it('does not invoke onOpenPhoto when the click lands on the favorite control', () => {
    gallery.querySelector('[data-action="toggle-favorite"]').click();
    expect(onOpenPhoto).not.toHaveBeenCalled();
  });

  it('does not invoke onOpenPhoto when the click lands on the delete control', async () => {
    gallery.querySelector('[data-action="delete-photo"]').click();
    await Promise.resolve();
    expect(onOpenPhoto).not.toHaveBeenCalled();
  });

  it('invokes onOpenPhoto on Enter/Space when the keypress originates on the card itself', () => {
    const card = gallery.querySelector('.photo-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onOpenPhoto).toHaveBeenCalledWith('photo-1');

    onOpenPhoto.mockClear();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onOpenPhoto).toHaveBeenCalledWith('photo-1');
  });

  it('does not invoke onOpenPhoto on Enter/Space bubbled from a nested button', () => {
    const favoriteBtn = gallery.querySelector('[data-action="toggle-favorite"]');
    favoriteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onOpenPhoto).not.toHaveBeenCalled();
  });

  it('does nothing (no throw) when no onOpenPhoto callback was provided', () => {
    attachPhotoGalleryEvents(gallery, onToggleFavorite, onDeletePhoto);
    expect(() => gallery.querySelector('.photo-card-media').click()).not.toThrow();
  });
});
