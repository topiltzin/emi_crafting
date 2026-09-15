import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { getAlbums } from '../../src/modules/db.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!conditionFn() && Date.now() < deadline) {
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
    await waitFor(() => getAlbums().some((a) => a.title === 'Fabric Scraps'));

    expect(getAlbums().some((a) => a.title === 'Fabric Scraps')).toBe(true);
  });

  it('rejects a blank name with a visible message and creates nothing', async () => {
    const before = getAlbums().length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();
    expect(getAlbums()).toHaveLength(before);
  });

  it('rejects a whitespace-only name the same way', async () => {
    const before = getAlbums().length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '   ';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect(getAlbums()).toHaveLength(before);
  });

  it('creates nothing when Cancel is clicked', async () => {
    const before = getAlbums().length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('[data-action="create-album-cancel"]'));
    getApp().querySelector('[data-action="create-album-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAlbums()).toHaveLength(before);
  });
});
