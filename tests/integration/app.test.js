import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { getAlbums, getAllPhotos } from '../../src/modules/db.js';

function getApp() {
  return document.getElementById('app');
}

function clickNav(label) {
  const links = Array.from(getApp().querySelectorAll('.app-nav-link'));
  const link = links.find((el) => el.textContent.includes(label));
  link.click();
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!conditionFn() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('App shell & navigation', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('boots to the Home section with a nav, hero, and photos empty state', () => {
    const app = getApp();
    expect(app.querySelector('.app-nav')).not.toBeNull();
    expect(app.querySelector('.app-nav-link.is-active').textContent).toContain('Home');
    expect(app.querySelector('.hero-title').textContent).toBe("Emi's Craft House");
    expect(app.querySelector('.empty-state')).not.toBeNull();
  });

  it('navigates to My Photos, Albums, Favorites, and Settings via the nav bar', async () => {
    clickNav('My Photos');
    await waitFor(() => !getApp().querySelector('.hero-title'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('My Photos');
    expect(getApp().querySelector('.hero-title')).toBeNull();

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
    expect(getApp().querySelector('.album-grid')).not.toBeNull();

    clickNav('Favorites');
    await waitFor(() => getApp().querySelector('.empty-state-heading'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Favorites');
    expect(getApp().querySelector('.empty-state-heading').textContent).toBe('No favorites yet!');

    clickNav('Settings');
    await waitFor(() => getApp().querySelector('.settings-view'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Settings');
    expect(getApp().querySelector('.settings-view')).not.toBeNull();
  });

  it('collapses the mobile menu after choosing a section', async () => {
    const toggle = getApp().querySelector('.app-nav-toggle');
    toggle.click();
    expect(getApp().querySelector('.app-nav-list').classList.contains('is-open')).toBe(true);

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(getApp().querySelector('.app-nav-list').classList.contains('is-open')).toBe(false);
  });
});

describe('Creating an album from the hero', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('prompts for a title and creates a new album, then navigates to Albums', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Paper Crafts');

    const createAlbumBtn = getApp().querySelector('[data-action="create-album"]');
    createAlbumBtn.click();
    await waitFor(() => getApp().querySelector('.app-nav-link.is-active')?.textContent.includes('Albums'));

    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
    const albums = getAlbums();
    expect(albums.some((a) => a.title === 'Paper Crafts')).toBe(true);

    window.prompt.mockRestore();
  });

  it('does nothing when the album title prompt is cancelled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const albumsBefore = getAlbums().length;

    getApp().querySelector('[data-action="create-album"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getAlbums()).toHaveLength(albumsBefore);
    window.prompt.mockRestore();
  });
});

describe('Uploading photos through the modal', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('opens the upload modal from the hero, uploads a photo, and shows a success status', async () => {
    getApp().querySelector('[data-action="add-photos"]').click();

    const modal = getApp().querySelector('.modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('.modal-title').textContent).toBe('Add Photos');

    const zone = modal.querySelector('.upload-zone');
    const file = new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() });
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    zone.dispatchEvent(dropEvent);

    modal.querySelector('[data-action="confirm-upload"]').click();

    const deadline = Date.now() + 2000;
    while (getAllPhotos().length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getApp().querySelector('.alert-success')).not.toBeNull();
    expect(getAllPhotos()).toHaveLength(1);
  });

  it('closes the upload modal when Cancel is clicked', () => {
    getApp().querySelector('[data-action="add-photos"]').click();
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();

    getApp().querySelector('[data-action="cancel-upload"]').click();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
  });

  it('closes the upload modal when clicking the backdrop', () => {
    getApp().querySelector('[data-action="add-photos"]').click();
    const backdrop = getApp().querySelector('.modal-backdrop');

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
  });
});

describe('Album detail view and deletion', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('opens an album, shows its photos, and returns to Albums via the back button', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));

    getApp().querySelector('[data-action="view"]').click();
    await waitFor(() => getApp().querySelector('.album-view'));

    expect(getApp().querySelector('.album-view')).not.toBeNull();
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(1);

    getApp().querySelector('[data-action="back"]').click();
    await waitFor(() => getApp().querySelector('.album-grid'));

    expect(getApp().querySelector('.album-grid')).not.toBeNull();
  });

  it('deletes an album after confirmation', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(getAlbums()).toHaveLength(1);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getApp().querySelector('[data-action="delete"]').click();
    await waitFor(() => getAlbums().length === 0);

    expect(getAlbums()).toHaveLength(0);
    window.confirm.mockRestore();
  });
});

describe('Favoriting from the gallery', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('toggles a photo favorite from the Home gallery and reflects it in Favorites', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    clickNav('Home');
    await waitFor(() => getApp().querySelector('.photo-card-favorite'));

    const heart = getApp().querySelector('.photo-card-favorite');
    heart.click();
    await waitFor(() => heart.classList.contains('is-favorite'));

    expect(heart.classList.contains('is-favorite')).toBe(true);

    clickNav('Favorites');
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 1);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(1);
  });
});
