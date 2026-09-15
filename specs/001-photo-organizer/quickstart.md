# Quickstart Validation Guide: Photo Organizer

**Purpose**: End-to-end validation scenarios that prove the photo organizer feature works as specified.

**Target Audience**: QA, developers, product reviewers

---

## Prerequisites

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, or Edge from last 2 years)
- Test photo files (JPEG/PNG, various sizes: small <1MB, large 2-5MB)
- Photos with EXIF metadata and photos without metadata (for fallback testing)
- Approximately 5-10 minutes per validation run

### Test Data Preparation

```
test-photos/
├── photo-2026-08-01.jpg       # EXIF date: 2026-08-01
├── photo-2026-08-15.jpg       # EXIF date: 2026-08-15
├── photo-2026-09-01.jpg       # EXIF date: 2026-09-01
├── photo-no-exif.png          # No EXIF metadata
└── large-photo-5mb.jpg        # Large file (5MB)
```

---

## Validation Scenario 1: Album Auto-Grouping by Date

**Goal**: Verify that photos are automatically grouped into albums by date from EXIF metadata.

**Setup**:
1. Open photo organizer application in browser
2. Click "Upload Photos" button

**Steps**:

1. **Select photos with EXIF metadata**:
   - Select: photo-2026-08-01.jpg, photo-2026-08-15.jpg, photo-2026-09-01.jpg
   - Click "Upload" button
   - Wait for upload to complete

2. **Verify album creation**:
   - Main page should display 3 album cards
   - Each card shows a different date:
     - "August 1, 2026" (or similar format)
     - "August 15, 2026"
     - "September 1, 2026"
   - Each card displays photo count: "1 photo"
   - Albums are ordered by date (most recent first by default)

3. **Verify thumbnail display**:
   - Each album card shows a thumbnail preview of the first photo
   - Thumbnails are readable and not distorted

**Expected Result**: ✅ PASS
- 3 albums created automatically
- Albums grouped correctly by date from photo EXIF
- Thumbnails display properly

**Expected Result**: ❌ FAIL
- Albums not created or grouped incorrectly
- Thumbnails missing or broken
- Wrong date format or ordering

---

## Validation Scenario 2: Photo Fallback When EXIF Missing

**Goal**: Verify that photos without EXIF metadata fall back to upload date.

**Setup**:
- Prerequisite: Scenario 1 completed (some albums exist)

**Steps**:

1. **Upload photo without EXIF metadata**:
   - Click "Upload Photos"
   - Select: photo-no-exif.png
   - Click "Upload"
   - Wait for completion

2. **Verify album assignment**:
   - Look for a new album with today's date (e.g., "September 14, 2026")
   - OR if today's date album already exists, photo is added to it
   - Album photo count increments
   - Photo appears in album

**Expected Result**: ✅ PASS
- Photo successfully uploaded
- Album created/updated with upload date
- Photo is visible in album

**Expected Result**: ❌ FAIL
- Photo upload fails or shows error
- Album not created with upload date
- Photo missing or not visible

---

## Validation Scenario 3: Drag-and-Drop Album Reordering

**Goal**: Verify drag-and-drop reordering works and persists after page reload.

**Setup**:
- Prerequisite: At least 3 albums exist (from Scenario 1)

**Steps**:

1. **Initial state**:
   - Note current album order on main page
   - Albums should be: Sep 1, Aug 15, Aug 1 (chronological, most recent first)

2. **Drag first album to end position**:
   - Click and drag the "September 1, 2026" album card
   - Drag to end position (after "August 1, 2026")
   - Drop the album
   - Visual feedback should show: opacity change, insertion indicator, smooth transition

3. **Verify new order**:
   - Main page immediately updates
   - New order: Aug 15, Aug 1, Sep 1
   - Album photos still visible in correct album

4. **Refresh page**:
   - Reload browser (Ctrl+R or Cmd+R)
   - Wait for page to load

5. **Verify order persists**:
   - Albums still in new order: Aug 15, Aug 1, Sep 1
   - Order survived page reload
   - All album data intact

**Expected Result**: ✅ PASS
- Drag-and-drop works smoothly with visual feedback
- Order updates immediately on drop
- Order persists after page reload
- No data loss or corruption

**Expected Result**: ❌ FAIL
- Drag-and-drop doesn't work or is jerky/laggy
- Order doesn't persist after reload
- Albums become hidden or corrupted
- Console shows JavaScript errors

---

## Validation Scenario 4: Photo Tile Display and Responsiveness

**Goal**: Verify photos display in tile grid layout and respond to window resizing.

**Setup**:
- Prerequisite: At least one album with multiple photos exists

**Steps**:

1. **Click "View" on an album**:
   - Navigate to individual album view
   - Wait for photos to load

2. **Verify tile grid display**:
   - Photos display in a grid/tile layout
   - Multiple columns (typically 3-4 on desktop, 2 on tablet, 1 on mobile)
   - Tiles are square or similar aspect ratio
   - Photo thumbnails are visible and readable
   - No tiles overlap or misalign

3. **Test responsive layout (desktop)**:
   - Open browser DevTools (F12)
   - Go to Device Emulation tab
   - Test different viewport widths:
     - 768px (tablet): 2 columns
     - 1024px (laptop): 3 columns
     - 1440px (desktop): 4 columns

4. **Verify on actual mobile device** (if available):
   - Open app on phone/tablet
   - Tiles should display single column or 2 columns (depending on screen size)
   - No horizontal scrolling needed
   - Touch interactions work (tap to expand/delete)

**Expected Result**: ✅ PASS
- Tiles display in responsive grid
- Layout adjusts correctly at different breakpoints
- All photos visible without scrolling long distances
- No distortion or overlap

**Expected Result**: ❌ FAIL
- Tiles overflow or misalign
- Layout doesn't adjust on resize
- Photos not visible or distorted on mobile
- Horizontal scrolling required

---

## Validation Scenario 5: Add Photo to Existing Album

**Goal**: Verify users can add photos to existing albums.

**Setup**:
- Prerequisite: At least one album exists

**Steps**:

1. **Navigate to album**:
   - Click "View" on any album
   - Verify current photo count (e.g., "5 photos")

2. **Add photo**:
   - Click "Add Photos" button within album
   - File picker opens
   - Select a new photo (that wasn't uploaded before)
   - Click "Open" to confirm selection
   - Wait for upload

3. **Verify photo added**:
   - New photo appears in tile grid
   - Photo count increments (e.g., "6 photos")
   - Go back to main page
   - Album card photo count also updated (e.g., "6 photos")

**Expected Result**: ✅ PASS
- Photo successfully added to album
- Photo count increments everywhere
- Photo visible in tile grid immediately

**Expected Result**: ❌ FAIL
- Upload fails or shows error
- Photo not visible after upload
- Photo count doesn't update
- Photo appears in wrong album

---

## Validation Scenario 6: Delete Photo from Album

**Goal**: Verify users can delete photos and album is updated.

**Setup**:
- Prerequisite: Album with at least 2 photos open

**Steps**:

1. **Initial state**:
   - Note current photo count (e.g., "5 photos")
   - Identify a photo to delete

2. **Delete photo**:
   - Hover over (or click) a photo tile
   - "Delete" button appears
   - Click "Delete" button
   - Confirmation dialog appears: "Delete this photo? This cannot be undone."
   - Click "Delete" to confirm

3. **Verify deletion**:
   - Photo disappears from tile grid
   - Photo count decrements (e.g., "4 photos")
   - Page doesn't reload or crash
   - Go back to main page
   - Album card photo count updated (e.g., "4 photos")

4. **Refresh page**:
   - Reload browser
   - Photo count still correct (deletion persisted)

**Expected Result**: ✅ PASS
- Photo deletion works smoothly
- Photo count updates everywhere
- Deletion persists after reload
- Confirmation dialog prevents accidents

**Expected Result**: ❌ FAIL
- Delete button not visible or doesn't work
- Photo count doesn't decrement
- Deletion doesn't persist after reload
- Deletion affects wrong photo

---

## Validation Scenario 7: Delete Album

**Goal**: Verify albums can be deleted along with all photos.

**Setup**:
- Prerequisite: At least 2 albums exist

**Steps**:

1. **Initial state**:
   - Note number of albums on main page (e.g., 3 albums)
   - Identify an album to delete

2. **Delete album**:
   - On album card, click "Delete" button
   - Confirmation dialog appears: "Delete album and all {N} photos? This cannot be undone."
   - Click "Delete" to confirm

3. **Verify deletion**:
   - Album card disappears from main page
   - Album count decrements (e.g., 2 albums remaining)
   - All photos in album are deleted
   - No errors or crashes

4. **Verify data persistence**:
   - Refresh page
   - Album still gone, album count still correct (deletion persisted)

**Expected Result**: ✅ PASS
- Album deletion works
- All photos in album deleted
- Deletion persists after reload
- User warned before deletion

**Expected Result**: ❌ FAIL
- Album not deleted or reappears
- Some photos remain in different album
- Deletion not persistent
- No confirmation before deletion

---

## Validation Scenario 8: Performance with Large Photo Collection

**Goal**: Verify app performs well with 100+ photos and multiple albums (per specification SC-001).

**Setup**:
- Prerequisite: Create test database with 100+ photos across 15-20 albums
- Can be done via automated test setup or manual bulk upload

**Steps**:

1. **Measure main page load time**:
   - Open DevTools (F12 → Network tab)
   - Refresh page (Ctrl+Shift+R for hard refresh)
   - Note time to full page load in Console
   - Expected: <2 seconds

2. **Verify album grid renders smoothly**:
   - All albums visible without lag
   - Scroll through album list smoothly
   - No janky animations or reflows

3. **Open album with many photos**:
   - Click "View" on an album with 30+ photos
   - Album view loads and displays tiles
   - Scroll through tiles (test pagination/virtualization)
   - Expected: Smooth scrolling, no lag

4. **Drag-and-drop performance**:
   - Drag an album while many albums visible
   - Drop should be smooth, no frame drops (60fps)
   - Visual feedback responsive

5. **Check browser memory**:
   - DevTools → Memory tab → Take heap snapshot
   - Memory usage should be reasonable (<100MB for 100 photos)
   - No memory leaks on repeated operations

**Expected Result**: ✅ PASS
- Main page loads <2 seconds
- No lag during scrolling or drag-drop
- Memory usage reasonable
- All 100+ photos remain accessible

**Expected Result**: ❌ FAIL
- Page load >2 seconds
- Noticeable lag or stutter during interactions
- Memory usage >200MB
- Performance degrades with more photos

---

## Validation Scenario 9: Browser Consistency (Multi-Tab/Reload)

**Goal**: Verify app works correctly when same browser is open in multiple tabs.

**Setup**:
- Prerequisite: App with some albums and photos exists

**Steps**:

1. **Open app in two tabs**:
   - Tab A: Open photo organizer app
   - Tab B: Open same app in new tab (same or different URL)

2. **Upload photo in Tab A**:
   - Upload a new photo to an album
   - Verify album updates immediately in Tab A

3. **Check Tab B**:
   - Switch to Tab B
   - Refresh Tab B
   - Verify new album/photo visible in Tab B
   - Tab B shows same state as Tab A

4. **Modify in Tab B**:
   - In Tab B, delete a photo
   - Verify deletion immediate in Tab B
   - Switch to Tab A, refresh
   - Verify deletion reflected in Tab A

**Expected Result**: ✅ PASS
- Multiple tabs can open app concurrently
- Changes in one tab visible in other after refresh
- No data conflicts or corruption
- Databases sync correctly

**Expected Result**: ❌ FAIL
- Data conflicts between tabs
- Changes not visible in other tab after refresh
- App crashes with multiple tabs open
- Data corruption or loss

---

## Validation Scenario 10: Large File Handling

**Goal**: Verify app handles large photo files without crashes or data loss (per SC-006).

**Setup**:
- Prerequisite: Test photo of 5MB size available

**Steps**:

1. **Upload large file**:
   - Click "Upload Photos"
   - Select large-photo-5mb.jpg
   - Click "Upload"
   - Wait for upload to complete (monitor progress indicator if present)

2. **Verify upload success**:
   - Photo appears in album
   - Album photo count increments
   - Photo is usable (can view, thumbnail displays)

3. **Verify storage efficiency**:
   - Check browser storage usage (DevTools → Storage → Local Storage / IndexedDB)
   - Storage used is reasonable (not duplicated)
   - Thumbnail is compressed (not full resolution)

4. **Delete and reload**:
   - Delete the large photo
   - Refresh page
   - Verify deletion persisted, storage reclaimed

**Expected Result**: ✅ PASS
- Large files upload successfully
- No crashes or timeouts
- Storage usage efficient
- Photo data preserved

**Expected Result**: ❌ FAIL
- Upload fails or times out
- Storage usage excessive
- Photo corrupted or missing after upload
- App crashes on large files

---

## Performance Benchmarks

**Success Criteria from Specification**:

| Metric | Target | Status |
|--------|--------|--------|
| Main page load (20+ albums) | <2 seconds | ✅/❌ |
| Drag-and-drop smoothness | No frame drops (60fps) | ✅/❌ |
| Tile grid responsiveness | Renders at 768px+ | ✅/❌ |
| Photo add workflow | <30 seconds | ✅/❌ |
| First-attempt task success | 90% of users | ✅/❌ |
| Large file support | Up to 5MB+ | ✅/❌ |

---

## Known Limitations (Document Before Release)

- Multi-device sync: Not supported (local storage only)
- Export/backup: Feature not in MVP
- Advanced metadata: Only basic EXIF date extracted
- Batch operations: Not in MVP (delete/move one photo at a time)
- Keyboard accessibility: Drag-drop keyboard shortcuts (post-MVP)
- Touch gestures: Basic touch support, advanced gestures (pinch-zoom) post-MVP

---

## Troubleshooting

### Common Issues During Validation

**Issue**: Photos not grouping by date correctly
- **Check**: EXIF metadata present and readable
- **Check**: Photo date format extraction (EXIF DateTime field)
- **Fix**: Manually create albums if EXIF extraction failing

**Issue**: Drag-and-drop not working
- **Check**: Browser supports Drag API (most modern browsers do)
- **Check**: JavaScript console for errors
- **Fix**: Try different browser or clear cache

**Issue**: Large files timeout
- **Check**: Browser storage quota (IndexedDB limits ~50MB)
- **Check**: Network connection
- **Fix**: Upload smaller files or clear old data first

**Issue**: Data not persisting after reload
- **Check**: Browser cookies/storage enabled
- **Check**: Not in private/incognito mode
- **Fix**: Check browser settings, try different browser

---

## Sign-Off

After all scenarios pass:

**Validation Date**: _______________

**Tester Name**: _______________

**Browser/Platform**: _______________

**Notes**: _______________

✅ **APPROVED FOR RELEASE** or ❌ **BLOCKING ISSUES FOUND** (detail above)
