// Photo → 3D model conversions (spec 009-photo-to-3d-model).
//
// The browser only enqueues jobs and reads their status; the standalone worker (worker/) does
// the actual conversion and writes the result. Contract: specs/009-photo-to-3d-model/contracts/
// client-module.md (functions) and database.md (request_model_conversion RPC).

import { getSupabaseClient } from './supabase-client.js';
import { PHOTOS_BUCKET } from './photo-storage-path.js';
import { resolvePhotoUrl } from './photo-url.js';
import { classifySupabaseError, throwClassified, validationError } from './supabase-errors.js';

export const ACTIVE_JOB_TIMEOUT_MS = 10 * 60 * 1000;
export const POLL_INTERVAL_MS = 5000;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

const RPC_ERROR_CODES = ['NOT_AUTHENTICATED', 'PHOTO_NOT_FOUND', 'ALREADY_CONVERTING', 'CONVERSION_LIMIT'];

const REQUEST_ERROR_MESSAGES = {
  PHOTO_NOT_FOUND: "This photo isn't available anymore.",
  ALREADY_CONVERTING: 'This photo is already being turned into 3D.',
  CONVERSION_LIMIT: 'You already have 3 models cooking — please wait for one to finish.',
  NOT_AUTHENTICATED: 'Your session expired — please sign in again.'
};

const GENERIC_JOB_ERROR = 'Something went wrong making the 3D model. Try again.';
const TIMEOUT_JOB_ERROR = 'This one took too long. Want to try again?';

function isActive(job) {
  return !!job && (job.status === 'queued' || job.status === 'processing');
}

function isStale(job, now) {
  return now - new Date(job.requested_at).getTime() >= ACTIVE_JOB_TIMEOUT_MS;
}

export async function requestConversion(photoId) {
  const { data, error } = await getSupabaseClient().rpc('request_model_conversion', {
    p_photo_id: photoId
  });
  if (error) {
    const classified = classifySupabaseError(error, 'Failed to start 3D conversion');
    if (RPC_ERROR_CODES.includes(error.message)) {
      classified.code = 'validation';
      classified.reason = error.message;
    }
    throw classified;
  }
  return data;
}

export function describeRequestError(error) {
  if (error && error.reason && REQUEST_ERROR_MESSAGES[error.reason]) {
    return REQUEST_ERROR_MESSAGES[error.reason];
  }
  // PGRST202/PGRST205: the RPC or table doesn't exist — migration 0002 hasn't been applied.
  const pgrstCode = error && error.cause && error.cause.code;
  if (pgrstCode === 'PGRST202' || pgrstCode === 'PGRST205') {
    return "3D models aren't set up on the server yet (database migration missing).";
  }
  if (error && error.code === 'network') {
    return "Can't reach the server right now — check your connection and try again.";
  }
  return "Couldn't start the 3D model. Please try again.";
}

export async function getLatestConversion(photoId) {
  const { data, error } = await getSupabaseClient()
    .from('model_conversions')
    .select('*')
    .eq('photo_id', photoId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwClassified(error, 'Failed to load 3D model status');
  return data || null;
}

/**
 * What the panel should show for a photo, given its latest conversion job.
 * @returns {'none'|'queued'|'processing'|'ready'|'failed'}
 */
export function getDisplayStatus(photo, job, now = Date.now()) {
  if (isActive(job)) {
    // The worker (or its host) may be down; never leave the UI spinning past the deadline.
    if (isStale(job, now)) return 'failed';
    return job.status;
  }
  if (job && job.status === 'failed' && !photo.model_storage_path) return 'failed';
  if (photo.model_storage_path) return 'ready';
  return 'none';
}

// The job the UI should treat as failed, if any: an actually failed job, or a stale active one.
export function isFailedJob(job, now = Date.now()) {
  if (!job) return false;
  if (job.status === 'failed') return true;
  return isActive(job) && isStale(job, now);
}

export function describeConversionError(job) {
  if (job && job.error_message) return job.error_message;
  if (job && isActive(job)) return TIMEOUT_JOB_ERROR;
  return GENERIC_JOB_ERROR;
}

/**
 * Polls a photo's latest job and calls onUpdate(job) whenever its status changes. Stops by itself
 * once the job is no longer active (or goes stale); the returned function stops it early.
 */
export function watchConversion(photoId, onUpdate, { intervalMs = POLL_INTERVAL_MS } = {}) {
  let stopped = false;
  let timer = null;
  let lastKey = null;

  async function tick() {
    if (stopped) return;
    let job = null;
    try {
      job = await getLatestConversion(photoId);
    } catch (error) {
      // A dropped poll isn't worth surfacing; the next tick retries.
      console.warn('3D status poll failed:', error);
      schedule();
      return;
    }
    if (stopped) return;

    const key = job ? `${job.id}:${job.status}` : 'none';
    if (key !== lastKey) {
      lastKey = key;
      onUpdate(job);
    }

    if (isActive(job) && !isStale(job, Date.now())) schedule();
    else stopped = true;
  }

  function schedule() {
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }

  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export async function getModelUrl(photo) {
  if (!photo || !photo.model_storage_path) throw validationError('No 3D model');
  try {
    return await resolvePhotoUrl(photo.model_storage_path);
  } catch (error) {
    throwClassified(error, 'Failed to load 3D model');
  }
}

export function modelDownloadName(photo) {
  const base = (photo.filename || '').replace(/\.[^.]+$/, '').trim() || 'craft';
  return `${base}-3d.glb`;
}

export async function getModelDownloadUrl(photo) {
  if (!photo || !photo.model_storage_path) throw validationError('No 3D model');
  const { data, error } = await getSupabaseClient()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrl(photo.model_storage_path, DOWNLOAD_URL_TTL_SECONDS, {
      download: modelDownloadName(photo)
    });
  if (error) throwClassified(error, 'Failed to prepare 3D model download');
  return data.signedUrl;
}

// FR-013: deletes the model file, then clears the pointer. The original photo is untouched.
export async function removeModel(photo) {
  if (!photo || !photo.model_storage_path) throw validationError('No 3D model');
  const client = getSupabaseClient();

  const { error: removeError } = await client.storage.from(PHOTOS_BUCKET).remove([photo.model_storage_path]);
  if (removeError) throwClassified(removeError, 'Failed to delete 3D model file');

  const { data, error } = await client
    .from('photos')
    .update({
      model_storage_path: null,
      model_file_size: null,
      model_generated_at: null,
      model_job_id: null
    })
    .eq('id', photo.id)
    .select('*')
    .single();
  if (error) throwClassified(error, 'Failed to remove 3D model');
  // Keep client-only fields (e.g. the resolved thumbnail_url) from the photo we were given.
  return { ...photo, ...data };
}
