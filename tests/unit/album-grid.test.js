import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAlbumGrid, attachAlbumGridEvents } from '../../src/ui/album-grid.js';

const album = { id: 'album-1', album_date: '2026-09-14', title: 'Paper Crafts', photo_count: 2 };

describe('attachAlbumGridEvents — full-card click and keyboard access', () => {
  let grid;
  let onViewAlbum;
  let onDeleteAlbum;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    grid = renderAlbumGrid([album]);
    document.getElementById('app').appendChild(grid);
    onViewAlbum = vi.fn();
    onDeleteAlbum = vi.fn();
    attachAlbumGridEvents(grid, onViewAlbum, onDeleteAlbum);
  });

  it('opens the album when clicking the thumbnail (outside any [data-action] control)', () => {
    grid.querySelector('.album-thumbnail').click();
    expect(onViewAlbum).toHaveBeenCalledWith('album-1');
  });

  it('opens the album when clicking the title', () => {
    grid.querySelector('.album-title').click();
    expect(onViewAlbum).toHaveBeenCalledWith('album-1');
  });

  it('still opens the album when clicking the explicit "View" button', () => {
    grid.querySelector('[data-action="view"]').click();
    expect(onViewAlbum).toHaveBeenCalledWith('album-1');
  });

  it('clicking "Delete" only triggers the delete flow, not the open-album behavior', async () => {
    grid.querySelector('[data-action="delete"]').click();
    await Promise.resolve();

    expect(onViewAlbum).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();

    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await Promise.resolve();
    expect(onDeleteAlbum).toHaveBeenCalledWith('album-1');
    expect(onViewAlbum).not.toHaveBeenCalled();
  });

  it('opens the album on Enter when the card itself has focus', () => {
    const card = grid.querySelector('.album-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onViewAlbum).toHaveBeenCalledWith('album-1');
  });

  it('opens the album on Space when the card itself has focus', () => {
    const card = grid.querySelector('.album-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onViewAlbum).toHaveBeenCalledWith('album-1');
  });

  it('does not double-invoke onViewAlbum when Enter is pressed on a nested button', () => {
    const viewBtn = grid.querySelector('[data-action="view"]');
    viewBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // The keydown listener ignores it (event.target is the button, not the card); the button's
    // own native activation is a separate concern (browsers fire a click for Enter on buttons).
    expect(onViewAlbum).not.toHaveBeenCalled();
  });
});

describe('attachAlbumGridEvents — Edit action', () => {
  it('renders an Edit button and invokes onEditAlbum with the album id when clicked, without opening the album', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const grid = renderAlbumGrid([album]);
    document.getElementById('app').appendChild(grid);

    const onViewAlbum = vi.fn();
    const onDeleteAlbum = vi.fn();
    const onEditAlbum = vi.fn();
    attachAlbumGridEvents(grid, onViewAlbum, onDeleteAlbum, onEditAlbum);

    const editBtn = grid.querySelector('[data-action="edit"]');
    expect(editBtn).not.toBeNull();
    expect(editBtn.textContent).toBe('Edit');

    editBtn.click();
    expect(onEditAlbum).toHaveBeenCalledWith('album-1');
    expect(onViewAlbum).not.toHaveBeenCalled();
  });

  it('does nothing (no throw) when Edit is clicked and no onEditAlbum callback was provided', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const grid = renderAlbumGrid([album]);
    document.getElementById('app').appendChild(grid);
    attachAlbumGridEvents(grid, vi.fn(), vi.fn());

    expect(() => grid.querySelector('[data-action="edit"]').click()).not.toThrow();
  });
});
