import { describe, it, expect, beforeEach } from 'vitest';
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

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('Every dialog closes on Escape or its visible close button, with no side effect', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('the Add Photos dialog: Escape and the close button both close it without uploading', async () => {
    getApp().querySelector('[data-action="add-photos"]').click();
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();

    pressEscape();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAllPhotos()).toHaveLength(0);

    getApp().querySelector('[data-action="add-photos"]').click();
    expect(getApp().querySelector('.modal-backdrop')).not.toBeNull();

    getApp().querySelector('[data-action="dialog-close"]').click();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAllPhotos()).toHaveLength(0);
  });

  it('the Create Album dialog: Escape and the close button both close it without creating anything', async () => {
    const before = getAlbums().length;

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    pressEscape();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAlbums()).toHaveLength(before);

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    getApp().querySelector('[data-action="dialog-close"]').click();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAlbums()).toHaveLength(before);
  });

  it('the delete-confirmation dialog: Escape and the close button both close it without deleting anything', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    clickNav('My Photos');
    await waitFor(() => getApp().querySelector('[data-action="delete-photo"]'));

    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    pressEscape();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAllPhotos()).toHaveLength(1);

    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    getApp().querySelector('[data-action="dialog-close"]').click();
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
    expect(getAllPhotos()).toHaveLength(1);
  });

  it('every dialog presents a visible close control distinct from its named Cancel button', async () => {
    getApp().querySelector('[data-action="add-photos"]').click();
    expect(getApp().querySelector('[data-action="dialog-close"]')).not.toBeNull();
    expect(getApp().querySelector('[data-action="cancel-upload"]')).not.toBeNull();
    pressEscape();

    getApp().querySelector('[data-action="create-album"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));
    expect(getApp().querySelector('[data-action="dialog-close"]')).not.toBeNull();
    expect(getApp().querySelector('[data-action="create-album-cancel"]')).not.toBeNull();
  });
});
