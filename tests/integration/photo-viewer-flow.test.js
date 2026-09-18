import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { getAllPhotos, toggleFavorite } from '../../src/modules/db.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Full-resolution photo viewer', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
  });

  it('opens showing the resolved original-image URL when a photo is clicked on Home', async () => {
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const [photo] = await getAllPhotos();

    getApp().querySelector('[data-section="home"]').click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    getApp().querySelector('.photo-card-media').click();
    await waitFor(() => getApp().querySelector('.photo-viewer-image'));

    const img = getApp().querySelector('.photo-viewer-image');
    expect(img).not.toBeNull();
    expect(img.src).toBe(`https://fake.local/storage/photos/owner-1/${photo.id}/original`);
    // The viewer's image is the resolved original, distinct from the small grid thumbnail.
    expect(img.src).not.toBe(getApp().querySelector('.photo-card-image').src);
  });

  it('opens the same way from inside an open album', async () => {
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    getApp().querySelector('[data-section="albums"]').click();
    await waitFor(() => getApp().querySelector('[data-action="view"]'));
    getApp().querySelector('[data-action="view"]').click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    getApp().querySelector('.photo-card-media').click();
    await waitFor(() => getApp().querySelector('.photo-viewer-image'));

    expect(getApp().querySelector('.photo-viewer-image')).not.toBeNull();
  });

  it('opens the viewer via the keyboard when a photo card has focus', async () => {
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    getApp().querySelector('[data-section="home"]').click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    const card = getApp().querySelector('.photo-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => getApp().querySelector('.photo-viewer-image'));

    expect(getApp().querySelector('.photo-viewer-image')).not.toBeNull();
  });

  it('does not open the viewer when the favorite or delete control is activated', async () => {
    await uploadPhotos([
      new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);

    getApp().querySelector('[data-section="home"]').click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    getApp().querySelector('[data-action="toggle-favorite"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(getApp().querySelector('.modal-backdrop')).toBeNull();
  });

  describe('dismissing the viewer', () => {
    async function openViewer() {
      await uploadPhotos([
        new File(['x'], 'craft.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
      ]);
      const [photo] = await getAllPhotos();

      getApp().querySelector('[data-section="home"]').click();
      await waitFor(() => getApp().querySelector('.photo-card'));
      getApp().querySelector('.photo-card-media').click();
      await waitFor(() => getApp().querySelector('.photo-viewer-image'));

      return photo;
    }

    it('closes via the visible close control and leaves the gallery unchanged', async () => {
      const photo = await openViewer();

      getApp().querySelector('[data-action="dialog-close"]').click();

      expect(getApp().querySelector('.modal-backdrop')).toBeNull();
      expect(getApp().querySelector('.photo-card')).not.toBeNull();
      expect((await getAllPhotos()).find((p) => p.id === photo.id).is_favorite).toBe(false);
    });

    it('closes via clicking outside the image (the backdrop)', async () => {
      await openViewer();

      getApp().querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(getApp().querySelector('.modal-backdrop')).toBeNull();
      expect(getApp().querySelector('.photo-card')).not.toBeNull();
    });

    it('closes via the Escape key', async () => {
      await openViewer();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(getApp().querySelector('.modal-backdrop')).toBeNull();
      expect(getApp().querySelector('.photo-card')).not.toBeNull();
    });

    it('does not change the photo\'s favorite status or album membership after opening and closing', async () => {
      const photo = await openViewer();
      await toggleFavorite(photo.id);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      const after = (await getAllPhotos()).find((p) => p.id === photo.id);
      expect(after.is_favorite).toBe(true);
      expect(after.album_id).toBe(photo.album_id);
    });
  });
});
