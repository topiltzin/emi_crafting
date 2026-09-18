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

describe('Create Album never collides, even when today already has one', () => {
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  function goHome() {
    getApp().querySelector('[data-section="home"]').click();
  }

  async function createAlbumByName(name) {
    goHome();
    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));
    getApp().querySelector('.create-album-input').value = name;
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(async () => (await getAlbums()).some((a) => a.title === name));
  }

  it('creates a second, distinctly-named album with no dialog or date to think about — the user just types a name', async () => {
    // The user never sees or picks a date, and there is no "already exists" dialog for this
    // flow at all — only a real title collision (same name, not just same date) is even possible.
    await createAlbumByName('test');
    const countAfterFirst = (await getAlbums()).length;

    await createAlbumByName('FOLDER');

    const albums = await getAlbums();
    expect(albums).toHaveLength(countAfterFirst + 1);
    expect(albums.some((a) => a.title === 'test')).toBe(true);
    expect(albums.some((a) => a.title === 'FOLDER')).toBe(true);
    // "test" is completely untouched by creating "FOLDER" afterward.
    expect(albums.find((a) => a.title === 'test').album_date).toBe(today);
  });

  it('silently claims the next free date when today is already taken, invisibly to the user', async () => {
    await createAlbumByName('test'); // takes today's date

    await createAlbumByName('FOLDER');

    const folder = (await getAlbums()).find((a) => a.title === 'FOLDER');
    expect(folder.album_date).not.toBe(today);
  });

  it('creating several named albums on the same day never triggers a collision dialog', async () => {
    await createAlbumByName('One');
    await createAlbumByName('Two');
    await createAlbumByName('Three');

    // No "Album already exists" dialog ever appears for any of these.
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    const albums = await getAlbums();
    expect(['One', 'Two', 'Three'].every((name) => albums.some((a) => a.title === name))).toBe(true);
    // Every album still has its own distinct date (the uniqueness constraint that made the
    // collision possible in the first place is satisfied silently, not surfaced to the user).
    const dates = albums.filter((a) => ['One', 'Two', 'Three'].includes(a.title)).map((a) => a.album_date);
    expect(new Set(dates).size).toBe(3);
  });
});
