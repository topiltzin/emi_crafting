// Client-side wrapper around the `youtube-metadata` Supabase Edge Function
// (supabase/functions/youtube-metadata/index.ts). The YouTube Data API key never reaches the
// browser — this module only ever talks to our own Edge Function, which talks to YouTube.
//
// Contract: specs/008-craft-tutorial-links/contracts/youtube-api-contract.md
// Research:  specs/008-craft-tutorial-links/research.md

import { getSupabaseClient } from './supabase-client.js';

const FUNCTION_NAME = 'youtube-metadata';
const RETRY_DELAYS_MS = [0, 100, 500, 1000];
const RETRYABLE_CODES = new Set(['FETCH_TIMEOUT', 'QUOTA_EXCEEDED']);

const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
];

const ALLOWED_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

export class YoutubeApiError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'YoutubeApiError';
    this.code = code;
    Object.assign(this, details);
  }
}

/**
 * Extracts the 11-character YouTube video ID from a URL. Supports:
 * youtube.com/watch?v=, youtu.be/, m.youtube.com/watch?v=, youtube.com/shorts/,
 * youtube.com/v/, with or without a protocol, and with extra query params (timestamp,
 * playlist) alongside `v=`.
 * @returns {string|null} the video ID, or null if the URL isn't a recognizable YouTube video URL
 */
export function extractVideoId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  const normalized = trimmed.includes('://') ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;

  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** @returns {boolean} true if the URL contains an extractable YouTube video ID */
export function isValidYoutubeUrl(url) {
  return extractVideoId(url) !== null;
}

/**
 * Parses an ISO 8601 duration ("PT24M35S") into whole seconds. Returns 0 for unparseable input
 * (mirrors the Edge Function's parser so unit tests can cover the logic without deploying).
 */
export function parseIsoDuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeOnce(url) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke(FUNCTION_NAME, { body: { url } });

  if (!error) return data;

  // supabase-js wraps a non-2xx Edge Function response in a FunctionsHttpError whose `.context`
  // is the raw Response; the structured {error, message} body from index.ts lives there.
  let payload = null;
  if (error.context && typeof error.context.json === 'function') {
    try {
      payload = await error.context.json();
    } catch {
      payload = null;
    }
  }

  if (payload && payload.error) {
    throw new YoutubeApiError(payload.message || 'Failed to fetch video details', payload.error, {
      videoId: payload.videoId,
      retryAfter: payload.retryAfter
    });
  }

  // Edge Function unreachable / not deployed / genuine network failure.
  throw new YoutubeApiError(error.message || 'Network error', 'FETCH_TIMEOUT');
}

/**
 * Fetches metadata for a YouTube URL, retrying transient failures (timeout, quota) with
 * exponential backoff: 0ms -> 100ms -> 500ms -> 1000ms, then giving up.
 * @param {string} url a YouTube video URL
 * @returns {Promise<{videoId, title, creator, channelId, thumbnail, duration}>}
 * @throws {YoutubeApiError} on INVALID_URL, VIDEO_NOT_FOUND, AUTH_FAILED, or after exhausting
 *   retries on FETCH_TIMEOUT/QUOTA_EXCEEDED
 */
export async function fetchYoutubeMetadata(url) {
  if (!isValidYoutubeUrl(url)) {
    throw new YoutubeApiError(
      'Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID',
      'INVALID_URL'
    );
  }

  let lastError;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt]);
    try {
      return await invokeOnce(url);
    } catch (error) {
      lastError = error;
      if (!(error instanceof YoutubeApiError) || !RETRYABLE_CODES.has(error.code)) {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Builds a placeholder tutorial link when metadata fetch fails after all retries, so the user
 * can still save the URL rather than losing their work (research.md "graceful fallback").
 */
export function buildFallbackTutorialLink(url) {
  return {
    url,
    videoId: extractVideoId(url) || '',
    title: 'YouTube Video',
    creator: 'Unknown',
    channelId: null,
    thumbnail: null,
    duration: null,
    addedAt: new Date().toISOString(),
    metadataReady: false
  };
}
