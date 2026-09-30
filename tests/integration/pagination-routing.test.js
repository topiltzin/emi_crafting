import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function seedPhotos(albumId, count) {
  for (let i = 0; i < count; i++) {
    await createPhoto(albumId, {
      filename: `craft-${i}.jpg`,
      file_size: 1,
      mime_type: 'image/jpeg',
      photo_date: '2026-05-01',
      photo_blob: new Blob(['x'], { type: 'image/jpeg' }),
      thumbnail_blob: new Blob(['t'], { type: 'image/jpeg' })
    });
  }
}

async function boot(hash = '') {
  history.replaceState(null, '', `/${hash}`);
  document.body.innerHTML = '<div id="app"></div>';
  await initApp();
}

describe('Paged galleries', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('shows 50 photos, then the rest behind "Load more"', async () => {
    const album = await createAlbum('2026-05-01', 'Big album');
    await seedPhotos(album.id, 55);

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('.photo-card'));
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(50);

    getApp().querySelector('.load-more button').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 55);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(55);
    expect(getApp().querySelector('.load-more')).toBeNull();
  });

  it('pages inside an album too', async () => {
    const album = await createAlbum('2026-05-01', 'Big album');
    await seedPhotos(album.id, 52);

    await boot(`#/albums/${album.id}`);
    await waitFor(() => getApp().querySelector('.album-view .photo-card'));
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(50);

    getApp().querySelector('.load-more button').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 52);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(52);
  });

  it('has no "Load more" when everything fits on one page', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 3);

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('.photo-card'));
    expect(getApp().querySelector('.load-more')).toBeNull();
  });
});

describe('Hash routing', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('records sections and albums in the URL', async () => {
    const album = await createAlbum('2026-05-01', 'Paper');
    await boot();
    expect(window.location.hash).toBe('#/home');

    getApp().querySelector('[data-section="albums"]').click();
    await waitFor(() => getApp().querySelector('.album-card'));
    expect(window.location.hash).toBe('#/albums');

    getApp().querySelector(`[data-action="view"][data-album-id="${album.id}"]`).click();
    await waitFor(() => getApp().querySelector('.album-view'));
    expect(window.location.hash).toBe(`#/albums/${album.id}`);
  });

  it('restores a section and an album from the URL on load', async () => {
    const album = await createAlbum('2026-05-01', 'Paper');

    await boot('#/favorites');
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Favorites');

    await boot(`#/albums/${album.id}`);
    await waitFor(() => getApp().querySelector('.album-view'));
    expect(getApp().querySelector('.album-header h2').textContent).toBe('Paper');
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
  });

  it('re-renders from the URL on Back/Forward', async () => {
    await boot('#/photos');
    getApp().querySelector('[data-section="settings"]').click();
    await waitFor(() => window.location.hash === '#/settings');

    history.replaceState(null, '', '/#/albums');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
  });

  it('falls back to the album list for a link to an album that no longer exists', async () => {
    await boot('#/albums/does-not-exist');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(window.location.hash).toBe('#/albums');
    expect(getApp().querySelector('.alert-error')).toBeNull();
  });

  it('treats an unknown route as Home', async () => {
    await boot('#/nope');
    expect(window.location.hash).toBe('#/home');
  });
});

describe('Photo deletion', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('deleting from the gallery removes the photo row and its files for good', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 1);
    const fake = getCurrentFakeClient();

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('[data-action="delete-photo"]'));
    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => document.querySelector('[data-action="confirm-dialog-confirm"]'));
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => fake._tables.photos.length === 0);

    expect(fake._tables.photos).toHaveLength(0);
    expect(fake._storageObjects.size).toBe(0);
  });
});
