// Orchestrates linking a YouTube tutorial to a photo: fetch metadata, validate, persist,
// and the creator-aggregation query behind the Tutorials tab (US3).
//
// Spec: specs/008-craft-tutorial-links/spec.md
// Data model: specs/008-craft-tutorial-links/data-model.md

import { fetchYoutubeMetadata, buildFallbackTutorialLink, YoutubeApiError } from './youtube-client.js';
import { updatePhotoTutorialLink, removePhotoTutorialLink, getAllPhotos, getTutorialLinks } from './db.js';
import { validationError } from './supabase-errors.js';

const MAX_TITLE_LENGTH = 255;
const MAX_CREATOR_LENGTH = 255;
const VIDEO_ID_LENGTH = 11;
const MAX_DURATION_SECONDS = 43200; // 12 hours

/**
 * Validates a tutorial link object against data-model.md's field constraints before it's
 * persisted. channelId/thumbnail/duration are nullable (the fallback placeholder omits them).
 * @throws {DataAccessError} with code 'validation' on the first violated constraint
 */
export function validateTutorialLink(link) {
  if (!link || typeof link !== 'object') {
    throw validationError('tutorial_link must be an object');
  }
  if (!link.url || typeof link.url !== 'string' || link.url.length > 2000) {
    throw validationError('tutorial_link.url is required and must be max 2000 characters');
  }
  if (!link.videoId || link.videoId.length !== VIDEO_ID_LENGTH) {
    throw validationError(`tutorial_link.videoId must be exactly ${VIDEO_ID_LENGTH} characters`);
  }
  if (!link.title || link.title.length > MAX_TITLE_LENGTH) {
    throw validationError(`tutorial_link.title is required and must be max ${MAX_TITLE_LENGTH} characters`);
  }
  if (!link.creator || link.creator.length > MAX_CREATOR_LENGTH) {
    throw validationError(`tutorial_link.creator is required and must be max ${MAX_CREATOR_LENGTH} characters`);
  }
  if (link.duration != null && (link.duration <= 0 || link.duration > MAX_DURATION_SECONDS)) {
    throw validationError(`tutorial_link.duration must be between 1 and ${MAX_DURATION_SECONDS} seconds`);
  }
  if (!link.addedAt || Number.isNaN(new Date(link.addedAt).getTime())) {
    throw validationError('tutorial_link.addedAt must be a valid ISO 8601 timestamp');
  }
  return link;
}

// Fire-and-forget analytics: no external analytics service exists in this project (a static
// SPA with no backend beyond Supabase), so events are logged and dispatched as a DOM
// CustomEvent that a future analytics integration can listen for without touching this module.
export function trackTutorialEvent(name, detail = {}) {
  try {
    console.debug(`[tutorial-link] ${name}`, detail);
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent(`tutorial-link:${name}`, { detail }));
    }
  } catch {
    // Analytics must never break the feature it's observing.
  }
}

// Users may paste "youtube.com/watch?v=..." without a scheme; stored as-is it would become a
// relative href on the Watch link. extractVideoId() already accepted it, so just add https://.
function normalizeYoutubeUrl(url) {
  const trimmed = url.trim();
  return trimmed.includes('://') ? trimmed : `https://${trimmed}`;
}

// YouTube reports live streams as "P0D" (parsed to 0) and nothing enforces our 12h cap, so an
// out-of-range duration is treated as unknown rather than rejecting the user's link.
function normalizeDuration(duration) {
  return typeof duration === 'number' && duration > 0 && duration <= MAX_DURATION_SECONDS ? duration : null;
}

/**
 * Adds or replaces the tutorial link on a photo. Fetches metadata for the URL; if the fetch
 * fails after retries, saves a placeholder so the user's URL isn't lost (research.md fallback).
 * @param {string} photoId
 * @param {string} youtubeUrl
 * @param {{metadata?: object|null, useFallback?: boolean}} [options] metadata the caller already
 *   fetched (e.g. the link dialog's preview), or useFallback when the user chose "save anyway" —
 *   either way we skip a second, quota-consuming fetch.
 * @returns {Promise<{photo: object, metadataReady: boolean}>}
 */
export async function saveTutorialLink(photoId, youtubeUrl, { metadata = null, useFallback = false } = {}) {
  const url = normalizeYoutubeUrl(youtubeUrl);
  let tutorialLink;
  let metadataReady = true;

  if (useFallback) {
    tutorialLink = buildFallbackTutorialLink(url);
    metadataReady = false;
  } else {
    try {
      const resolved = metadata || (await fetchYoutubeMetadata(url));
      tutorialLink = { ...resolved, url, addedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof YoutubeApiError && (error.code === 'FETCH_TIMEOUT' || error.code === 'QUOTA_EXCEEDED')) {
        tutorialLink = buildFallbackTutorialLink(url);
        metadataReady = false;
      } else {
        throw error;
      }
    }
  }
  tutorialLink.duration = normalizeDuration(tutorialLink.duration);

  validateTutorialLink(tutorialLink);
  const photo = await updatePhotoTutorialLink(photoId, tutorialLink);
  trackTutorialEvent('link_added', { photoId, videoId: tutorialLink.videoId, metadataReady });

  return { photo, metadataReady };
}

/** Removes the tutorial link from a photo (sets tutorial_link to NULL). */
export async function deleteTutorialLink(photoId) {
  const photo = await removePhotoTutorialLink(photoId);
  trackTutorialEvent('link_removed', { photoId });
  return photo;
}

export function trackTutorialViewed(photoId, videoId) {
  trackTutorialEvent('link_viewed', { photoId, videoId });
}

/**
 * Aggregates the current user's tutorial-linked photos by creator channel (US3).
 * @returns {Promise<Array<{channelId: string, name: string, thumbnail: string|null, photoCount: number, lastLinkedAt: string}>>}
 *   sorted by most recently linked first
 */
export async function getTutorialCreators() {
  const links = await getTutorialLinks();
  const creators = new Map();

  for (const link of links) {
    if (!link || !link.channelId) continue;

    const existing = creators.get(link.channelId);
    if (!existing) {
      creators.set(link.channelId, {
        channelId: link.channelId,
        name: link.creator,
        thumbnail: link.thumbnail,
        photoCount: 1,
        lastLinkedAt: link.addedAt
      });
    } else {
      existing.photoCount += 1;
      if (link.addedAt > existing.lastLinkedAt) existing.lastLinkedAt = link.addedAt;
    }
  }

  return Array.from(creators.values()).sort((a, b) => (a.lastLinkedAt < b.lastLinkedAt ? 1 : -1));
}

/**
 * Returns all of the current user's photos whose tutorial link belongs to the given channel.
 * @param {string} channelId
 * @param {{sortBy?: 'date'|'favorite', favoritesOnly?: boolean}} options
 */
export async function getPhotosByCreator(channelId, options = {}) {
  const { favoritesOnly = false } = options;
  return getAllPhotos({ limit: 100000, favoritesOnly, tutorialChannelId: channelId });
}
