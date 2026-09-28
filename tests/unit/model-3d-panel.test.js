import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// jsdom has no WebGL and can't load three.js — the loader is mocked per test.
vi.mock('../../src/modules/model-viewer-loader.js', () => ({
  isWebGLAvailable: vi.fn(() => true),
  loadModelViewer: vi.fn(async () => ({}))
}));
vi.mock('../../src/ui/confirm-dialog.js', () => ({
  showConfirmDialog: vi.fn(async () => true)
}));

import { isWebGLAvailable, loadModelViewer } from '../../src/modules/model-viewer-loader.js';
import { showConfirmDialog } from '../../src/ui/confirm-dialog.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import { createModel3dPanel } from '../../src/ui/model-3d-panel.js';
import { ACTIVE_JOB_TIMEOUT_MS } from '../../src/modules/model-conversion.js';

let fakeClient;
let photo;
let panel;
let photoImage;

async function flush(times = 4) {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function attachModel(p, jobId = 'job-a') {
  const path = `owner-1/${p.id}/model-${jobId}.glb`;
  const row = fakeClient._tables.photos.find((r) => r.id === p.id);
  Object.assign(row, {
    model_storage_path: path,
    model_file_size: 10,
    model_generated_at: new Date().toISOString(),
    model_job_id: jobId
  });
  fakeClient._storageObjects.add(`photos/${path}`);
  return { ...p, ...row };
}

function addJob(fields) {
  const row = {
    id: crypto.randomUUID(),
    owner_id: 'owner-1',
    photo_id: photo.id,
    status: 'queued',
    requested_at: new Date().toISOString(),
    error_message: null,
    ...fields
  };
  fakeClient._tables.model_conversions.push(row);
  return row;
}

function mount(p = photo, options = {}) {
  panel = createModel3dPanel(p, { getPhotoImage: () => photoImage, ...options });
  document.getElementById('app').appendChild(photoImage);
  document.getElementById('app').appendChild(panel.element);
  return panel;
}

const q = (selector) => panel.element.querySelector(selector);

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  fakeClient = getCurrentFakeClient();
  await initDB();
  const album = await createAlbum('2026-09-14');
  photo = await createPhoto(album.id, {
    filename: 'crane.jpg',
    file_size: 10,
    mime_type: 'image/jpeg',
    photo_data_base64: btoa('x')
  });
  photoImage = document.createElement('img');
  photoImage.className = 'photo-viewer-image';
  isWebGLAvailable.mockReturnValue(true);
  loadModelViewer.mockClear();
  showConfirmDialog.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  if (panel) panel.destroy();
  vi.useRealTimers();
});

describe('US1 — convert', () => {
  it('offers "Make it 3D" with the tip when there is no model', async () => {
    mount();
    await flush();
    const btn = q('[data-action="model-convert"]');
    expect(btn.textContent).toContain('Make it 3D');
    expect(btn.disabled).toBe(false);
    expect(q('.model-3d-tip').textContent).toContain('one object on a plain background');
    expect(q('.model-3d-tip').textContent).toContain('external 3D service');
  });

  it('starts a conversion and shows the working status with a disabled button', async () => {
    mount();
    await flush();
    q('[data-action="model-convert"]').click();
    await flush();

    expect(fakeClient._tables.model_conversions).toHaveLength(1);
    expect(q('[data-action="model-convert"]').disabled).toBe(true);
    const status = q('.model-3d-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('this can take a few minutes');
  });

  it('shows the request error when the limit is reached', async () => {
    fakeClient._registerRpc('request_model_conversion', () => ({
      data: null,
      error: { message: 'CONVERSION_LIMIT', code: 'P0001' }
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount();
    await flush();
    q('[data-action="model-convert"]').click();
    await flush();
    expect(q('[role="alert"]').textContent).toContain('3 models cooking');
    expect(q('[data-action="model-convert"]').disabled).toBe(false);
  });

  it('resumes an in-progress job on mount and picks up completion by polling', async () => {
    vi.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
    const running = addJob({ status: 'processing', started_at: new Date().toISOString() });
    const onPhotoChange = vi.fn();
    mount(photo, { onPhotoChange });
    await vi.advanceTimersByTimeAsync(0);
    expect(q('.model-3d-status')).not.toBeNull();

    attachModel(photo, running.id);
    running.status = 'completed';
    await vi.advanceTimersByTimeAsync(5000);
    await flush();

    expect(onPhotoChange).toHaveBeenCalledWith(
      expect.objectContaining({ model_storage_path: expect.any(String) })
    );
    expect(q('.model-3d-status')).toBeNull();
    expect(q('[data-action="model-view-3d"]')).not.toBeNull();
  });

  it('stops polling once destroyed', async () => {
    vi.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
    addJob({ status: 'queued' });
    mount();
    await vi.advanceTimersByTimeAsync(0);
    panel.destroy();
    const before = fakeClient._tables.model_conversions[0].status;
    fakeClient._tables.model_conversions[0].status = 'completed';
    await vi.advanceTimersByTimeAsync(10_000);
    expect(q('.model-3d-status')).not.toBeNull(); // no re-render after destroy
    expect(before).toBe('queued');
  });
});

describe('US2 — view', () => {
  it('shows a Photo/3D toggle with aria-pressed when a model exists', async () => {
    mount(attachModel(photo));
    await flush();
    const photoBtn = q('[data-action="model-view-photo"]');
    const modelBtn = q('[data-action="model-view-3d"]');
    expect(photoBtn.getAttribute('aria-pressed')).toBe('true');
    expect(modelBtn.getAttribute('aria-pressed')).toBe('false');
    expect(q('[data-action="model-convert"]')).toBeNull();
  });

  it('switching to 3D lazy-loads the viewer with the signed URL and hides the photo', async () => {
    const withModel = attachModel(photo);
    mount(withModel);
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();

    expect(loadModelViewer).toHaveBeenCalledTimes(1);
    const viewer = q('model-viewer');
    expect(viewer.getAttribute('src')).toBe(
      `https://fake.local/storage/photos/${withModel.model_storage_path}`
    );
    expect(viewer.hasAttribute('camera-controls')).toBe(true);
    expect(viewer.getAttribute('touch-action')).toBe('pan-y');
    expect(viewer.hasAttribute('auto-rotate')).toBe(true);
    expect(viewer.getAttribute('alt')).toBe('3D model of crane.jpg');
    expect(photoImage.hidden).toBe(true);
    expect(q('[data-action="model-view-3d"]').getAttribute('aria-pressed')).toBe('true');

    expect(q('.model-3d-loading')).not.toBeNull();
    expect(q('[data-action="model-reset-view"]').disabled).toBe(true);
    viewer.dispatchEvent(new Event('load'));
    expect(q('.model-3d-loading')).toBeNull();
    expect(q('[data-action="model-reset-view"]').disabled).toBe(false);
  });

  it('reset view recenters the camera', async () => {
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();
    const viewer = q('model-viewer');
    viewer.jumpCameraToGoal = vi.fn();
    viewer.dispatchEvent(new Event('load'));
    q('[data-action="model-reset-view"]').click();
    expect(viewer.cameraOrbit).toBe('auto auto auto');
    expect(viewer.fieldOfView).toBe('auto');
    expect(viewer.jumpCameraToGoal).toHaveBeenCalled();
  });

  it('switching back to Photo restores the image', async () => {
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();
    q('[data-action="model-view-photo"]').click();
    expect(photoImage.hidden).toBe(false);
    expect(q('model-viewer')).toBeNull();
  });

  it('falls back to the photo when WebGL is unavailable', async () => {
    isWebGLAvailable.mockReturnValue(false);
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();
    expect(q('.model-3d-fallback').textContent).toBe(
      "Your device can't show 3D models, but here's the photo!"
    );
    expect(loadModelViewer).not.toHaveBeenCalled();
    expect(photoImage.hidden).toBe(false);
  });

  it('shows a load error with Redo when the model fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();
    q('model-viewer').dispatchEvent(new Event('error'));
    expect(q('.model-3d-stage [role="alert"]').textContent).toBe("This 3D model couldn't be loaded.");
    expect(q('.model-3d-stage [data-action="model-redo"]')).not.toBeNull();
    expect(photoImage.hidden).toBe(false);
  });

  it('shows a load error when the viewer chunk fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadModelViewer.mockRejectedValueOnce(new Error('chunk failed'));
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-view-3d"]').click();
    await flush();
    expect(q('.model-3d-stage [role="alert"]')).not.toBeNull();
  });
});

describe('US3 — failures, redo, remove', () => {
  it('shows the worker message and Try again for a failed job', async () => {
    addJob({
      status: 'failed',
      error_code: 'SERVICE_QUOTA',
      error_message: 'The 3D maker is out of energy for today — try again later.'
    });
    mount();
    await flush();
    expect(q('[role="alert"]').textContent).toBe(
      'The 3D maker is out of energy for today — try again later.'
    );
    q('[data-action="model-retry"]').click();
    await flush();
    const jobs = fakeClient._tables.model_conversions;
    expect(jobs[jobs.length - 1].status).toBe('queued');
    expect(q('.model-3d-status')).not.toBeNull();
  });

  it('treats a stale active job as failed with the timeout message', async () => {
    addJob({
      status: 'processing',
      requested_at: new Date(Date.now() - ACTIVE_JOB_TIMEOUT_MS - 1000).toISOString()
    });
    mount();
    await flush();
    expect(q('[role="alert"]').textContent).toBe('This one took too long. Want to try again?');
    expect(q('[data-action="model-retry"]')).not.toBeNull();
  });

  it('keeps the existing model viewable while a failed redo is shown', async () => {
    const withModel = attachModel(photo);
    addJob({
      status: 'failed',
      error_code: 'TIMEOUT',
      error_message: 'This one took too long. Want to try again?'
    });
    mount(withModel);
    await flush();
    expect(q('[data-action="model-view-3d"]')).not.toBeNull();
    expect(q('[role="alert"]')).not.toBeNull();
  });

  it('menu offers Redo / Download / Remove and toggles open with Escape to close', async () => {
    mount(attachModel(photo));
    await flush();
    const trigger = q('[data-action="model-menu"]');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    const menu = q('[role="menu"]');
    expect(menu.hidden).toBe(true);
    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
    expect(labels).toEqual(['Redo 3D model', 'Download 3D model', 'Remove 3D model']);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
  });

  it('redo keeps the toggle usable while processing', async () => {
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-menu"]').click();
    q('[data-action="model-redo"]').click();
    await flush();
    const jobs = fakeClient._tables.model_conversions;
    expect(jobs[jobs.length - 1].is_redo).toBe(true);
    expect(q('.model-3d-status')).not.toBeNull();
    expect(q('[data-action="model-view-3d"]').disabled).toBe(false);
    q('[data-action="model-menu"]').click();
    expect(q('[data-action="model-redo"]').disabled).toBe(true);
    expect(q('[data-action="model-remove"]').disabled).toBe(true);
  });

  it('remove asks for confirmation, then deletes the model', async () => {
    const withModel = attachModel(photo);
    const onPhotoChange = vi.fn();
    mount(withModel, { onPhotoChange });
    await flush();
    q('[data-action="model-menu"]').click();
    q('[data-action="model-remove"]').click();
    await flush();
    expect(showConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Remove 3D model?', confirmLabel: 'Remove' })
    );
    expect(onPhotoChange).toHaveBeenCalledWith(expect.objectContaining({ model_storage_path: null }));
    expect(fakeClient._storageObjects.has(`photos/${withModel.model_storage_path}`)).toBe(false);
    expect(q('[data-action="model-convert"]')).not.toBeNull();
  });

  it('remove does nothing when cancelled', async () => {
    showConfirmDialog.mockResolvedValue(false);
    const withModel = attachModel(photo);
    mount(withModel);
    await flush();
    q('[data-action="model-menu"]').click();
    q('[data-action="model-remove"]').click();
    await flush();
    expect(fakeClient._storageObjects.has(`photos/${withModel.model_storage_path}`)).toBe(true);
    expect(q('[data-action="model-view-3d"]')).not.toBeNull();
  });

  it('remove failure shows an alert and keeps the model', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const withModel = attachModel(photo);
    mount(withModel);
    await flush();
    fakeClient._failNextStorageRemoves(1);
    q('[data-action="model-menu"]').click();
    q('[data-action="model-remove"]').click();
    await flush();
    expect(q('[role="alert"]').textContent).toContain("Couldn't remove");
    expect(q('[data-action="model-view-3d"]')).not.toBeNull();
  });
});

describe('US4 — download', () => {
  it('downloads through a signed URL named after the photo', async () => {
    const clicks = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicks.push(this.href);
    });
    mount(attachModel(photo));
    await flush();
    q('[data-action="model-menu"]').click();
    q('[data-action="model-download"]').click();
    await flush();
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toContain('download=crane-3d.glb');
    expect(document.querySelector('a[download]')).toBeNull();
    spy.mockRestore();
  });

  it('shows an alert when the download cannot be prepared', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const withModel = attachModel(photo);
    fakeClient._storageObjects.delete(`photos/${withModel.model_storage_path}`);
    mount(withModel);
    await flush();
    q('[data-action="model-menu"]').click();
    q('[data-action="model-download"]').click();
    await flush();
    expect(q('[role="alert"]').textContent).toContain("Couldn't download");
  });
});
