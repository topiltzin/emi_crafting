// Supabase Edge Function: fetches YouTube video metadata server-side so the YouTube Data API
// key never reaches the browser bundle (this app is a static SPA — see .env.example's warning
// about secret keys). Deploy with: supabase functions deploy youtube-metadata
// Configure the key with:      supabase secrets set YOUTUBE_API_KEY=your-key-here
//
// Contract: specs/008-craft-tutorial-links/contracts/youtube-api-contract.md
// Request:  POST { url: string }
// Response: 200 { videoId, title, creator, channelId, thumbnail, duration }
//           4xx/5xx { error: 'INVALID_URL'|'VIDEO_NOT_FOUND'|'QUOTA_EXCEEDED'|'FETCH_TIMEOUT'|'AUTH_FAILED'|'SERVER_ERROR', message }

import { corsHeaders } from '../_shared/cors.ts';

const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
];

const FETCH_TIMEOUT_MS = 5000;

function extractVideoId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const normalized = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  const allowedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
  if (!allowedHosts.includes(parsed.hostname)) return null;

  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Parses ISO 8601 durations as returned by contentDetails.duration, e.g. "PT24M35S" -> 1475.
function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST' });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'INVALID_URL', message: 'Request body must be JSON with a url field' });
  }

  const videoId = extractVideoId(body.url ?? '');
  if (!videoId) {
    return jsonResponse(400, {
      error: 'INVALID_URL',
      message: 'Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID',
      suggestion: 'Paste a link like: https://youtube.com/watch?v=dQw4w9WgXcQ'
    });
  }

  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY secret is not configured for this project.');
    return jsonResponse(401, {
      error: 'AUTH_FAILED',
      message: 'YouTube API key is invalid or expired. Please contact support.',
      severity: 'CRITICAL'
    });
  }

  const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  apiUrl.searchParams.set('part', 'snippet,contentDetails');
  apiUrl.searchParams.set('id', videoId);
  apiUrl.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let ytResponse: Response;
  try {
    ytResponse = await fetch(apiUrl.toString(), { signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return jsonResponse(408, {
        error: 'FETCH_TIMEOUT',
        message: 'Request to YouTube took too long. Please try again.',
        timeout: FETCH_TIMEOUT_MS
      });
    }
    console.error('YouTube API fetch failed:', error);
    return jsonResponse(500, { error: 'SERVER_ERROR', message: 'Unexpected error. Please try again.' });
  } finally {
    clearTimeout(timeout);
  }

  if (ytResponse.status === 403) {
    const payload = await ytResponse.json().catch(() => ({}));
    const reason = payload?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      return jsonResponse(429, {
        error: 'QUOTA_EXCEEDED',
        message: 'YouTube quota exceeded. Please try again tomorrow.',
        retryAfter: nextUtcMidnight()
      });
    }
    return jsonResponse(401, {
      error: 'AUTH_FAILED',
      message: 'YouTube API key is invalid or expired. Please contact support.',
      severity: 'CRITICAL'
    });
  }

  if (!ytResponse.ok) {
    console.error('YouTube API returned unexpected status:', ytResponse.status);
    return jsonResponse(500, { error: 'SERVER_ERROR', message: 'Unexpected error. Please try again.' });
  }

  const data = await ytResponse.json();
  const item = data.items?.[0];
  if (!item) {
    return jsonResponse(404, {
      error: 'VIDEO_NOT_FOUND',
      message: 'Video not found on YouTube. It may have been deleted or made private.',
      videoId
    });
  }

  const thumbnail =
    item.snippet?.thumbnails?.medium?.url ||
    item.snippet?.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

  return jsonResponse(200, {
    videoId,
    title: (item.snippet?.title || 'YouTube Video').slice(0, 255),
    creator: (item.snippet?.channelTitle || 'Unknown').slice(0, 255),
    channelId: item.snippet?.channelId || null,
    thumbnail,
    duration: parseIsoDuration(item.contentDetails?.duration)
  });
});

function nextUtcMidnight(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.toISOString();
}
