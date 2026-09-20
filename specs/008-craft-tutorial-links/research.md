# Research Findings: Craft Tutorial Links

**Date**: 2026-09-20

**Scope**: Validate technical decisions for YouTube integration, URL handling, caching, and error strategies

---

## 1. YouTube API Integration Patterns

### Decision: Server-side Metadata Fetching

**Choice**: Implement metadata fetching on backend (Supabase edge functions or Node.js endpoint)

**Rationale**:
- Protects YouTube API key from exposure (not leaked to frontend)
- Handles rate limiting centrally (quotas applied to project, not individual users)
- Consistent error handling and retry logic across all users
- Enables future server-side caching/optimization without client changes

**Alternative Rejected**: Client-side fetch via browser
- ❌ Exposes API key in frontend code
- ❌ Each user has own rate limit; quota exhaustion affects UX inconsistently
- ❌ Inconsistent error handling across browsers/network conditions

**Implementation Approach**:
- Create Supabase edge function `fetch-youtube-metadata` 
- Frontend calls: `POST /api/youtube-metadata` with `{url: "..."}` 
- Backend responds: `{videoId, title, creator, channelId, thumbnail, duration}` or error
- Frontend displays result or error message

---

## 2. YouTube URL Validation Patterns

### Decision: Robust URL Parsing with Multiple Format Support

**Supported Formats**:
1. Long form: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
2. Short form: `https://youtu.be/dQw4w9WgXcQ`
3. With timestamp: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123`
4. With playlist (extract video): `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=...`
5. No protocol: `youtube.com/watch?v=dQw4w9WgXcQ`

**Validation Approach**:
```javascript
// Extract videoId using multiple patterns
const patterns = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /v\/([a-zA-Z0-9_-]{11})/
];

function extractVideoId(url) {
  const normalizedUrl = url.includes('://') ? url : `https://${url}`;
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

**Rejection Criteria**:
- URL does not match any pattern
- VideoId length ≠ 11 characters
- Playlist-only URLs (no video id)
- Non-YouTube domains

**Error Messages**:
- "Invalid YouTube URL. Try: youtube.com/watch?v=..."
- "Video ID not found in URL"
- "Please paste a YouTube video URL (not a playlist)"

---

## 3. Metadata Fetching Strategy

### Decision: Direct YouTube Data API v3 Integration

**Best Practice**: Use YouTube's official API for reliability
- SDK: `google-auth-library` + manual HTTP calls (or `node-youtube-api` package)
- Rate limit: ~10,000 units/day per project; each metadata fetch costs 3-4 units
- Quota: Sufficient for ~2000-3000 fetches/day before hitting limit

**Endpoint Used**:
```
GET https://www.googleapis.com/youtube/v3/videos
?part=snippet,contentDetails
&id={videoId}
&key={API_KEY}
```

**Response Extraction**:
- `snippet.title` → video title
- `snippet.channelTitle` → creator name
- `snippet.channelId` → channel ID (for filtering by creator)
- `snippet.thumbnails.medium.url` → thumbnail
- `contentDetails.duration` → Parse ISO 8601 duration (e.g., "PT24M35S" → 1475 seconds)

**Error Scenarios**:
1. Video not found (deleted, private, age-restricted)
   - API returns empty items array
   - Response: `{error: "VIDEO_NOT_FOUND"}`
2. Rate limit exceeded
   - HTTP 403 with `quotaExceeded`
   - Response: `{error: "QUOTA_EXCEEDED"}` (client retries later)
3. Network timeout
   - No response after 5 seconds
   - Response: `{error: "FETCH_TIMEOUT"}` (client shows "try again later")
4. Invalid API key
   - HTTP 403 with `forbidden`
   - Response: `{error: "AUTH_FAILED"}` (log error, escalate to team)

**Retry Logic** (exponential backoff):
- Attempt 1: Immediate
- Attempt 2: After 100ms
- Attempt 3: After 500ms
- Attempt 4: After 1000ms (give up after 4th failure)
- Only retry on: timeout, rate limit (not on "video not found")

---

## 4. Caching & Storage Strategy

### Decision: Persistent Cache in Supabase Photos Table

**Where**: Add `tutorial_link` JSONB field to `photos` table

**Schema**:
```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ",
  "title": "RickRoll Full Video",
  "creator": "The Rick Astley Show",
  "channelId": "UCZLooOQkVB",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 211,
  "addedAt": "2026-09-20T14:30:00Z"
}
```

**Rationale**:
- Persistent (survives client refresh/logout)
- Survives YouTube API outages (cached data remains visible)
- No separate storage layer (complexity reduction)
- Same consistency model as photo itself

**Cache Invalidation**:
- **On Edit**: User changes video URL → fetch new metadata → overwrite
- **On View**: Check if added >30 days ago → optionally refresh (low priority for MVP)
- **On Delete**: User removes tutorial link → set field to NULL

**Migration Path**:
- Add column: `ALTER TABLE photos ADD COLUMN tutorial_link JSONB;`
- Existing photos: NULL (optional field)
- Future batches can bulk-migrate if needed

---

## 5. Error Handling & Fallback Strategy

### Decision: Graceful Degradation with User Recovery Path

**Scenario 1: YouTube API Unavailable During Link Creation**

```
User action: Paste URL → Click Save
Backend: Attempt API fetch → Timeout/500 error
Frontend response:
  ✓ Accept URL and save as tutorial_link
  ✓ Use placeholder: {title: "YouTube Video", thumbnail: "generic-icon.jpg"}
  ✓ Show message: "Video details unavailable. Retry later?"
  ✓ Queue background task to fetch metadata (Phase 2)
```

**Scenario 2: Linked Video Now Deleted/Private**

```
User action: View photo detail with tutorial link
Frontend: Display tutorial card
Behavior:
  ✓ Show thumbnail + title from cached data
  ✓ When clicked, open YouTube → 404/private message (not our problem)
  ✓ Offer "Update Link" button in case user wants to change video
  ✓ Do NOT block UI or show scary error
```

**Scenario 3: Network Timeout During Metadata Fetch**

```
User action: Paste URL → Fetch metadata
Backend: No response after 5 seconds
Frontend response:
  ✓ Clear error toast: "Network timeout. Try again?"
  ✓ Keep URL in input field
  ✓ Allow user to click "Retry" button
  ✓ Exponential backoff on retries (100ms → 500ms → 1000ms)
```

**Scenario 4: Rate Limit Exceeded**

```
Video metadata fetch hits YouTube quota limit
Backend: Returns `{error: "QUOTA_EXCEEDED"}`
Frontend response:
  ✓ Save URL + allow manual title entry
  ✓ Message: "YouTube is temporarily unavailable. You can still save the link."
  ✓ Offer preset generic thumbnail until metadata available
  ✓ Automatic refresh attempt next day (Phase 2)
```

**Error Message Principles**:
- User-friendly language (no "403 Forbidden")
- Explain what happened: "Video not found on YouTube"
- Suggest action: "Try another video?" or "Retry in a moment?"
- Never block save; always provide recovery path

---

## 6. Performance Targets & Monitoring

### Response Time Budgets

| Operation | Target | Justification |
|-----------|--------|---------------|
| Paste URL → Fetch metadata | <5 sec | User-facing timeout before toast |
| Display tutorial card | <500 ms | DOM insertion, no layout thrashing |
| Click tutorial → Open YouTube | <500 ms | Simple link navigation |
| Tutorial tab with 500 photos load | <2 sec | Pagination/lazy load needed |
| Entire photo detail view | <2 sec | Including all metadata + tutorial |

### Caching Metrics

- **API Calls Saved**: Target ≥80% cache hit rate (metadata requested <20% of views)
- **Cache Size**: ~5KB per cached tutorial link; 500 links = ~2.5MB (acceptable)
- **Stale Data Risk**: <0.1% of videos become unavailable after cache (low risk)

### Monitoring & Alerts

Instrument these metrics:
- YouTube API call success rate (target: ≥95%)
- Average metadata fetch time (target: <3 sec)
- Tutorial link creation time (target: <30 sec total)
- Tutorial card click success rate (target: ≥99%)
- Error frequency by type (quota exceeded, timeout, not found)

---

## 7. Security & Privacy Considerations

### YouTube API Key Protection ✓
- Store in Supabase environment variables (not in git)
- Only server-side access (edge function)
- Rate limiting per-project, not per-user (prevents abuse)
- IP allowlist configured (if using GCP project key)

### User Privacy ✓
- Tutorial links stored only for user's own photos
- No sharing/broadcasting of tutorial history
- Channel IDs stored (for Phase 2 filtering) but not linked externally

### Data Integrity ✓
- Validate videoId length (11 chars) before API call
- Validate duration is positive integer
- Reject oversized title strings (max 255 chars)

---

## 8. Browser & Mobile Compatibility

### Desktop Browsers ✓
- Chrome, Firefox, Safari, Edge: All support fetch API, JSONB in IndexedDB if used
- No special handling needed for tutorial card/modal

### Mobile Browsers ✓
- iOS Safari, Chrome Android: Same as desktop
- Touch interactions: Modal fully functional
- Opening YouTube: Native YouTube app if installed, web fallback

### No Embedded Player (MVP)
- Simple link approach: Click → Open in new tab/app
- Reason: Reduces complexity, avoids iframe sandboxing issues
- Future: Optional embedding (Phase 2)

---

## Summary & Recommendations

✅ **Approved Decisions**:
1. Server-side YouTube API calls (via Supabase edge function)
2. Persistent metadata cache in Supabase `photos` table
3. Robust URL validation supporting multiple formats
4. Graceful error handling with fallback to manual entry
5. Exponential backoff retry logic (100ms → 500ms → 1000ms → give up)
6. Non-blocking UI: Save URL even if metadata unavailable
7. No embedded player in MVP (simple link opens in new tab)

✅ **Ready for Phase 1 Design**

