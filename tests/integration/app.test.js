import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { getAlbums, getAllPhotos, getPhotos } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

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
  while (!(await conditionFn()) && Date.now() < deadline) {
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

  it('opens an in-app dialog (not window.prompt) and creates a new album, then navigates to Albums', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');

    const createAlbumBtn = getApp().querySelector('[data-action="create-album"]');
    createAlbumBtn.click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(getApp().querySelector('.modal-title').textContent).toBe('Create Album');

    getApp().querySelector('.create-album-input').value = 'Paper Crafts';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await waitFor(() => getApp().querySelector('.app-nav-link.is-active')?.textContent.includes('Albums'));

    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
    const albums = await getAlbums();
    expect(albums.some((a) => a.title === 'Paper Crafts')).toBe(true);

    promptSpy.mockRestore();
  });

  it('does nothing when the create-album dialog is cancelled', async () => {
    const albumsBefore = (await getAlbums()).length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('[data-action="create-album-cancel"]'));
    getApp().querySelector('[data-action="create-album-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(await getAlbums()).toHaveLength(albumsBefore);
  });

  it('rejects a blank album name with a visible message and creates nothing', async () => {
    const albumsBefore = (await getAlbums()).length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.create-album-input'));

    getApp().querySelector('.create-album-input').value = '   ';
    getApp().querySelector('[data-action="create-album-confirm"]').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(getApp().querySelector('.create-album-error').hidden).toBe(false);
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();
    expect(await getAlbums()).toHaveLength(albumsBefore);
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
    while ((await getAllPhotos()).length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getApp().querySelector('.alert-success')).not.toBeNull();
    expect(await getAllPhotos()).toHaveLength(1);
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

  it('closes the upload modal on Escape without uploading anything', async () => {
    getApp().querySelector('[data-action="add-photos"]').click();
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(await getAllPhotos()).toHaveLength(0);
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

  it('adds a photo to the currently-open album via its own "+ Add Photos", even when the photo\'s date differs from the album\'s date', async () => {
    // Regression: "+ Add Photos" from inside an album used to ignore the open album entirely
    // and silently re-file the photo into whatever album matched its own EXIF/file date.
    const { createAlbum } = await import('../../src/modules/db.js');
    const openedAlbum = await createAlbum('2026-01-01', 'January Crafts');
    // A second, date-matching album exists too, so a mis-grouped photo has somewhere else to
    // silently land — proving it really did go into the opened album, not just "an" album.
    await createAlbum('2026-06-15');

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-card'));
    getApp().querySelector(`[data-action="view"][data-album-id="${openedAlbum.id}"]`).click();
    await waitFor(() => getApp().querySelector('.album-view'));

    getApp().querySelector('.album-header [data-action="add-photos"]').click();
    await waitFor(() => getApp().querySelector('.upload-zone'));

    const file = new File(['x'], 'different-date.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-06-15').getTime()
    });
    const zone = getApp().querySelector('.upload-zone');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    zone.dispatchEvent(dropEvent);
    getApp().querySelector('[data-action="confirm-upload"]').click();

    await waitFor(async () => (await getPhotos(openedAlbum.id)).length === 1);

    expect(await getPhotos(openedAlbum.id)).toHaveLength(1);
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 1);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(1);
  });

  it('deletes an album after confirmation — permanently, including its photos and Storage objects', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const [photo] = await getAllPhotos();
    const storageKeys = [`photos/owner-1/${photo.id}/original`, `photos/owner-1/${photo.id}/thumb`];
    const fakeClient = getCurrentFakeClient();
    expect(storageKeys.some((key) => fakeClient._storageObjects.has(key))).toBe(true);

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(await getAlbums()).toHaveLength(1);

    getApp().querySelector('[data-action="delete"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-confirm"]'));
    getApp().querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(async () => (await getAlbums()).length === 0);

    // Not just hidden from the Albums list — actually gone: the album, its photo, and the
    // photo's Storage objects (FR-001, FR-002; SC-001, SC-002), not merely soft-deleted.
    expect(await getAlbums()).toHaveLength(0);
    expect(await getAllPhotos()).toHaveLength(0);
    for (const key of storageKeys) {
      expect(fakeClient._storageObjects.has(key)).toBe(false);
    }
  });

  it('does not delete the album when the confirmation dialog is cancelled', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const [photo] = await getAllPhotos();
    const storageKeys = [`photos/owner-1/${photo.id}/original`, `photos/owner-1/${photo.id}/thumb`];
    const fakeClient = getCurrentFakeClient();

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));

    getApp().querySelector('[data-action="delete"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-cancel"]'));
    getApp().querySelector('[data-action="confirm-dialog-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));

    // Cancelling touches nothing — the album, its photo, and its Storage objects are all
    // still exactly as they were (FR-003; SC-003).
    expect(await getAlbums()).toHaveLength(1);
    expect(await getAllPhotos()).toHaveLength(1);
    for (const key of storageKeys) {
      expect(fakeClient._storageObjects.has(key)).toBe(true);
    }
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
