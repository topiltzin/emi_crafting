import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { getAllPhotos } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function metadataHandler(overrides = {}) {
  return () => ({
    data: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Beginner Blanket Tutorial',
      creator: "Rachel's Crafts",
      channelId: 'UCrachelcraftschannel000',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      duration: 1475,
      ...overrides
    }
  });
}

async function uploadAndOpenViewer() {
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

describe('Craft Tutorial Links: add/view/edit/delete flow', () => {
  let fakeClient;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    fakeClient = getCurrentFakeClient();
    await initApp();
  });

  it('shows the "Add Tutorial Link" CTA on a photo with no tutorial', async () => {
    await uploadAndOpenViewer();
    expect(getApp().querySelector('[data-action="tutorial-add"]')).not.toBeNull();
    expect(getApp().querySelector('.tutorial-card')).toBeNull();
  });

  it('adds a tutorial link: paste URL, preview loads, save persists and displays', async () => {
    await uploadAndOpenViewer();
    fakeClient._setFunctionHandler(metadataHandler());

    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));

    const input = getApp().querySelector('.tutorial-link-input');
    input.value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => !getApp().querySelector('.tutorial-link-preview').hidden, 3000);
    const saveBtn = getApp().querySelector('[data-action="tutorial-link-save"]');
    expect(saveBtn.disabled).toBe(false);

    saveBtn.click();
    await waitFor(() => getApp().querySelector('.tutorial-card'));

    const card = getApp().querySelector('.tutorial-card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.tutorial-card-title').textContent).toBe('Beginner Blanket Tutorial');
    expect(card.querySelector('.tutorial-card-link').href).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');

    const [photo] = await getAllPhotos();
    expect(photo.tutorial_link.videoId).toBe('dQw4w9WgXcQ');
  });

  it('shows a tutorial badge on the photo card after linking, once the gallery re-renders', async () => {
    await uploadAndOpenViewer();
    fakeClient._setFunctionHandler(metadataHandler());

    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));
    const input = getApp().querySelector('.tutorial-link-input');
    input.value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !getApp().querySelector('.tutorial-link-preview').hidden, 3000);
    getApp().querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-card'));

    getApp().querySelector('[data-action="dialog-close"]').click();
    getApp().querySelector('[data-section="home"]').click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    expect(getApp().querySelector('.tutorial-badge')).not.toBeNull();
  });

  it('edits an existing tutorial link to a different video', async () => {
    const photo = await uploadAndOpenViewer();
    fakeClient._setFunctionHandler(metadataHandler());
    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));
    getApp().querySelector('.tutorial-link-input').value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    getApp().querySelector('.tutorial-link-input').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !getApp().querySelector('.tutorial-link-preview').hidden, 3000);
    getApp().querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-card'));

    fakeClient._setFunctionHandler(
      metadataHandler({ videoId: 'abcdefghijk', title: 'A Different Tutorial' })
    );
    getApp().querySelector('[data-action="tutorial-edit"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));
    // Edit mode auto-fetches the prefilled URL's current metadata.
    await waitFor(() => {
      const preview = getApp().querySelector('.tutorial-link-preview');
      return preview && !preview.hidden;
    }, 3000);

    const input = getApp().querySelector('.tutorial-link-input');
    input.value = 'https://youtube.com/watch?v=abcdefghijk';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => {
      const preview = getApp().querySelector('.tutorial-link-preview');
      return preview && !preview.hidden && preview.textContent.includes('A Different Tutorial');
    }, 3000);

    getApp().querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(
      () => getApp().querySelector('.tutorial-card-title')?.textContent === 'A Different Tutorial'
    );

    const [reloaded] = (await getAllPhotos()).filter((p) => p.id === photo.id);
    expect(reloaded.tutorial_link.videoId).toBe('abcdefghijk');
  });

  it('removes a tutorial link after confirmation', async () => {
    await uploadAndOpenViewer();
    fakeClient._setFunctionHandler(metadataHandler());
    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));
    getApp().querySelector('.tutorial-link-input').value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    getApp().querySelector('.tutorial-link-input').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !getApp().querySelector('.tutorial-link-preview').hidden, 3000);
    getApp().querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-card'));

    getApp().querySelector('[data-action="tutorial-delete"]').click();
    await waitFor(() => getApp().querySelector('[data-action="confirm-dialog-confirm"]'));
    getApp().querySelector('[data-action="confirm-dialog-confirm"]').click();

    await waitFor(() => getApp().querySelector('[data-action="tutorial-add"]'));
    expect(getApp().querySelector('.tutorial-card')).toBeNull();

    const [photo] = await getAllPhotos();
    expect(photo.tutorial_link).toBeNull();
  });

  it('shows an inline error and keeps the modal open for an invalid URL', async () => {
    await uploadAndOpenViewer();
    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));

    const input = getApp().querySelector('.tutorial-link-input');
    input.value = 'https://example.com/not-youtube';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => !getApp().querySelector('.tutorial-link-error').hidden);
    expect(getApp().querySelector('.tutorial-link-error').textContent).toMatch(/valid YouTube URL/);
    expect(getApp().querySelector('[data-action="tutorial-link-save"]').disabled).toBe(true);
    // Modal must still be open — nothing was saved.
    expect(getApp().querySelector('.tutorial-link-modal')).not.toBeNull();
  });

  it('allows saving anyway when metadata fetch fails (fallback path)', async () => {
    await uploadAndOpenViewer();
    fakeClient._setFunctionHandler(() => ({
      errorBody: { error: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded.' }
    }));

    getApp().querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-link-input'));
    const input = getApp().querySelector('.tutorial-link-input');
    input.value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      const btn = getApp().querySelector('[data-action="tutorial-link-save"]');
      return btn && !btn.disabled && btn.textContent.includes('Save Anyway');
    }, 5000);

    getApp().querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-card'));

    expect(getApp().querySelector('.tutorial-card--pending')).not.toBeNull();
    const [photo] = await getAllPhotos();
    expect(photo.tutorial_link.metadataReady).toBe(false);
  });
});
