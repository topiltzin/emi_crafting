# Contract: YouTube Metadata API

**Date**: 2026-09-20

**Purpose**: Define the interface between frontend (modal) and backend service for fetching YouTube video metadata

---

## Overview

Frontend sends a YouTube URL. Backend extracts the video ID, calls YouTube Data API, returns structured metadata or a clear error. Frontend displays the result or prompts user to retry/choose different video.

---

## Request Contract

### Endpoint
```
POST /api/youtube-metadata
Content-Type: application/json
```

### Request Body
```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### Validation (Backend)
- URL is non-empty string
- URL contains a valid 11-character video ID (extracted via regex)
- URL is valid YouTube domain (youtube.com, youtu.be, m.youtube.com)

### Rejection Reasons
- Empty URL → 400 Bad Request `{error: "INVALID_URL", message: "URL is required"}`
- Invalid format → 400 Bad Request `{error: "INVALID_URL", message: "Not a YouTube URL"}`
- No video ID found → 400 Bad Request `{error: "INVALID_URL", message: "Could not extract video ID"}`

---

## Response Contract (Success)

### HTTP Status: 200 OK

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
  "creator": "Rick Astley",
  "channelId": "UCuAXFkgsw1L7xaCfnd5J4KQ",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 212
}
```

### Field Specifications

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| videoId | string | Yes | Exactly 11 alphanumeric + `-_` | `dQw4w9WgXcQ` |
| title | string | Yes | 1-255 characters | `Rick Astley - Never Gonna Give You Up` |
| creator | string | Yes | 1-255 characters | `Rick Astley` |
| channelId | string | Yes | Exactly 24 alphanumeric | `UCuAXFkgsw1L7xaCfnd5J4KQ` |
| thumbnail | string | Yes | Valid HTTPS URL, must be from YouTube CDN | `https://i.ytimg.com/vi/...` |
| duration | integer | Yes | >0 and ≤ 43200 (12 hours) | `212` (seconds) |

### Source Data
- `videoId`: Extracted from input URL
- `title`: From `snippet.title` (YouTube API)
- `creator`: From `snippet.channelTitle` (YouTube API)
- `channelId`: From `snippet.channelId` (YouTube API)
- `thumbnail`: From `snippet.thumbnails.medium.url` (YouTube API) — always use medium (320x180), not high to avoid bandwidth
- `duration`: Parsed from `contentDetails.duration` (ISO 8601 format)

---

## Response Contract (Errors)

### HTTP 400: Invalid Request

```json
{
  "error": "INVALID_URL",
  "message": "Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID",
  "suggestion": "Paste a link like: https://youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### HTTP 404: Video Not Found

```json
{
  "error": "VIDEO_NOT_FOUND",
  "message": "Video not found on YouTube. It may have been deleted or made private.",
  "videoId": "dQw4w9WgXcQ"
}
```

**Cause**: YouTube API returns empty `items` array (video deleted, private, age-restricted, or doesn't exist)

**Frontend Behavior**: Show error message + "Try another video?" prompt + keep URL in modal input

### HTTP 429: Rate Limit Exceeded

```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "YouTube quota exceeded. Please try again tomorrow.",
  "retryAfter": "2026-09-21T00:00:00Z"
}
```

**Cause**: YouTube Data API quota exhausted (10,000 units/day limit reached)

**Frontend Behavior**: 
- Show message: "Temporarily unavailable. Try again tomorrow."
- Allow user to save URL without metadata (manual title entry)
- Metadata will be fetched in background later (Phase 2)

### HTTP 408: Timeout

```json
{
  "error": "FETCH_TIMEOUT",
  "message": "Request to YouTube took too long. Please try again.",
  "timeout": 5000
}
```

**Cause**: YouTube API didn't respond within 5 seconds (network issue or slow API)

**Frontend Behavior**: Show "Network timeout. Retry?" + exponential backoff on user retry click

### HTTP 500: Server Error

```json
{
  "error": "SERVER_ERROR",
  "message": "Unexpected error. Please try again.",
  "traceId": "abc123def456"
}
```

**Cause**: Unexpected error in backend (not YouTube API's fault)

**Frontend Behavior**: Show message + log traceId for debugging + offer retry

### HTTP 401: Authentication Failed

```json
{
  "error": "AUTH_FAILED",
  "message": "YouTube API key is invalid or expired. Please contact support.",
  "severity": "CRITICAL"
}
```

**Cause**: YouTube API key misconfigured, expired, or has wrong permissions

**Frontend Behavior**: Show message + escalate to team (this is not a user error)

---

## Error Recovery Strategies

### Retry Logic (Client-Side)

**Backoff Pattern** (exponential):
- Attempt 1: Immediate
- Attempt 2: Wait 100ms, then retry
- Attempt 3: Wait 500ms, then retry
- Attempt 4: Wait 1000ms, then retry
- **After 4th failure**: Give up, show error message

**Which Errors to Retry**:
- ✓ FETCH_TIMEOUT (network flake)
- ✓ QUOTA_EXCEEDED (will recover next day)
- ✗ VIDEO_NOT_FOUND (video is actually gone)
- ✗ INVALID_URL (user entered wrong URL)
- ✗ AUTH_FAILED (server-side configuration issue)

```javascript
async function fetchWithRetry(url, maxAttempts = 4) {
  let lastError;
  const backoffs = [0, 100, 500, 1000]; // ms
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (i > 0) await sleep(backoffs[i]);
      return await fetchMetadata(url);
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) throw error;
    }
  }
  
  throw lastError;
}

function isRetryableError(error) {
  return error.code === 'FETCH_TIMEOUT' || 
         error.code === 'QUOTA_EXCEEDED';
}
```

### Graceful Fallback (if all retries fail)

If API call fails after all retries:
1. Allow user to save URL without full metadata
2. Use placeholder thumbnail (generic video icon)
3. Save placeholder title: "YouTube Video"
4. Queue background job to fetch metadata later (Phase 2)

```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ",
  "title": "YouTube Video",
  "creator": "Unknown",
  "channelId": null,
  "thumbnail": "data:image/svg+xml,..." // fallback SVG icon
  "duration": null,
  "addedAt": "2026-09-20T14:30:00Z",
  "metadataReady": false // Flag: metadata incomplete, pending refresh
}
```

---

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| API Call Duration | <3 seconds | 95th percentile |
| Timeout | 5 seconds | User-facing timeout |
| Retry Delay | Total <2 sec | For 4 retries: 0 + 0.1 + 0.5 + 1 = 1.6 sec |
| Response Size | <5 KB | JSON payload |
| Cache Hit Rate | ≥80% | Metadata cached, many views reuse cache |

---

## Examples

### Example 1: Happy Path

**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response** (200 OK):
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
  "creator": "Rick Astley",
  "channelId": "UCuAXFkgsw1L7xaCfnd5J4KQ",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 212
}
```

---

### Example 2: Invalid URL

**Request**:
```json
{
  "url": "https://example.com/video"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "INVALID_URL",
  "message": "Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID"
}
```

---

### Example 3: Video Not Found

**Request**:
```json
{
  "url": "https://youtube.com/watch?v=invalid11charss"
}
```

**Response** (404 Not Found):
```json
{
  "error": "VIDEO_NOT_FOUND",
  "message": "Video not found on YouTube. It may have been deleted or made private.",
  "videoId": "invalid11charss"
}
```

---

### Example 4: Rate Limit

**Request** (50th video in a day):
```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response** (429 Too Many Requests):
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "YouTube quota exceeded. Please try again tomorrow.",
  "retryAfter": "2026-09-21T00:00:00Z"
}
```

---

## Implementation Notes (Backend)

### YouTube Data API Setup
1. Create GCP project
2. Enable YouTube Data API v3
3. Create API key (restrict to authorized domains)
4. Store key in Supabase environment variables: `YOUTUBE_API_KEY`
5. Implement rate limiting per-project (not per-user)

### Error Handling Checklist
- [ ] Validate input URL before API call
- [ ] Handle missing response body gracefully
- [ ] Parse ISO 8601 duration correctly
- [ ] Validate response fields match contract
- [ ] Log all API errors (including backoff attempts)
- [ ] Never expose API key in response
- [ ] Set appropriate HTTP status codes (400 vs 404 vs 429 vs 500)

### Testing
- [ ] Unit: videoId extraction from various URL formats
- [ ] Unit: ISO duration parsing (PT24M35S → 1475)
- [ ] Integration: Mock YouTube API response, verify contract
- [ ] Integration: Rate limit scenario (simulate 429 response)
- [ ] E2E: Real API call (with caching to avoid quota exhaustion)

