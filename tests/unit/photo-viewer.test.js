import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openPhotoViewer } from '../../src/ui/photo-viewer.js';
import { initDB, createAlbum, createPhoto, getPhoto } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('openPhotoViewer', () => {
  let fakeClient;
  let photo;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    fakeClient = getCurrentFakeClient();
    await initDB();
    const album = await createAlbum('2026-09-14');
    photo = await createPhoto(album.id, {
      filename: 'full-res.jpg',
      file_size: 2048,
      mime_type: 'image/jpeg',
      photo_data_base64: btoa('original data')
    });
  });

  it('shows a loading state immediately, then replaces it with the resolved image', async () => {
    openPhotoViewer(photo);

    expect(document.querySelector('.photo-viewer-loading')).not.toBeNull();
    expect(document.querySelector('.photo-viewer-image')).toBeNull();

    await flushMicrotasks();

    expect(document.querySelector('.photo-viewer-loading')).toBeNull();
    const img = document.querySelector('.photo-viewer-image');
    expect(img).not.toBeNull();
    expect(img.src).toBe(`https://fake.local/storage/photos/owner-1/${photo.id}/original`);
  });

  it('shows a clear, user-readable error message when resolution fails', async () => {
    fakeClient._setNetworkDown(true);
    openPhotoViewer(photo);

    await flushMicrotasks();

    expect(document.querySelector('.photo-viewer-loading')).toBeNull();
    expect(document.querySelector('.photo-viewer-image')).toBeNull();
    const errorEl = document.querySelector('.photo-viewer-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("Can't load this photo right now — check your connection and try again.");
  });

  it('returns a { close } handle matching openDialog\'s shape', async () => {
    const { close } = openPhotoViewer(photo);
    expect(typeof close).toBe('function');

    close();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('opening and closing issues no data-layer write — the photo row is unchanged (FR-007)', async () => {
    const before = await getPhoto(photo.id);
    const { close } = openPhotoViewer(photo);
    await flushMicrotasks();

    close();

    const after = await getPhoto(photo.id);
    expect(after.updated_at).toBe(before.updated_at);
    expect(after.is_favorite).toBe(before.is_favorite);
    expect(after.album_id).toBe(before.album_id);
  });

  it('renders inside the existing modal/dialog structure with a photo-viewer class', () => {
    openPhotoViewer(photo);

    const modal = document.querySelector('.modal');
    expect(modal).not.toBeNull();
    expect(modal.classList.contains('photo-viewer')).toBe(true);
    expect(document.querySelector('[data-action="dialog-close"]')).not.toBeNull();
  });
});

describe('openPhotoViewer — 3D model panel (spec 009)', () => {
  let fakeClient;
  let photo;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    fakeClient = getCurrentFakeClient();
    await initDB();
    const album = await createAlbum('2026-09-15');
    photo = await createPhoto(album.id, {
      filename: 'craft.jpg',
      file_size: 10,
      mime_type: 'image/jpeg',
      photo_data_base64: btoa('x')
    });
  });

  it('mounts the 3D panel between the photo and the tutorial section', async () => {
    openPhotoViewer(photo);
    await flushMicrotasks();
    const content = document.querySelector('.photo-viewer-content');
    const children = [...content.children].map((c) => c.className);
    expect(children).toEqual(['photo-viewer-image', 'model-3d-slot', 'photo-viewer-tutorial']);
    expect(content.querySelector('.model-3d-slot > .model-3d-panel')).not.toBeNull();
    expect(content.querySelector('[data-action="model-convert"]')).not.toBeNull();
  });

  it('stops polling a running conversion when the viewer is dismissed', async () => {
    vi.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
    try {
      fakeClient._tables.model_conversions.push({
        id: 'j1',
        owner_id: 'owner-1',
        photo_id: photo.id,
        status: 'processing',
        requested_at: new Date().toISOString()
      });
      openPhotoViewer(photo);
      await vi.advanceTimersByTimeAsync(0);
      const fromSpy = vi.spyOn(fakeClient, 'from');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await vi.advanceTimersByTimeAsync(20_000);

      expect(fromSpy.mock.calls.filter(([table]) => table === 'model_conversions')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
