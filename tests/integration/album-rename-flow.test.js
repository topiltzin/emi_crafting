import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { getAlbums, createAlbum } from '../../src/modules/db.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Renaming an album end-to-end', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await createAlbum('2026-08-01', 'Original Name');
    await initApp();
    getApp().querySelector('[data-section="albums"]').click();
    await waitFor(() => getApp().querySelector('.album-card'));
  });

  it('renames from the album list and reflects the new name immediately', async () => {
    getApp().querySelector('[data-action="edit"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    expect(getApp().querySelector('.modal-title').textContent).toBe('Rename Album');
    expect(getApp().querySelector('.create-album-input').value).toBe('Original Name');

    getApp().querySelector('.create-album-input').value = 'Renamed From List';
    getApp().querySelector('[data-action="create-album-confirm"]').click();

    await waitFor(() => getApp().querySelector('.album-title')?.textContent === 'Renamed From List');
    expect((await getAlbums()).some((a) => a.title === 'Renamed From List')).toBe(true);
    expect((await getAlbums()).some((a) => a.title === 'Original Name')).toBe(false);
  });

  it('renames from the album detail header and reflects the new name there', async () => {
    getApp().querySelector('[data-action="view"]').click();
    await waitFor(() => getApp().querySelector('[data-action="edit-album"]'));

    getApp().querySelector('[data-action="edit-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));
    expect(getApp().querySelector('.create-album-input').value).toBe('Original Name');

    getApp().querySelector('.create-album-input').value = 'Renamed From Detail';
    getApp().querySelector('[data-action="create-album-confirm"]').click();

    await waitFor(() => getApp().querySelector('.album-header-info h2')?.textContent === 'Renamed From Detail');
    expect((await getAlbums()).some((a) => a.title === 'Renamed From Detail')).toBe(true);
  });

  it('rejects an empty new name and leaves the previous name in effect', async () => {
    getApp().querySelector('[data-action="edit"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect((await getAlbums()).some((a) => a.title === 'Original Name')).toBe(true);
  });

  it('cancelling leaves the album name unchanged', async () => {
    getApp().querySelector('[data-action="edit"]').click();
    await waitFor(() => getApp().querySelector('[data-action="create-album-cancel"]'));

    getApp().querySelector('[data-action="create-album-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect((await getAlbums()).some((a) => a.title === 'Original Name')).toBe(true);
  });
});
