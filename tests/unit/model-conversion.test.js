import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import {
  ACTIVE_JOB_TIMEOUT_MS,
  requestConversion,
  describeRequestError,
  getLatestConversion,
  getDisplayStatus,
  isFailedJob,
  describeConversionError,
  watchConversion,
  getModelUrl,
  getModelDownloadUrl,
  modelDownloadName,
  removeModel
} from '../../src/modules/model-conversion.js';

let fakeClient;

async function seedPhoto(filename = 'Paper Crane.jpg') {
  const album = await createAlbum(
    `2026-09-${String(((seedPhoto.n = (seedPhoto.n || 0) + 1) % 28) + 1).padStart(2, '0')}`
  );
  return createPhoto(album.id, {
    filename,
    file_size: 1024,
    mime_type: 'image/jpeg',
    photo_data_base64: btoa('bytes')
  });
}

function attachModel(photo, jobId = 'job-a') {
  const path = `owner-1/${photo.id}/model-${jobId}.glb`;
  const row = fakeClient._tables.photos.find((p) => p.id === photo.id);
  Object.assign(row, {
    model_storage_path: path,
    model_file_size: 2048,
    model_generated_at: new Date().toISOString(),
    model_job_id: jobId
  });
  fakeClient._storageObjects.add(`photos/${path}`);
  return { ...photo, ...row };
}

function job(overrides = {}) {
  return { id: 'j', status: 'queued', requested_at: new Date().toISOString(), ...overrides };
}

beforeEach(async () => {
  fakeClient = getCurrentFakeClient();
  await initDB();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('requestConversion', () => {
  it('queues a job with seed 0 for a first conversion', async () => {
    const photo = await seedPhoto();
    const created = await requestConversion(photo.id);
    expect(created).toMatchObject({ photo_id: photo.id, status: 'queued', seed: 0, is_redo: false });
    expect(fakeClient._tables.model_conversions).toHaveLength(1);
  });

  it('marks a request on a photo that already has a model as a redo', async () => {
    const photo = attachModel(await seedPhoto());
    const created = await requestConversion(photo.id);
    expect(created.is_redo).toBe(true);
    expect(created.seed).not.toBe(0);
  });

  it.each([
    ['ALREADY_CONVERTING', 'This photo is already being turned into 3D.'],
    ['CONVERSION_LIMIT', 'You already have 3 models cooking — please wait for one to finish.'],
    ['PHOTO_NOT_FOUND', "This photo isn't available anymore."]
  ])('surfaces %s as a validation error with a friendly message', async (code, message) => {
    fakeClient._registerRpc('request_model_conversion', () => ({
      data: null,
      error: { message: code, code: 'P0001' }
    }));
    const error = await requestConversion('x').catch((e) => e);
    expect(error.code).toBe('validation');
    expect(error.reason).toBe(code);
    expect(describeRequestError(error)).toBe(message);
  });

  it('enforces one active job per photo and three per owner (fake mirrors the SQL rules)', async () => {
    const photos = [await seedPhoto(), await seedPhoto(), await seedPhoto(), await seedPhoto()];
    await requestConversion(photos[0].id);
    await expect(requestConversion(photos[0].id)).rejects.toMatchObject({ reason: 'ALREADY_CONVERTING' });
    await requestConversion(photos[1].id);
    await requestConversion(photos[2].id);
    await expect(requestConversion(photos[3].id)).rejects.toMatchObject({ reason: 'CONVERSION_LIMIT' });
  });

  it('explains a missing migration instead of the generic message', async () => {
    fakeClient._registerRpc('request_model_conversion', () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.request_model_conversion(p_photo_id)' }
    }));
    const error = await requestConversion('x').catch((e) => e);
    expect(describeRequestError(error)).toBe(
      "3D models aren't set up on the server yet (database migration missing)."
    );
  });

  it('classifies a network failure as network', async () => {
    fakeClient._setNetworkDown(true);
    const error = await requestConversion('x').catch((e) => e);
    expect(error.code).toBe('network');
    expect(describeRequestError(error)).toMatch(/connection/);
    expect(describeRequestError(new Error('?'))).toBe("Couldn't start the 3D model. Please try again.");
  });
});

describe('getLatestConversion', () => {
  it('returns null when the photo has no jobs, else the newest', async () => {
    const photo = await seedPhoto();
    expect(await getLatestConversion(photo.id)).toBeNull();
    fakeClient._tables.model_conversions.push(
      { id: 'old', photo_id: photo.id, status: 'failed', requested_at: '2026-01-01T00:00:00Z' },
      { id: 'new', photo_id: photo.id, status: 'queued', requested_at: '2026-02-01T00:00:00Z' }
    );
    expect((await getLatestConversion(photo.id)).id).toBe('new');
  });

  it('throws a classified error on network failure', async () => {
    fakeClient._setNetworkDown(true);
    await expect(getLatestConversion('x')).rejects.toMatchObject({ code: 'network' });
  });
});

describe('getDisplayStatus', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  const fresh = new Date(now - 60_000).toISOString();
  const stale = new Date(now - ACTIVE_JOB_TIMEOUT_MS).toISOString();
  const noModel = { model_storage_path: null };
  const withModel = { model_storage_path: 'o/p/model-j.glb' };

  it.each([
    [noModel, null, 'none'],
    [noModel, job({ status: 'queued', requested_at: fresh }), 'queued'],
    [noModel, job({ status: 'processing', requested_at: fresh }), 'processing'],
    [noModel, job({ status: 'processing', requested_at: stale }), 'failed'],
    [noModel, job({ status: 'failed', requested_at: fresh }), 'failed'],
    [noModel, job({ status: 'completed', requested_at: fresh }), 'none'],
    [noModel, job({ status: 'canceled', requested_at: fresh }), 'none'],
    [withModel, null, 'ready'],
    [withModel, job({ status: 'completed', requested_at: fresh }), 'ready'],
    [withModel, job({ status: 'failed', requested_at: fresh }), 'ready'],
    [withModel, job({ status: 'processing', requested_at: fresh }), 'processing'],
    [withModel, job({ status: 'queued', requested_at: stale }), 'failed']
  ])('photo %o + job %o → %s', (photo, j, expected) => {
    expect(getDisplayStatus(photo, j, now)).toBe(expected);
  });

  it('isFailedJob covers failed and stale active jobs only', () => {
    expect(isFailedJob(null, now)).toBe(false);
    expect(isFailedJob(job({ status: 'failed' }), now)).toBe(true);
    expect(isFailedJob(job({ status: 'queued', requested_at: stale }), now)).toBe(true);
    expect(isFailedJob(job({ status: 'queued', requested_at: fresh }), now)).toBe(false);
    expect(isFailedJob(job({ status: 'completed', requested_at: stale }), now)).toBe(false);
  });
});

describe('describeConversionError', () => {
  it('prefers the worker-recorded message', () => {
    expect(describeConversionError(job({ status: 'failed', error_message: 'Busy!' }))).toBe('Busy!');
  });
  it('uses the timeout text for a stale active job and a generic one otherwise', () => {
    expect(describeConversionError(job({ status: 'processing' }))).toBe(
      'This one took too long. Want to try again?'
    );
    expect(describeConversionError(job({ status: 'failed' }))).toBe(
      'Something went wrong making the 3D model. Try again.'
    );
  });
});

describe('watchConversion', () => {
  it('reports status changes only, then stops on a terminal status', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const photo = await seedPhoto();
    const created = await requestConversion(photo.id);
    const row = fakeClient._tables.model_conversions[0];
    const updates = [];
    watchConversion(photo.id, (j) => updates.push(j && j.status), { intervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000); // unchanged → no second 'queued'
    row.status = 'processing';
    await vi.advanceTimersByTimeAsync(1000);
    row.status = 'completed';
    await vi.advanceTimersByTimeAsync(1000);
    row.status = 'failed'; // no longer polled
    await vi.advanceTimersByTimeAsync(5000);

    expect(created.status).toBe('queued');
    expect(updates).toEqual(['queued', 'processing', 'completed']);
  });

  it('stops when the returned function is called', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const photo = await seedPhoto();
    await requestConversion(photo.id);
    const onUpdate = vi.fn();
    const stop = watchConversion(photo.id, onUpdate, { intervalMs: 1000 });
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps polling through a transient failure', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const photo = await seedPhoto();
    await requestConversion(photo.id);
    const onUpdate = vi.fn();
    watchConversion(photo.id, onUpdate, { intervalMs: 1000 });
    fakeClient._setNetworkDown(true);
    await vi.advanceTimersByTimeAsync(1000);
    fakeClient._setNetworkDown(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('model URLs, download, and removal', () => {
  it('getModelUrl signs the model path', async () => {
    const photo = attachModel(await seedPhoto());
    expect(await getModelUrl(photo)).toBe(`https://fake.local/storage/photos/${photo.model_storage_path}`);
    await expect(getModelUrl({ model_storage_path: null })).rejects.toMatchObject({ code: 'validation' });
  });

  it('getModelUrl classifies a missing object', async () => {
    await expect(getModelUrl({ model_storage_path: 'owner-1/x/model-y.glb' })).rejects.toMatchObject({
      code: 'validation'
    });
  });

  it('getModelDownloadUrl names the file after the photo', async () => {
    const photo = attachModel(await seedPhoto('Paper Crane.jpg'));
    const url = await getModelDownloadUrl(photo);
    expect(url).toContain(`download=${encodeURIComponent('Paper Crane-3d.glb')}`);
    expect(modelDownloadName({ filename: '' })).toBe('craft-3d.glb');
    expect(modelDownloadName({ filename: 'a.b.png' })).toBe('a.b-3d.glb');
    await expect(getModelDownloadUrl({})).rejects.toMatchObject({ code: 'validation' });
  });

  it('removeModel deletes the file and clears all model columns, keeping the photo', async () => {
    const photo = attachModel(await seedPhoto());
    const path = photo.model_storage_path;
    const updated = await removeModel(photo);
    expect(updated).toMatchObject({
      id: photo.id,
      model_storage_path: null,
      model_file_size: null,
      model_generated_at: null,
      model_job_id: null,
      storage_path: photo.storage_path
    });
    expect(fakeClient._storageObjects.has(`photos/${path}`)).toBe(false);
    expect(fakeClient._storageObjects.has(`photos/${photo.storage_path}`)).toBe(true);
    await expect(removeModel({ id: photo.id, model_storage_path: null })).rejects.toMatchObject({
      code: 'validation'
    });
  });

  it('removeModel leaves the row untouched when the file delete fails', async () => {
    const photo = attachModel(await seedPhoto());
    fakeClient._failNextStorageRemoves(1);
    await expect(removeModel(photo)).rejects.toMatchObject({ code: 'network' });
    expect(fakeClient._tables.photos.find((p) => p.id === photo.id).model_storage_path).toBe(
      photo.model_storage_path
    );
  });
});
