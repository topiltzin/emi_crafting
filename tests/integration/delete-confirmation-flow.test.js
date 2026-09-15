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

describe('Delete confirmation uses an in-app dialog, not window.confirm', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('deleting a photo shows an in-app dialog naming it, cancel leaves it untouched, confirm removes it', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'sunset-quilt.jpg', {
        type: 'image/jpeg',
        lastModified: new Date('2026-09-14').getTime()
      })
    ]);

    const confirmSpy = vi.spyOn(window, 'confirm');

    clickNav('My Photos');
    await waitFor(() => getApp().querySelector('[data-action="delete-photo"]'));

    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(getApp().querySelector('.modal-title').textContent).toBe('Delete photo?');
    expect(getApp().querySelector('.confirm-dialog-message').textContent).toContain('sunset-quilt.jpg');

    // Scenario: cancel leaves the photo untouched.
    getApp().querySelector('[data-action="confirm-dialog-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(getAllPhotos()).toHaveLength(1);

    // Scenario: confirm removes it.
    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-confirm"]'));
    getApp().querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => getAllPhotos().length === 0);

    expect(getAllPhotos()).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('deleting an album states how many photos will be removed, and requires confirmation', async () => {
    const { uploadPhotos } = await import('../../src/modules/photo.js');
    await uploadPhotos([
      new File(['x'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() }),
      new File(['y'], 'b.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    const confirmSpy = vi.spyOn(window, 'confirm');

    clickNav('Albums');
    await waitFor(() => getApp().querySelector('.album-grid'));

    getApp().querySelector('[data-action="delete"]').click();
    await waitFor(() => getApp().querySelector('.modal-backdrop'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(getApp().querySelector('.modal-title').textContent).toBe('Delete album?');
    expect(getApp().querySelector('.confirm-dialog-message').textContent).toContain('2 photos');

    // Cancel: album untouched.
    getApp().querySelector('[data-action="confirm-dialog-cancel"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(getAlbums()).toHaveLength(1);

    // Confirm: album removed.
    getApp().querySelector('[data-action="delete"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-confirm"]'));
    getApp().querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => getAlbums().length === 0);

    expect(getAlbums()).toHaveLength(0);
    confirmSpy.mockRestore();
  });
});
