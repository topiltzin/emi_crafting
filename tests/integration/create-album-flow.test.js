import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { getAlbums } from '../../src/modules/db.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Create Album uses an in-app dialog, not window.prompt', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('opens an in-app dialog styled like the rest of the app, with no native prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(getApp().querySelector('.modal-title').textContent).toBe('Create Album');
    expect(getApp().querySelector('.create-album-input')).not.toBeNull();

    promptSpy.mockRestore();
  });

  it('creates the album with a valid name', async () => {
    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = 'Fabric Scraps';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(async () => (await getAlbums()).some((a) => a.title === 'Fabric Scraps'));

    expect((await getAlbums()).some((a) => a.title === 'Fabric Scraps')).toBe(true);
  });

  it('rejects a blank name with a visible message and creates nothing', async () => {
    const before = (await getAlbums()).length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();
    expect(await getAlbums()).toHaveLength(before);
  });

  it('rejects a whitespace-only name the same way', async () => {
    const before = (await getAlbums()).length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '   ';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect(await getAlbums()).toHaveLength(before);
  });

  it('creates nothing when Cancel is clicked', async () => {
    const before = (await getAlbums()).length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('[data-action="create-album-cancel"]'));
    getApp().querySelector('[data-action="create-album-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(await getAlbums()).toHaveLength(before);
  });
});

describe('Create Album when today already has one', () => {
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  function goHome() {
    getApp().querySelector('[data-section="home"]').click();
  }

  async function createTodayAlbum(name) {
    goHome();
    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));
    getApp().querySelector('.create-album-input').value = name;
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(async () => (await getAlbums()).some((a) => a.title === name));
  }

  it('never silently no-ops: shows a dialog naming the existing album instead of discarding the new name', async () => {
    await createTodayAlbum('Morning Crafts');
    const countAfterFirst = (await getAlbums()).length;

    goHome();
    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));
    getApp().querySelector('.create-album-input').value = 'Afternoon Crafts';
    getApp().querySelector('[data-action="create-album-confirm"]').click();

    await waitFor(() => getApp().querySelector('.modal-title')?.textContent === 'Album already exists');
    expect(getApp().querySelector('.modal-content').textContent).toContain('Morning Crafts');

    // Cancelling leaves the existing album untouched and creates no duplicate.
    getApp().querySelector('[data-action="confirm-dialog-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    const albums = await getAlbums();
    expect(albums).toHaveLength(countAfterFirst);
    expect(albums.some((a) => a.album_date === today && a.title === 'Morning Crafts')).toBe(true);
    expect(albums.some((a) => a.title === 'Afternoon Crafts')).toBe(false);
  });

  it('lets the user rename the existing album instead of losing the new name entirely', async () => {
    await createTodayAlbum('Morning Crafts');
    const countAfterFirst = (await getAlbums()).length;
    const existing = (await getAlbums()).find((a) => a.album_date === today);

    goHome();
    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));
    getApp().querySelector('.create-album-input').value = 'Afternoon Crafts';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-confirm"]'));

    getApp().querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => getApp().querySelector('.modal-title')?.textContent === 'Rename Album');
    expect(getApp().querySelector('.create-album-input').value).toBe('Morning Crafts');

    getApp().querySelector('.create-album-input').value = 'Renamed Today';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(async () => (await getAlbums()).some((a) => a.title === 'Renamed Today'));

    const albums = await getAlbums();
    expect(albums).toHaveLength(countAfterFirst);
    const renamed = albums.find((a) => a.id === existing.id);
    expect(renamed.title).toBe('Renamed Today');
    expect(albums.some((a) => a.title === 'Morning Crafts')).toBe(false);
  });
});
