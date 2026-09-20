# Quickstart: Craft Tutorial Links Validation

**Date**: 2026-09-20

**Purpose**: Runnable end-to-end validation scenarios proving the feature works before task breakdown

**Note**: This guide validates the implemented feature against acceptance criteria. Implementation code (modules, UI components, tests) is the responsibility of `/speckit-tasks` and development phase.

---

## Prerequisites

### Setup Required
- [ ] Supabase project configured with YouTube API key in environment
- [ ] Migration applied: `ALTER TABLE photos ADD COLUMN tutorial_link JSONB;`
- [ ] YouTube Data API enabled in GCP project
- [ ] Frontend: npm packages installed (`npm install`)
- [ ] Test data: At least one photo uploaded and accessible

### Test Accounts & URLs
- Valid YouTube URL: `https://youtube.com/watch?v=dQw4w9WgXcQ` (Rick Roll - public, long video)
- Short URL variant: `https://youtu.be/dQw4w9WgXcQ`
- URL with timestamp: `https://youtube.com/watch?v=dQw4w9WgXcQ&t=30`
- Deleted video URL: `https://youtube.com/watch?v=InvalidVideoId123` (will return 404)

---

## Validation Scenario 1: Add Tutorial Link

### Story 1 Acceptance: Photo detail view has "Add Tutorial Link" button → Modal opens → User pastes URL → Metadata fetches → Displays on card & detail

### Setup
1. Open browser to Emi's Craft House app
2. Upload a craft photo (or use existing photo)
3. Click on photo to open detail view

### Test Steps

**Step 1: Locate "Add Tutorial Link" Button**
```
Given: Photo detail view is open
When: Look for tutorial section
Then: PASS if "Add Tutorial Link" button visible
      OR "Add Tutorial" CTA appears near photo metadata
```

**Step 2: Open Modal**
```
Given: "Add Tutorial Link" button is visible
When: Click the button
Then: PASS if modal opens with YouTube URL input field
      AND modal title says "Add Tutorial Link" or similar
      AND input has placeholder like "Paste YouTube URL..."
```

**Step 3: Paste Valid URL**
```
Given: Modal is open with URL input field
When: Paste valid YouTube URL (e.g., https://youtube.com/watch?v=dQw4w9WgXcQ)
And: Click "Save" or press Enter
Then: PASS if loading spinner/state appears
      AND modal stays open while metadata fetches
```

**Step 4: Verify Metadata Fetched**
```
Given: URL pasted and save clicked
When: Wait up to 5 seconds for metadata fetch
Then: PASS if preview shows:
      - Video thumbnail
      - Video title
      - Creator name
      - Duration badge (e.g., "3:32")
      AND modal shows "Save" button enabled
```

**Step 5: Save Tutorial Link**
```
Given: Metadata preview displayed
When: Click "Save" button in modal
Then: PASS if modal closes
      AND photo card now shows tutorial badge/overlay (e.g., 🎬 icon)
      AND tutorial information persists (refresh page → still visible)
```

**Step 6: Verify Display on Detail View**
```
Given: Tutorial link saved
When: View photo detail view
Then: PASS if tutorial card displays with:
      - Thumbnail image
      - Video title
      - Creator name
      - Duration in readable format (e.g., "3 min 32 sec")
      AND card appears below photo or in dedicated section
      AND card is visually distinct (different color/border/spacing)
```

**Step 7: Verify Display on Photo Grid**
```
Given: Tutorial link saved
When: View photo gallery/grid (Home or My Photos)
Then: PASS if photo card shows tutorial badge (🎬 or play icon)
      AND badge indicates tutorial is linked
      AND clicking badge doesn't navigate (only detail view should show tutorial)
```

---

## Validation Scenario 2: View Tutorial from Photo

### Story 2 Acceptance: Click tutorial card → Video opens in new tab → User can watch

### Setup
- Use same photo from Scenario 1 (already has tutorial link)
- Open photo detail view

### Test Steps

**Step 1: Locate Tutorial Card**
```
Given: Photo with tutorial link is displayed
When: Look at photo detail view
Then: PASS if tutorial card visible with:
      - Video thumbnail
      - Clickable appearance (hover state, color change, cursor pointer)
```

**Step 2: Click Tutorial**
```
Given: Tutorial card is visible and clickable
When: Click on tutorial card
Then: PASS if YouTube video opens in new browser tab
      AND video page loads (URL contains youtube.com)
      AND original app tab remains open (not navigated away)
```

**Step 3: Hover Tooltip**
```
Given: Tutorial card visible in detail view
When: Hover mouse over video title (if title is truncated)
Then: PASS if tooltip appears showing full title (if truncated)
      OR title is not truncated and displays in full
```

**Step 4: No Tutorial State**
```
Given: Photo detail view for photo WITHOUT tutorial link
When: Look for tutorial section
Then: PASS if tutorial card is NOT shown
      AND "Add Tutorial Link" CTA is displayed instead
```

---

## Validation Scenario 3: Edit Tutorial Link

### Story 1 (Extended): User can edit/change tutorial link

### Setup
- Use photo with tutorial link from Scenario 1
- Open photo detail view

### Test Steps

**Step 1: Find Edit Option**
```
Given: Tutorial card visible
When: Look for edit/update button near tutorial card
Then: PASS if "Edit" or pencil icon visible
      (could be small button on card or context menu)
```

**Step 2: Edit Modal Opens**
```
Given: Edit button found
When: Click "Edit" button
Then: PASS if modal opens with YouTube URL input
      AND previous URL is prefilled in input field
      AND can clear and paste new URL
```

**Step 3: Change Video**
```
Given: Edit modal open with old URL prefilled
When: Clear input and paste new YouTube URL
And: Click Save
Then: PASS if metadata fetches for new video
      AND tutorial card updates with new video's metadata
      AND old thumbnail/title replaced (no duplicate data)
```

**Step 4: Verify Persistence**
```
Given: Tutorial link updated to new video
When: Refresh page (F5)
Then: PASS if new tutorial metadata still displayed
      AND old video data not present
```

---

## Validation Scenario 4: Delete Tutorial Link

### Story 1 (Extended): User can remove tutorial link

### Setup
- Photo with tutorial link from previous scenarios
- Open photo detail view

### Test Steps

**Step 1: Find Delete Option**
```
Given: Tutorial card visible
When: Look for delete/remove button
Then: PASS if delete icon/button visible (trash can, X, or "Remove")
```

**Step 2: Delete Link**
```
Given: Delete button found
When: Click delete button
Then: PASS if tutorial card disappears immediately
      OR confirmation dialog appears, user confirms delete
```

**Step 3: Verify Removal**
```
Given: Delete action completed
When: Look at detail view
Then: PASS if tutorial card gone
      AND "Add Tutorial Link" CTA reappears
      AND photo itself NOT deleted (only link removed)
```

**Step 4: Verify Persistence**
```
Given: Tutorial link deleted
When: Refresh page
Then: PASS if tutorial data not restored (deletion persisted)
      AND "Add Tutorial Link" still visible
```

---

## Validation Scenario 5: Handle Deleted Video

### Story 2 (Edge Case): Video was linked but later deleted on YouTube

### Setup
- Photo with tutorial link to a video that NO LONGER EXISTS on YouTube
- (Note: In real tests, use a private/age-restricted video instead for safety)

### Test Steps

**Step 1: View Photo with Deleted Video**
```
Given: Photo detail view for photo with "deleted video" tutorial link
When: View the tutorial section
Then: PASS if tutorial card displays with:
      - Cached thumbnail (from when link was created)
      - Cached title and creator
      - "Video unavailable" label/message
      AND card is NOT clickable (or click shows "unavailable" message)
```

**Step 2: Can Still Edit/Delete Link**
```
Given: Deleted video tutorial link showing
When: Try to edit or delete the link
Then: PASS if edit/delete buttons still work
      AND user can update to new video or remove the link
```

---

## Validation Scenario 6: Handle Invalid URL

### Story 1 (Error Case): User pastes invalid/malformed URL

### Setup
- Open photo detail view
- Click "Add Tutorial Link"

### Test Steps

**Step 1: Paste Invalid URL**
```
Given: Modal open with URL input
When: Paste non-YouTube URL (e.g., "https://example.com")
And: Click Save
Then: PASS if clear error message appears:
      "Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID"
      AND modal stays open (doesn't close on error)
      AND URL field not cleared (user can edit and retry)
```

**Step 2: Paste Malformed URL**
```
Given: Modal open
When: Paste URL without video ID (e.g., "youtube.com/")
And: Click Save
Then: PASS if error message appears (not crash or timeout)
      AND helpful suggestion provided
```

**Step 3: Empty URL**
```
Given: Modal open
When: Click Save without entering URL
Then: PASS if validation prevents save
      AND message like "URL required" appears
```

---

## Validation Scenario 7: Handle API Failures

### Story 1 (Error Case): YouTube API is slow/unavailable

### Setup
- Network environment where YouTube API is slow (simulate with throttling or disconnect)
- Open photo detail and modal

### Test Steps

**Step 1: Timeout Handling**
```
Given: Modal open with URL
When: Paste URL but YouTube API doesn't respond within 5 seconds
Then: PASS if user sees message: "Network timeout. Retry?"
      AND modal doesn't freeze
      AND user can click Retry button
```

**Step 2: Graceful Fallback**
```
Given: YouTube API is unavailable (persistent failure)
When: Paste URL and metadata fetch fails after retries
Then: PASS if user can still save link with:
      - URL stored
      - Placeholder title: "YouTube Video"
      - Generic thumbnail (fallback icon)
      AND message: "Video details unavailable now. Metadata will update later."
      AND save button is enabled (doesn't require metadata)
```

**Step 3: Retry After Outage**
```
Given: Tutorial link saved with placeholder (API was down)
When: YouTube API becomes available again, user clicks "Refresh" or edit modal
Then: PASS if system fetches real metadata
      AND tutorial card updates with actual title/creator
      (Note: This may be Phase 2 feature; document if in MVP)
```

---

## Validation Scenario 8: Performance Targets

### Acceptance: User can complete linking in under 30 seconds

### Setup
- Measure with browser DevTools Performance tab
- Network: Standard connection (not throttled for this test)

### Test Steps

**Step 1: Paste-to-Display Time**
```
Given: Modal open with URL input, network is normal
When: Paste URL and click Save
And: Metadata fetches and displays
Then: PASS if total time < 30 seconds
      (Measured: Click Save → Metadata preview appears)
      
Expected breakdown:
- User types/pastes: 5 seconds
- API fetch: 2-3 seconds (median)
- UI render: <1 second
- Total: ~7-10 seconds (well under 30 sec target)
```

**Step 2: Tutorial Tab Load Time (Phase 2)**
```
Given: Tutorials tab implemented with 500+ photos
When: Click Tutorials tab
Then: PASS if list of creators loads in <2 seconds
      (Measure with DevTools Performance tab)
```

---

## Success Criteria Checklist

Use this checklist to verify all acceptance criteria are met:

### Story 1: Link Tutorial to Photo ✓
- [ ] User can click "Add Tutorial Link" on photo detail
- [ ] Modal opens with YouTube URL input
- [ ] Valid YouTube URL fetches metadata (title, thumbnail, creator, duration)
- [ ] Metadata displays as preview before save
- [ ] Save button persists tutorial link to database
- [ ] Tutorial card displays on photo card (with badge)
- [ ] Tutorial card displays on photo detail view
- [ ] User can edit tutorial link (change video)
- [ ] User can delete tutorial link
- [ ] All operations complete in <30 seconds

### Story 2: View Tutorial from Photo ✓
- [ ] Tutorial card displays on photo detail
- [ ] Card shows thumbnail, title, creator, duration
- [ ] Click card opens YouTube in new browser tab
- [ ] No errors in browser console
- [ ] Hover shows full title if truncated (tooltip or no truncation)
- [ ] Photo without tutorial shows "Add Tutorial Link" CTA

### Error Handling ✓
- [ ] Invalid URLs show clear error messages
- [ ] Network timeouts handled gracefully with retry option
- [ ] Deleted videos show "Video unavailable" message
- [ ] API failures allow manual entry fallback
- [ ] No UI crashes or infinite loops

### Performance ✓
- [ ] Link creation completes in <30 seconds
- [ ] Tutorial metadata fetches in <5 seconds
- [ ] Tutorial tab (if Phase 2) loads in <2 seconds for 500 photos
- [ ] No layout shift or jank when tutorial displays

---

## Test Environment Teardown

After validation:
1. Clear test photos (optional)
2. Verify no orphaned data in database
3. Check browser console for warnings/errors
4. Review performance metrics in DevTools

---

## Validation Sign-Off

| Criterion | Status | Tester | Date |
|-----------|--------|--------|------|
| Story 1: Link Tutorial | ☐ PASS | — | — |
| Story 2: View Tutorial | ☐ PASS | — | — |
| Edit Tutorial | ☐ PASS | — | — |
| Delete Tutorial | ☐ PASS | — | — |
| Error Handling | ☐ PASS | — | — |
| Performance Targets | ☐ PASS | — | — |
| **Overall** | ☐ PASS | — | — |

**Notes**: 
```
[Add any issues, workarounds, or observations here]
```

