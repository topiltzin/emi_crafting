import { describe, it, expect, vi } from 'vitest';
import { renderAlbumView, attachAlbumViewEvents } from '../../src/ui/album-view.js';

const album = { id: 1, album_date: '2026-09-14', title: null, photo_count: 2 };
const photos = [
  { id: 10, filename: 'a.jpg', thumbnail_base64: 'thumb-a', photo_date: '2026-09-14', is_favorite: 0 },
  { id: 11, filename: 'b.jpg', thumbnail_base64: 'thumb-b', photo_date: '2026-09-14', is_favorite: 1 }
];

describe('renderAlbumView', () => {
  it('renders the album title (falling back to formatted date), back button, and photo cards', () => {
    const view = renderAlbumView(album, photos);

    expect(view.querySelector('.back-button')).not.toBeNull();
    expect(view.querySelector('.album-header-info h2').textContent).toBe('September 14, 2026');
    expect(view.querySelectorAll('.photo-card')).toHaveLength(2);
  });

  it('uses a custom title when present', () => {
    const view = renderAlbumView({ ...album, title: 'Paper Crafts' }, photos);
    expect(view.querySelector('.album-header-info h2').textContent).toBe('Paper Crafts');
  });

  it('shows the shared photos empty state when the album has no photos', () => {
    const view = renderAlbumView(album, []);
    expect(view.querySelector('.empty-state-heading').textContent).toBe('No creations yet!');
  });
});

describe('attachAlbumViewEvents', () => {
  it('wires back, add-photos, and delete-photo actions', async () => {
    const view = renderAlbumView(album, photos);
    const onBack = vi.fn();
    const onAddPhotos = vi.fn();
    const onDeletePhoto = vi.fn().mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    attachAlbumViewEvents(view, onBack, onAddPhotos, onDeletePhoto);

    view.querySelector('.back-button').click();
    expect(onBack).toHaveBeenCalledTimes(1);

    view.querySelector('[data-action="add-photos"]').click();
    expect(onAddPhotos).toHaveBeenCalledTimes(1);

    view.querySelector('[data-action="delete-photo"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onDeletePhoto).toHaveBeenCalledWith(10);

    window.confirm.mockRestore();
  });

  it('does not delete when the confirm dialog is declined', () => {
    const view = renderAlbumView(album, photos);
    const onDeletePhoto = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    attachAlbumViewEvents(view, vi.fn(), vi.fn(), onDeletePhoto);
    view.querySelector('[data-action="delete-photo"]').click();

    expect(onDeletePhoto).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });
});
