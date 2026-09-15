# Tasks: Photo Organizer

**Input**: Design documents from `/specs/001-photo-organizer/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Feature**: Single-page web application for organizing handcraft work photos into date-grouped albums with drag-and-drop reordering and tile-based photo display. Built with Vite, vanilla JavaScript, sql.js (SQLite), and piexifjs for EXIF metadata extraction.

**Test Strategy**: Unit tests (Vitest) for business logic, integration tests for workflows, manual E2E testing via browser. Target >80% coverage per constitution requirement.

---

## Phase 1: Setup & Project Initialization

**Purpose**: Initialize project structure, install dependencies, configure build tools and linting

**Checkpoint**: Project scaffold ready, all dependencies installed, build pipeline functional

- [x] T001 Create project directory structure per plan.md (src/, tests/, public/, etc.)
- [x] T002 Initialize package.json with project metadata and scripts
- [x] T003 [P] Install core dependencies: Vite 4.x, sql.js, piexifjs
- [x] T004 [P] Install dev dependencies: Vitest, @vitest/ui, ESLint, Prettier
- [x] T005 Create vite.config.js with Vitest configuration per plan.md
- [x] T006 [P] Create .eslintrc.cjs with strict linting rules
- [x] T007 [P] Create .prettierrc with formatting standards (2-space indent, semicolons)
- [x] T008 Create index.html entry point with app container (id="app")
- [x] T009 Create src/main.js app initialization and DOM mounting
- [x] T010 Create src/app.js main application controller with navigation routing
- [x] T011 Create .gitignore excluding node_modules, build outputs, .env
- [x] T012 Initialize git repository and commit initial scaffold

---

## Phase 2: Foundational Infrastructure (Blocking - No User Stories Can Begin Until Complete)

**Purpose**: Core database, storage, and metadata handling infrastructure that all user stories depend on

**Critical Dependency**: All user stories depend on T013-T024. Nothing else can start until these are complete.

### Database & Storage Foundation

- [x] T013 Create src/modules/db.js with SQLite initialization via sql.js
  - Implement `initDB()`: Initialize sql.js, load from IndexedDB if exists
  - Create schema: Albums table (id, album_date UNIQUE, title, photo_count, sort_order, created_at, updated_at, deleted_at)
  - Create schema: Photos table (id, album_id FK, filename, file_size, mime_type, photo_date, upload_date, photo_data_base64, thumbnail_base64, exif_json, created_at, updated_at, deleted_at)
  - Create schema: AlbumOrder table (id, album_id UNIQUE FK, position UNIQUE, last_modified_at)
  - Create indexes on album_date, album_id, sort_order, deleted_at
  - Persistence to IndexedDB for browser storage

- [x] T014 [P] Create src/modules/storage.js for file handling
  - Implement `readFileAsBase64(file)`: Convert File to base64 string
  - Implement `generateThumbnail(base64Data, maxSize)`: Use Canvas API to resize image to 150x150px
  - Implement `compressThumbnail(base64Data)`: Reduce thumbnail quality for storage efficiency
  - Handle MIME type detection (JPEG, PNG, WEBP)

- [x] T015 [P] Create src/modules/exif.js for photo metadata
  - Implement `extractExifDate(file)`: Use piexifjs to parse EXIF DateTimeOriginal
  - Implement `formatExifDate(exifDateString)`: Convert "2026:09:14 10:30:45" to ISO 8601 "2026-09-14"
  - Implement `getPhotoDate(file)`: Extract EXIF date or fallback to file.lastModified
  - Handle missing/corrupted metadata gracefully (return null, not throw)
  - Return full EXIF object as JSON for storage

- [x] T016 [P] Create src/modules/album.js for album operations
  - Implement `createAlbumIfNeeded(albumDate)`: Create album or get existing by date
  - Implement `incrementPhotoCount(albumId)`: Update album photo_count (handles denormalization)
  - Implement `decrementPhotoCount(albumId)`: Update album photo_count and auto-delete if empty
  - Note: CRUD helpers for db.js calls (this module is services layer)

- [x] T017 [P] Create src/modules/photo.js for photo operations
  - Implement `addPhoto(albumId, file)`: Orchestrate upload (EXIF → storage → DB)
  - Implement `removePhoto(photoId)`: Soft delete photo, decrement count
  - Implement `getPhotoUrl(photoData)`: Create data URL from base64
  - Validate file size, MIME type before operations

### Database API Tests (OPTIONAL - TDD approach)

- [x] T018 [P] Create tests/unit/db.test.js
  - Test schema creation and DDL integrity
  - Test CRUD operations (create, read, update, delete albums and photos)
  - Test uniqueness constraints (album_date)
  - Test foreign key relationships
  - Mock IndexedDB for testing

- [x] T019 [P] Create tests/unit/exif.test.js
  - Test EXIF date extraction from real sample photos
  - Test fallback to upload date when EXIF missing
  - Test corrupted EXIF handling
  - Test date format conversion

---

## Phase 3: User Story 1 - Create and View Photo Albums (Priority: P1) 🎯 MVP

**Goal**: Users can upload photos, have them automatically grouped into date-based albums, and view all albums on main page with photos in tile grid

**Independent Test**: Upload photos from different dates → albums created → click album → tiles display → main page still shows all albums

**Acceptance Criteria**:
1. Photos uploaded → grouped by EXIF date → album created automatically
2. Main page displays all albums in grid layout with dates and photo counts
3. Click album → view photos in responsive tile layout (3-4 columns on desktop, 1-2 on mobile)
4. Album dates displayed prominently, ordered chronologically (newest first by default)

### Implementation Tasks for User Story 1

#### Data Models

- [x] T020 [US1] Create src/models/Album.js class with properties from data-model.md
  - Fields: id, album_date (YYYY-MM-DD), title (optional), photo_count, sort_order (null), created_at, updated_at
  - Validation: album_date must be ISO 8601 date, title max 255 chars
  - Methods: `toJSON()`, `getDisplayTitle()` (formatted date or custom title)

- [x] T021 [US1] Create src/models/Photo.js class
  - Fields: id, album_id, filename, file_size, mime_type, photo_date, upload_date, photo_data_base64, thumbnail_base64, exif_json
  - Validation: album_id must exist, filename max 255 chars, file_size > 0
  - Methods: `toJSON()`, `getThumbnailUrl()` (data URL)

#### Core Business Logic

- [x] T022 [US1] Implement album grouping logic in src/modules/album.js
  - Function `groupPhotosByDate(files)`: Takes File array → groups by album_date → returns Map<date, files>
  - Function `ensureAlbumsExist(dateGroups)`: Creates albums in DB for each date group (or reuse existing)
  - Handles concurrency (multiple photos same date)

- [x] T023 [US1] Implement photo upload orchestration in src/modules/photo.js
  - Function `uploadPhotos(files)`: Main entry point
  - For each file: extract EXIF → create/get album → generate thumbnail → insert Photo → update count
  - Return uploaded Photo records
  - Error handling: invalid file → skip with warning, valid file → proceed

#### Main Page UI

- [x] T024 [US1] Create src/ui/album-grid.js for main page display
  - Function `renderAlbumGrid(albums)`: Build HTML grid with album cards
  - Each card: album thumbnail (first photo), title, photo count, "View" and "Delete" buttons
  - Grid responsive: 1 col (mobile <768px), 2 cols (tablet 768-1024px), 3 cols (desktop 1024-1440px), 4 cols (large >1440px)
  - Grid gap and card sizing per layout.css
  - WCAG 2.1 AA: semantic HTML, ARIA labels, alt text on images

- [x] T025 [US1] Create src/ui/album-view.js for individual album viewing
  - Function `renderAlbumView(album, photos)`: Display photos in tile grid (same responsive rules as album-grid)
  - Each tile: thumbnail, hover to show delete button
  - Back button to return to main page
  - Photo count and album date displayed at top
  - Pagination or virtualization for 50+ photos (lazy load)

- [x] T026 [US1] Create src/ui/photo-tile.js for photo tile component
  - Function `createPhotoTile(photo)`: Build tile HTML with thumbnail, actions
  - Aspect ratio: square, consistent sizing, no distortion
  - Hover state: show delete button, change cursor
  - Accessibility: ARIA label with photo filename/date

#### Application Integration

- [x] T027 [US1] Implement main page controller in src/app.js
  - Function `initMainPage()`: Load albums from DB → render album grid
  - Attach event listeners: "View" button → navigate to album-view, "Delete" button → confirm → delete
  - Handle upload button: file picker → uploadPhotos() → re-render grid
  - Window resize listener: recalculate grid layout (debounce 300ms)

- [x] T028 [US1] Create src/ui/file-upload.js for upload dialog
  - Function `showFileUploadDialog()`: Native file picker (accept .jpg, .png, .webp)
  - Allow multiple file selection
  - Return selected File array
  - Cancel support

#### Styles for User Story 1

- [x] T029 [US1] Create src/styles/main.css with base styles
  - Color variables (light/dark theme aware)
  - Typography (font-family, sizes, line-height)
  - Buttons, inputs, focus states
  - WCAG AA color contrast (text ≥4.5:1, UI ≥3:1)

- [x] T030 [US1] Create src/styles/layout.css
  - Grid layout utilities (grid-template-columns, gap responsive)
  - Flexbox utilities (center, space-between, wrap)
  - Responsive breakpoints (768px, 1024px, 1440px)
  - Media queries for dark mode (@prefers-color-scheme)

- [x] T031 [US1] Create src/styles/components.css
  - Album card styling (border, shadow, hover state)
  - Photo tile styling (aspect ratio, overflow)
  - Button styles (primary, secondary, hover, active)
  - Loading spinner, empty state placeholders

#### User Story 1 Integration Tests (OPTIONAL)

- [x] T032 [P] [US1] Create tests/integration/album-upload-view.test.js
  - Test: Upload 3 photos (different dates) → DB has 3 albums → grid shows 3 cards
  - Test: Click album → album-view shows correct photos
  - Test: Back button → return to main page
  - Mock uploadPhotos(), initDB()

- [x] T033 [US1] Create tests/integration/exif-grouping.test.js
  - Test: Upload photos with EXIF dates → grouped correctly
  - Test: Upload photo without EXIF → grouped by upload date
  - Test: Mixed photos (with/without EXIF) → correct grouping

**⚠️ CHECKPOINT: User Story 1 MVP COMPLETE**
- Main page shows album grid with thumbnails
- Upload works, albums created, photos displayed in tiles
- Can be tested independently per quickstart.md Scenario 1 & 4
- Ready to demo or release as MVP

---

## Phase 4: User Story 2 - Reorder Albums by Drag and Drop (Priority: P1)

**Goal**: Users can drag albums on main page to reorder them, custom order persists across page reloads

**Independent Test**: Upload 3 albums → drag first to end → refresh page → order still changed → drag second to position 1 → order updates

**Acceptance Criteria**:
1. Drag album card → visual feedback (opacity, insertion line)
2. Drop on new position → order updated, persisted to DB
3. Page reload → custom order restored
4. Drop outside zone → snap back to original position
5. No data loss or album corruption

### Implementation Tasks for User Story 2

#### Drag-and-Drop Logic

- [x] T034 [US2] Create src/modules/dnd.js for drag-drop handling
  - Function `initDragDrop(gridElement, onReorderCallback)`: Attach event listeners
  - Implement `dragstart` handler: Set drag image, store dragged album ID, set cursor
  - Implement `dragover` handler: Prevent default, show insertion indicator, calculate new position
  - Implement `drop` handler: Validate drop, call onReorderCallback(albumId, newPosition)
  - Implement `dragend` handler: Clean up visual state (remove insertion line, reset opacity)
  - Handle edge cases: drag outside grid, drop on self, concurrent drags

- [x] T035 [US2] Update src/modules/album.js with reordering
  - Function `reorderAlbums(albumId, newPosition)`: Update AlbumOrder table, reindex positions atomically
  - Validation: newPosition >= 0 and < total albums, no duplicates
  - Handle position gaps: if delete middle album, reindex remaining
  - Update Album.updated_at on all affected albums

- [x] T036 [US2] Update src/modules/db.js with AlbumOrder operations
  - Function `updateAlbumOrder(albumId, newPosition)`: INSERT or UPDATE AlbumOrder record
  - Function `getAlbumsByCustomOrder()`: SELECT * FROM Albums ORDER BY AlbumOrder.position (or album_date DESC if no custom order)
  - Atomic transaction: update multiple positions in one transaction

#### UI Updates for Drag-Drop

- [x] T037 [US2] Update src/ui/album-grid.js for drag-drop visual feedback
  - Add `draggable="true"` to album cards
  - CSS class `.dragging`: opacity 0.5, cursor: grabbing
  - CSS class `.drag-over`: border highlight, insertion line
  - Function `showInsertionIndicator(position)`: Visual indicator where album will land
  - Function `hideInsertionIndicator()`: Clean up after drop

- [x] T038 [US2] Update src/styles/components.css with drag-drop styles
  - `.album-card[draggable]`: cursor: grab (hover), grabbing (active)
  - `.album-card.dragging`: opacity: 0.5, transform: scale(0.95) (optional)
  - `.album-card.drag-over::before`: insertion line (border-top: 2px solid accent)
  - Smooth transitions (0.2s) for visual changes

#### Application Integration

- [x] T039 [US2] Update src/app.js main page controller
  - After rendering album grid, call `initDragDrop(gridElement, handleReorder)`
  - Implement `handleReorder(albumId, newPosition)`: Call reorderAlbums() → re-render grid with new order
  - Persist drag-drop state: update album-grid with new order immediately

#### Drag-Drop Tests (OPTIONAL)

- [x] T040 [P] [US2] Create tests/unit/dnd.test.js
  - Test: Drag event fires, position calculated correctly
  - Test: Drop event triggers reorder callback
  - Test: Invalid drop (outside zone) rejected
  - Test: Visual feedback (classes added/removed)

- [x] T041 [US2] Create tests/integration/album-reorder.test.js
  - Test: Drag album A over B → positions updated
  - Test: Refresh page → order persists
  - Test: Reorder multiple times → order correct

**⚠️ CHECKPOINT: User Story 2 COMPLETE**
- Drag-and-drop working smoothly on main page
- Order persists across reloads
- Can be tested independently per quickstart.md Scenario 3
- MVP feature set complete (US1 + US2)

---

## Phase 5: User Story 3 - Manage Photos Within Albums (Priority: P2)

**Goal**: Users can add photos to existing albums and delete photos from albums, photo operations update album display and counts

**Independent Test**: Open album → add photo → count increments, photo visible → delete photo → count decrements, photo gone → refresh → count still correct

**Acceptance Criteria**:
1. "Add Photos" button in album view opens file picker
2. Select photo(s) → upload to current album → tile grid updates
3. Hover/click photo → delete button appears
4. Click delete → confirm dialog → delete → photo removed, count decrements
5. Photo count updates on main page album card

### Implementation Tasks for User Story 3

#### Photo Management Logic

- [ ] T042 [US3] Update src/modules/photo.js for album-specific operations
  - Function `addPhotoToAlbum(albumId, files)`: Upload files to specific album
  - Reuse EXIF extraction, thumbnail generation from foundational phase
  - Update photo_count for album
  - Return new Photo records for tile grid update

- [ ] T043 [US3] Update src/modules/db.js with soft delete support
  - Function `deletePhoto(photoId)`: Soft delete (set deleted_at timestamp)
  - Function `getPhotos(albumId, offset, limit)`: Query only WHERE deleted_at IS NULL
  - Ensure photo_count in Album decremented on delete
  - Handle cascade: if album becomes empty, optionally delete album (TBD per spec)

#### Album Detail Page UI

- [ ] T044 [US3] Update src/ui/album-view.js with add/delete photo support
  - Add "Add Photos" button at top of album view
  - Implement `addPhotosToAlbum(albumId)`: Show file picker → call addPhotoToAlbum() → re-render tiles
  - Implement `deletePhoto(photoId)`: Show confirmation dialog → call deletePhoto() → re-remove tile
  - Confirmation dialog text: "Delete this photo? This cannot be undone."
  - Button styles: "Cancel", "Delete" (destructive red)

- [ ] T045 [US3] Update src/ui/photo-tile.js with delete action
  - Add delete button (icon or text) on hover/focus
  - Button accessibility: aria-label="Delete photo: {filename}"
  - Click handler: pass click event up to album-view for confirmation

#### Styles for User Story 3

- [ ] T046 [US3] Update src/styles/components.css
  - Photo tile delete button: position absolute (top-right), show on hover
  - Delete button: background red, white text, hover darker
  - Confirmation dialog backdrop: semi-transparent, center modal
  - Modal button styles: Cancel (secondary), Delete (destructive primary)

#### Modals/Dialogs

- [ ] T047 [US3] Create src/ui/modals.js for confirmation dialogs
  - Function `showConfirmDialog(title, message, onConfirm, onCancel)`: Modal dialog
  - Accessible: focus trap, keyboard support (Enter = confirm, Esc = cancel)
  - HTML structure: overlay, dialog box, button group
  - Return Promise that resolves on user action

#### Photo Management Tests (OPTIONAL)

- [ ] T048 [P] [US3] Create tests/unit/photo.test.js
  - Test: Add photo to album → photo_count incremented
  - Test: Delete photo → soft deleted (deleted_at set)
  - Test: Query photos → deleted photos excluded

- [ ] T049 [US3] Create tests/integration/photo-management.test.js
  - Test: Add photo in album-view → grid updates immediately
  - Test: Delete photo → count decrements, photo removed
  - Test: Refresh page → photo count still correct (delete persisted)

**⚠️ CHECKPOINT: User Story 3 COMPLETE**
- Full CRUD for photos within albums
- Add and delete working per spec
- Can be tested independently per quickstart.md Scenario 5 & 6

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, comprehensive testing, accessibility, documentation, and validation

**Checkpoint**: Feature complete, tested, optimized, documented

### Performance & Testing

- [ ] T050 [P] Create tests/unit/album.test.js
  - Test album creation, photo count increments/decrements
  - Test album deletion (cascade photos)
  - Test empty album handling

- [ ] T051 [P] Create tests/unit/storage.test.js
  - Test base64 conversion
  - Test thumbnail generation (image quality, size)
  - Test MIME type detection

- [ ] T052 Create vitest.config.js with coverage reporting
  - Add coverage threshold: 80% minimum for statements, branches, functions, lines
  - Output coverage reports (html, text)
  - Fail build if coverage <80% (per constitution requirement)

- [ ] T053 [P] Add performance benchmarks in tests/perf/
  - Benchmark: Album grid render with 20 albums (target <200ms)
  - Benchmark: Photo tile grid with 100 photos (target <500ms)
  - Benchmark: Drag-drop event handlers (target <16ms per frame = 60fps)
  - Benchmark: Database queries (target <100ms for getAlbums, getPhotos)

- [ ] T054 Create Lighthouse CI configuration
  - Measure: Performance score >90
  - Measure: Accessibility score >95
  - Measure: Bundle size <500KB (gzipped)
  - Fail if any metric regresses

### Accessibility & Browser Testing

- [ ] T055 [P] Add WCAG 2.1 AA accessibility audit
  - Run axe-core accessibility tests in CI
  - Test: Color contrast ≥4.5:1 for text, ≥3:1 for UI
  - Test: Keyboard navigation (Tab through all interactive elements)
  - Test: ARIA labels on all buttons, images, landmarks
  - Test: Focus indicators visible on all interactive elements

- [ ] T056 [P] Test across browsers per plan.md
  - Chrome latest
  - Firefox latest
  - Safari latest
  - Edge latest
  - Document any compatibility issues

- [ ] T057 Test mobile responsiveness
  - 375px (iPhone SE) → 1 column tiles
  - 768px (iPad) → 2 column tiles
  - 1024px (desktop) → 3 column tiles
  - 1440px (large desktop) → 4 column tiles
  - No horizontal scrolling required

### Documentation & Validation

- [ ] T058 [P] Create CONTRIBUTING.md with development guide
  - Setup instructions (npm install, npm run dev)
  - Build instructions (npm run build)
  - Test instructions (npm test, npm run coverage)
  - Code style guide (ESLint, Prettier, variable naming)
  - Commit message conventions (per constitution)

- [ ] T059 Create README.md with project overview
  - Feature description
  - Tech stack
  - Getting started (setup, first run)
  - Project structure explanation
  - Known limitations
  - Future enhancements (post-MVP)

- [ ] T060 Create TESTING.md with test guide
  - Unit test examples
  - Integration test examples
  - How to run tests and coverage
  - TDD workflow explanation
  - Mocking IndexedDB and sql.js

- [ ] T061 Run quickstart.md validation scenarios manually
  - Scenario 1: Album auto-grouping by date ✅
  - Scenario 2: Photo fallback when EXIF missing ✅
  - Scenario 3: Drag-and-drop persistence ✅
  - Scenario 4: Photo tile responsive layout ✅
  - Scenario 5: Add photo to album ✅
  - Scenario 6: Delete photo ✅
  - Scenario 7: Delete album ✅
  - Scenario 8: Performance with 100+ photos ✅
  - Scenario 9: Multi-tab consistency ✅
  - Scenario 10: Large file handling ✅

### Code Quality & Refactoring

- [ ] T062 [P] Run full linting pass
  - ESLint: zero warnings/errors
  - Prettier: auto-format all files
  - Remove console.logs from production code
  - Fix type issues (use JSDoc for vanilla JS)

- [ ] T063 Optimize database queries
  - Add indexes as per data-model.md
  - Lazy-load photo data (thumbnails first, full data on demand)
  - Implement pagination for 50+ photos per album
  - Benchmark queries to ensure <100ms

- [ ] T064 Optimize bundle size
  - Check sql.js size (should be ~500KB gzipped)
  - Check piexifjs size (should be ~15KB gzipped)
  - Tree-shake unused code
  - Measure final bundle size (<500KB total)

- [ ] T065 [P] Code review and refactoring
  - Review all module interfaces per contracts/
  - Simplify any overcomplicated functions
  - Extract repeated code patterns
  - Ensure no code duplication (DRY principle)

### Release Preparation

- [ ] T066 Create CHANGELOG.md
  - Feature summary
  - User stories implemented (US1, US2, US3)
  - Known limitations
  - Performance metrics

- [ ] T067 Prepare release notes for v1.0.0
  - What's included in MVP
  - How to use (user guide)
  - Browser support matrix
  - Storage requirements
  - Known issues (if any)

- [ ] T068 Final E2E smoke test
  - Fresh browser instance
  - Open app
  - Upload photos
  - Create album
  - Reorder album
  - Add/delete photos
  - Verify all works smoothly
  - Check console for errors

- [ ] T069 Commit final code and tag release
  - Commit: "chore: v1.0.0 photo organizer MVP release"
  - Tag: git tag -a v1.0.0 -m "Photo Organizer MVP"
  - Push to main branch

**✅ RELEASE READY: Photo Organizer v1.0.0 MVP**

---

## Dependencies & Execution Order

### Critical Path to MVP

```
Phase 1 (Setup) → Phase 2 (Foundational) → US1 (Create/View) → US2 (Drag-Drop) → Phase 6 (Polish)
```

Phase 1 and 2 are strictly sequential (must finish before any user stories). US1 and US2 are both P1 and can start after Phase 2 completes, but US2 depends on US1 UI (album grid).

### Parallelizable Tasks by Phase

**Phase 1**:
- T003-T004: Dependencies (parallel)
- T006-T007: Linting config (parallel)
- T014-T015: Storage & EXIF modules (parallel)

**Phase 2**:
- T014-T015: Parallel if not already done
- T018-T019: Tests (parallel)

**Phase 3 (US1)**:
- T020-T021: Models (parallel)
- T032-T033: Integration tests (parallel)
- T029-T031: Styles (parallel)

**Phase 5 (US3)**:
- T048-T049: Tests (parallel)
- T042-T043: Modules (parallel)

**Phase 6 (Polish)**:
- T050-T057: Tests, perf, accessibility (mostly parallel)
- T058-T059: Documentation (parallel)
- T062-T065: Code quality (somewhat parallel)

### Within-Story Parallelization

**Example: Phase 3 (US1) Parallel Teams**:
```
Developer A:     Developer B:           Developer C:
T020 (Album)     T021 (Photo)           T029-T031 (Styles)
  ↓                ↓                         ↓
T022-T023        T024 (Album Grid)     [run in parallel]
(Grouping)       T025 (Album View)
  ↓                ↓
T027 (Integration) → Sync
  ↓
T032-T033 (Tests)
```

All model tasks (T020-T021) can run in parallel. UI tasks (T024-T026) can run in parallel after models. Styles (T029-T031) fully parallel with logic.

---

## Implementation Strategy: MVP First

### Minimum Viable Product (User Stories 1 & 2)

**Scope**: Photo upload + album grouping + album viewing + drag-drop reordering

**Timeline**: 
- Phase 1 (Setup): 1-2 days
- Phase 2 (Foundational): 2-3 days
- Phase 3 (US1): 3-4 days
- Phase 4 (US2): 1-2 days
- **Total MVP: ~7-10 days for one developer**

**MVP Checkpoint**: After Phase 4 complete
- Users can upload photos
- Albums created automatically by date
- Main page shows album grid
- Can reorder albums by drag-drop
- Order persists across reloads
- Ready for initial user feedback

**Skip for MVP**: 
- User Story 3 (add/delete photos within album) - can add post-launch
- Performance optimization - address if needed after user testing
- Advanced accessibility features (post-MVP: keyboard drag-drop)
- Hard delete option (soft delete sufficient for MVP)

### Incremental Delivery (All Stories)

**After MVP launched**:
1. Gather user feedback on US1 & US2
2. Add US3 (photo management) if requested
3. Optimize performance if needed
4. Add cloud sync (post-v1)
5. Mobile app version (Tauri or React Native post-v1)

---

## Notes & Conventions

### Task IDs

- T001-T012: Phase 1 (Setup) - 12 tasks
- T013-T041: Phase 2 (Foundational) + US2 tests - 29 tasks
- T020-T033: Phase 3 (US1) - 14 tasks (T020 starts in US1, not foundational)
- T034-T041: Phase 4 (US2) - 8 tasks
- T042-T049: Phase 5 (US3) - 8 tasks
- T050-T069: Phase 6 (Polish) - 20 tasks
- **Total: 69 tasks**

### Checklist Format

Each task follows strict format:
```
- [ ] TXXX [P?] [Story?] Description with file path
```

- `[P]`: Tasks can run in parallel (different files, no blocked dependencies)
- `[Story]`: Maps to user story (US1, US2, US3) - only for story-phase tasks
- File path: Exact location (src/modules/db.js, tests/unit/exif.test.js, etc.)

### Testing Philosophy

- **Unit Tests**: Business logic (album grouping, EXIF extraction, photo management)
- **Integration Tests**: User workflows (upload → album → view → reorder)
- **E2E Tests**: Manual via browser, automated per quickstart.md scenarios
- **TDD Optional**: Tests marked "OPTIONAL" - include if you prefer TDD, skip if test-after
- **Coverage Goal**: >80% per constitution requirement

### Per-File Task Batching

Group tasks by file to reduce context switching:
- All db.js changes → T013
- All album.js changes → T016, T022, T035
- All photo.js changes → T017, T023, T042
- All album-grid.js changes → T024, T037

---

## Success Checklist

- [x] All 3 user stories mapped to phases
- [x] Foundational phase blocks all stories (T013-T019)
- [x] Each user story independently testable
- [x] Phase 6 includes validation per quickstart.md
- [x] >80% test coverage target documented
- [x] Accessibility (WCAG 2.1 AA) included
- [x] Performance benchmarks documented
- [x] Task format: ID + Story + File paths strict
- [x] Parallelization opportunities documented
- [x] MVP scope clear (US1 + US2)

---

## Quick Reference: Task by User Story

| Story | Priority | Phase | Tasks | Focus |
|-------|----------|-------|-------|-------|
| US1 | P1 | 3 | T020-T033 | Upload, grouping, view |
| US2 | P1 | 4 | T034-T041 | Drag-drop, order, persist |
| US3 | P2 | 5 | T042-T049 | Add/delete photos, manage |

**MVP Scope**: Complete Phase 1 → 2 → 3 → 4 and deploy
**Extended**: Add Phase 5 (US3) for full v1.0
**Polish**: Phase 6 (testing, performance, docs) run in parallel with feature work
