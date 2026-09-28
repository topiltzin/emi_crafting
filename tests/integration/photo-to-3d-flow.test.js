// End-to-end browser flow for spec 009-photo-to-3d-model against the fake Supabase backend.
// The standalone worker is simulated by editing the fake's rows the way the worker's RPCs would
// (claim → processing, complete → photos.model_* + completed).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/model-viewer-loader.js', () => ({
  isWebGLAvailable: () => true,
  loadModelViewer: async () => ({})
}));

import { initApp } from '../../src/app.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { getAllPhotos, deletePhoto } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

function getApp() {
  return document.getElementById('app');
}

// Fake timers let the 5 s status poll run instantly: each iteration jumps the clock 250 ms.
async function waitFor(conditionFn, timeoutMs = 3000) {
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += 250) {
    if (await conditionFn()) return;
    await vi.advanceTimersByTimeAsync(250);
  }
  throw new Error('waitFor timed out');
}

let fakeClient;

function workerClaims(job) {
  Object.assign(job, { status: 'processing', started_at: new Date().toISOString(), worker_id: 'w1' });
}

function workerCompletes(job) {
  const path = `owner-1/${job.photo_id}/model-${job.id}.glb`;
  fakeClient._storageObjects.add(`photos/${path}`);
  const photo = fakeClient._tables.photos.find((p) => p.id === job.photo_id);
  const oldPath = photo.model_storage_path;
  Object.assign(photo, {
    model_storage_path: path,
    model_file_size: 1234,
    model_generated_at: new Date().toISOString(),
    model_job_id: job.id
  });
  if (oldPath) fakeClient._storageObjects.delete(`photos/${oldPath}`);
  Object.assign(job, { status: 'completed', result_storage_path: path, result_file_size: 1234 });
  return path;
}

function workerFails(job, message) {
  Object.assign(job, { status: 'failed', error_code: 'SERVICE_BUSY', error_message: message });
}

function latestJob() {
  const jobs = fakeClient._tables.model_conversions;
  return jobs[jobs.length - 1];
}

async function openHomeViewer() {
  getApp().querySelector('[data-section="home"]').click();
  await waitFor(() => getApp().querySelector('.photo-card'));
  getApp().querySelector('.photo-card-media').click();
  await waitFor(() => getApp().querySelector('.photo-viewer-image'));
  await waitFor(() => getApp().querySelector('.model-3d-panel button'));
}

function closeViewer() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

async function uploadOne() {
  await uploadPhotos([
    new File(['x'], 'crane.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
  ]);
  const [photo] = await getAllPhotos();
  return photo;
}

describe('Photo → 3D model flow', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    document.body.innerHTML = '<div id="app"></div>';
    fakeClient = getCurrentFakeClient();
    await initApp();
  });

  afterEach(() => {
    closeViewer();
    vi.useRealTimers();
  });

  it('US1: uploading alone never starts a conversion (FR-002)', async () => {
    await uploadOne();
    expect(fakeClient._tables.model_conversions).toHaveLength(0);
  });

  it('US1+US2: convert → worker completes → badge + viewable 3D model', async () => {
    const photo = await uploadOne();
    await openHomeViewer();

    getApp().querySelector('[data-action="model-convert"]').click();
    await waitFor(() => getApp().querySelector('.model-3d-status'));
    expect(getApp().querySelector('[data-action="model-convert"]').disabled).toBe(true);

    const job = latestJob();
    expect(job).toMatchObject({ photo_id: photo.id, status: 'queued', seed: 0 });

    // Close mid-conversion and come back later (US1-4): the conversion lives on in the DB.
    closeViewer();
    workerClaims(job);
    await openHomeViewer();
    expect(getApp().querySelector('.model-3d-status')).not.toBeNull();

    const path = workerCompletes(job);
    await waitFor(() => getApp().querySelector('[data-action="model-view-3d"]'), 8000);

    getApp().querySelector('[data-action="model-view-3d"]').click();
    await waitFor(() => getApp().querySelector('model-viewer'));
    expect(getApp().querySelector('model-viewer').getAttribute('src')).toBe(
      `https://fake.local/storage/photos/${path}`
    );
    expect(getApp().querySelector('.photo-viewer-image').hidden).toBe(true);

    getApp().querySelector('[data-action="model-view-photo"]').click();
    expect(getApp().querySelector('.photo-viewer-image').hidden).toBe(false);

    // Gallery card shows the 3D badge after a re-render (FR-009).
    closeViewer();
    getApp().querySelector('[data-section="home"]').click();
    await waitFor(() => getApp().querySelector('.photo-card .model-badge'));
  });

  it('US3: failure → Try again → redo keeps the old model until the new one completes', async () => {
    const photo = await uploadOne();
    await openHomeViewer();

    getApp().querySelector('[data-action="model-convert"]').click();
    await waitFor(() => getApp().querySelector('.model-3d-status'));
    workerClaims(latestJob());
    workerFails(latestJob(), 'The 3D maker is busy right now. Try again in a little while.');
    await waitFor(() => getApp().querySelector('[data-action="model-retry"]'), 8000);
    expect(getApp().querySelector('.model-3d-panel [role="alert"]').textContent).toContain('busy');

    getApp().querySelector('[data-action="model-retry"]').click();
    await waitFor(() => getApp().querySelector('.model-3d-status'));
    const first = latestJob();
    workerClaims(first);
    const firstPath = workerCompletes(first);
    await waitFor(() => getApp().querySelector('[data-action="model-view-3d"]'), 8000);

    // Redo: old model stays viewable while the new job runs.
    getApp().querySelector('[data-action="model-menu"]').click();
    getApp().querySelector('[data-action="model-redo"]').click();
    await waitFor(() => getApp().querySelector('.model-3d-status'));
    expect(getApp().querySelector('[data-action="model-view-3d"]')).not.toBeNull();
    const redo = latestJob();
    expect(redo.is_redo).toBe(true);

    workerClaims(redo);
    const secondPath = workerCompletes(redo);
    await waitFor(() => !getApp().querySelector('.model-3d-status'), 8000);
    const row = fakeClient._tables.photos.find((p) => p.id === photo.id);
    expect(row.model_storage_path).toBe(secondPath);
    expect(fakeClient._storageObjects.has(`photos/${firstPath}`)).toBe(false);
  });

  it('US3: remove deletes the model and the badge; hard delete leaves no model files', async () => {
    const photo = await uploadOne();
    const job = { id: 'seeded', photo_id: photo.id };
    const path = workerCompletes(job);
    await openHomeViewer();

    getApp().querySelector('[data-action="model-menu"]').click();
    getApp().querySelector('[data-action="model-remove"]').click();
    await waitFor(() => document.querySelector('[data-action="confirm-dialog-confirm"]'));
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => getApp().querySelector('[data-action="model-convert"]'));
    expect(fakeClient._storageObjects.has(`photos/${path}`)).toBe(false);
    expect(fakeClient._storageObjects.has(`photos/${photo.storage_path}`)).toBe(true);

    // Hard delete with a model + an in-flight orphan.
    const again = workerCompletes({ id: 'again', photo_id: photo.id });
    fakeClient._storageObjects.add(`photos/owner-1/${photo.id}/model-orphan.glb`);
    closeViewer();
    await deletePhoto(photo.id, true);
    expect(fakeClient._storageObjects.has(`photos/${again}`)).toBe(false);
    expect(fakeClient._storageObjects.has(`photos/owner-1/${photo.id}/model-orphan.glb`)).toBe(false);
  });
});
