import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('renders an Edit action in the header', () => {
    const view = renderAlbumView(album, photos);
    expect(view.querySelector('[data-action="edit-album"]')).not.toBeNull();
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
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('wires back, add-photos, and delete-photo actions', async () => {
    const view = renderAlbumView(album, photos);
    document.getElementById('app').appendChild(view);
    const onBack = vi.fn();
    const onAddPhotos = vi.fn();
    const onDeletePhoto = vi.fn().mockResolvedValue();

    attachAlbumViewEvents(view, onBack, onAddPhotos, onDeletePhoto);

    view.querySelector('.back-button').click();
    expect(onBack).toHaveBeenCalledTimes(1);

    view.querySelector('[data-action="add-photos"]').click();
    expect(onAddPhotos).toHaveBeenCalledTimes(1);

    view.querySelector('[data-action="delete-photo"]').click();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await Promise.resolve();
    await Promise.resolve();
    // Photo/album ids are opaque strings end-to-end now (Supabase uses UUIDs); the UI reads
    // them straight from DOM attributes without parsing, so a numeric fixture id round-trips
    // as its string form.
    expect(onDeletePhoto).toHaveBeenCalledWith('10');
  });

  it('invokes onEditAlbum when the header Edit action is clicked', () => {
    const view = renderAlbumView(album, photos);
    document.getElementById('app').appendChild(view);
    const onEditAlbum = vi.fn();

    attachAlbumViewEvents(view, vi.fn(), vi.fn(), vi.fn(), onEditAlbum);
    view.querySelector('[data-action="edit-album"]').click();

    expect(onEditAlbum).toHaveBeenCalledTimes(1);
  });

  it('does not delete when the confirm dialog is declined', async () => {
    const view = renderAlbumView(album, photos);
    document.getElementById('app').appendChild(view);
    const onDeletePhoto = vi.fn();

    attachAlbumViewEvents(view, vi.fn(), vi.fn(), onDeletePhoto);
    view.querySelector('[data-action="delete-photo"]').click();
    document.querySelector('[data-action="confirm-dialog-cancel"]').click();
    await Promise.resolve();

    expect(onDeletePhoto).not.toHaveBeenCalled();
  });
});
