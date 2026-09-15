---

description: "Task list for Emi's Craft House - Playful Kids Photo Gallery Redesign"
---

# Tasks: Emi's Craft House - Playful Kids Photo Gallery Redesign

**Input**: Design documents from `/specs/002-emis-crafthouse-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/db-module-contract.md, contracts/ui-views-contract.md, quickstart.md

**Tests**: Included. The project constitution mandates comprehensive testing (>80% coverage, tests written before/alongside implementation), and `plan.md`'s Constitution Check commits explicitly to new unit/integration tests for every new behavior, so test tasks are generated per user story.

**Organization**: Tasks are grouped by user story (from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Maps the task to US1–US4 from `spec.md`
- Every task includes an exact repository-relative file path

## Path Conventions

Single-project layout (per `plan.md`'s Structure Decision): `src/`, `tests/`, `index.html` at repository root — no `backend/`/`frontend/` split.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Global branding and design-token groundwork every subsequent phase builds on.

- [X] T001 Update `index.html`: change `<title>` and `<meta name="description">` to reflect "Emi's Craft House" (replacing "Photo Organizer"/"A local photo organizer for handcraft work photos"), and add `<link>` tags loading the "Baloo 2" (headings) and "Nunito" (body) Google Fonts families, per `research.md` item 6 and item 8.
- [X] T002 [P] Retint `src/styles/main.css`'s `:root` design tokens to the requested palette — `--color-primary: #EC4899`, `--color-secondary: #8B5CF6`, and new `--color-light-pink: #FCE7F3`, `--color-light-purple: #EDE9FE`, `--color-bg: #FFF7FC`, `--color-text: #3B2850` — and add `--font-heading: 'Baloo 2', system-ui, sans-serif;` / `--font-body: 'Nunito', system-ui, sans-serif;` tokens, per `research.md` item 6.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persisted schema change, shared data-query functions, and shared UI components that every user-story phase depends on.

**⚠️ CRITICAL**: No user-story phase may begin until this phase is complete.

- [X] T003 In `src/modules/db.js`'s `createSchema()`, add the new column to the `CREATE TABLE Photos` statement exactly as specified in `data-model.md`: `is_favorite` — **"integer (0/1), NOT NULL, default 0"** (SQL: `is_favorite INTEGER NOT NULL DEFAULT 0`).
- [X] T004 In `src/modules/db.js`'s `initDB()`, after the `if (stored)` branch loads an existing database, implement the migration from `research.md` item 1: run `PRAGMA table_info(Photos)`, check whether a column named `is_favorite` is present, and if not, run `ALTER TABLE Photos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0` then `await persistDB()`. Must be idempotent (safe to run on every load). Depends on T003.
- [X] T005 [P] In `src/models/Photo.js`, add `is_favorite` to the constructor (default `0` when absent) and to `toJSON()`, matching the **"integer (0/1), NOT NULL, default 0"** constraint from `data-model.md`.
- [X] T006 In `src/modules/db.js`, implement `export async function toggleFavorite(photoId)` per `contracts/db-module-contract.md`: flips `is_favorite` (0↔1) for the given photo, touches `updated_at`, calls `persistDB()`, returns the updated photo (same shape as `getPhoto()`), and throws `"Photo not found"` for a non-existent/deleted photo id (mirroring `deletePhoto`). Depends on T004.
- [X] T007 In `src/modules/db.js`, implement `export function getAllPhotos({ favoritesOnly = false, offset = 0, limit = 50 } = {})` per `contracts/db-module-contract.md`: single query joining `Photos p` and `Albums a` (`WHERE p.deleted_at IS NULL AND a.deleted_at IS NULL`, add `AND p.is_favorite = 1` when `favoritesOnly`), returning `p.*, a.album_date, a.title AS album_title`, ordered `p.photo_date DESC, p.upload_date DESC`, paginated via `LIMIT ? OFFSET ?`. Depends on T004.
- [X] T008 In `src/modules/db.js`, extend `getAlbums(sortByCustom)` per `contracts/db-module-contract.md` and `research.md` item 4: add `cover_thumbnail_base64` to each returned album, sourced via a `LEFT JOIN`/subquery selecting the `thumbnail_base64` of the most recently uploaded (`ORDER BY upload_date DESC LIMIT 1`), non-deleted photo in that album (`null` if the album has zero photos). Keep the existing custom-order/date-order behavior unchanged. Depends on T004.
- [X] T009 [P] Create `src/ui/empty-state.js` exporting `createEmptyState(variant)` for `variant` in `'photos' | 'albums' | 'favorites'`, per `contracts/ui-views-contract.md` and `spec.md`'s Empty States: the `'photos'` variant renders an icon, "No creations yet!", "Let's add your first craft photo and start your gallery.", and an "Add My First Photo" button; `'albums'` and `'favorites'` get analogous friendly copy and CTAs.
- [X] T010 [P] Create `src/ui/photo-card.js` exporting `createPhotoCard(photo, options)` (`options: { showAlbumLabel?, showCheckbox? }`) per `contracts/ui-views-contract.md`: renders thumbnail (reusing the existing `thumbnail_base64`-to-data-URL logic from `album-view.js::createPhotoTile`), a date label, an optional album label, a favorite-heart control reflecting `photo.is_favorite`, and an optional selection checkbox; the heart control dispatches a `photo-card:favorite-toggle` custom event with `detail: { photoId }` (bubbling) instead of taking an inline callback.
- [X] T011 [P] Create `src/ui/nav.js` exporting `renderNav(activeSection)` (`activeSection` in `'home' | 'photos' | 'albums' | 'favorites' | 'settings'`) and `attachNavEvents(navElement, onNavigate)` per `contracts/ui-views-contract.md`: Home/My Photos/Albums/Favorites/Settings items, a pill-style highlight on `activeSection`, and a mobile-menu toggle for narrow viewports.
- [X] T012 [P] Add shared foundation styles to `src/styles/components.css` and `src/styles/layout.css`: rounded-card base class (radius, soft shadow), primary/secondary button styles (pink/purple gradient + white text + shadow for primary; white background + purple border/text for secondary), nav-bar and pill-highlight styles, mobile-menu collapse rules, and a documented `@media (prefers-reduced-motion: no-preference)` convention for all future animation rules, per `spec.md`'s Buttons/Navigation/Animations sections and `research.md` item 6.

**Checkpoint**: Foundation ready — schema migrated, shared queries available, shared card/nav/empty-state components exist. User-story phases can now begin.

---

## Phase 3: User Story 1 - Discover the New Home & Gallery (Priority: P1) 🎯 MVP

**Goal**: A cheerful "Emi's Craft House" home page with hero, nav, and a redesigned, date-grouped photo gallery showing all existing photos — the primary first impression.

**Independent Test**: Load the app with existing photos already in the database; verify the hero, nav, and gallery render with the new design, existing photos still display grouped by date, and no data/functionality is lost.

### Tests for User Story 1

- [X] T013 [P] [US1] Integration test in `tests/integration/home-gallery-redesign.test.js`: seed the database with photos across multiple dates via the existing upload pipeline, render the Home/My Photos flow, and assert the hero, nav, and photo cards (grouped under month/year date-section headers) are present, and that an empty database instead renders the `'photos'` empty state from `ui/empty-state.js`.
- [X] T014 [P] [US1] Unit test in `tests/unit/photo-gallery.test.js` for the month/year date-bucketing helper used by `ui/photo-gallery.js`: given photos with varying `photo_date` values, assert they are grouped into correctly labeled, correctly ordered buckets (e.g., "September 2026" before "August 2026").

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/ui/hero.js` exporting `renderHero()` and `attachHeroEvents(heroElement, onAddPhotos, onCreateAlbum)` per `contracts/ui-views-contract.md`: title "Emi's Craft House", tagline "Your special creations, beautifully organized!", a primary "Add Photos" button, a secondary "Create Album" button, and subtle decorative shapes (stars/hearts/sparkles), sized compactly per `spec.md`'s "hero compact enough that gallery is visible without excessive scrolling" requirement.
- [X] T016 [P] [US1] Create `src/ui/photo-gallery.js` exporting `renderPhotoGallery(photos, options)` and `attachPhotoGalleryEvents(galleryElement, onToggleFavorite, onDeletePhoto)` per `contracts/ui-views-contract.md`: groups the already-sorted `photos` array by month/year (the helper tested in T014), renders `ui/photo-card.js::createPhotoCard` cards in a responsive grid under date-section headers, and renders `ui/empty-state.js`'s `'photos'`/`'favorites'` variant via `options.emptyStateVariant` when `photos.length === 0`.
- [X] T017 [US1] In `src/app.js`, replace the current `addHeader()`/`renderMainPage()`-only flow with a section router: mount `ui/nav.js::renderNav('home')` plus `ui/hero.js::renderHero()` plus `ui/photo-gallery.js::renderPhotoGallery(getAllPhotos())` for the Home section, keeping the existing `initDB()`/error-handling flow intact. Depends on T015, T016, and Phase 2 (T007 `getAllPhotos`, T011 `nav.js`).
- [X] T018 [P] [US1] Add hero, nav, and gallery-grid responsive layout rules to `src/styles/layout.css`: compact hero sizing, a responsive grid for the photo gallery, and breakpoints (~1024px desktop / 768–1023px tablet / <768px mobile) ensuring no horizontal overflow from 320px to 2560px per `spec.md` SC-003.
- [X] T019 [P] [US1] Add hover-lift and fade/slide-in styles for hero and gallery-card elements to `src/styles/components.css`, wrapped in `@media (prefers-reduced-motion: no-preference)` per `research.md` item 6 and `spec.md` FR-018.

**Checkpoint**: User Story 1 is fully functional and independently testable — home page shows hero, nav, and a working, date-grouped gallery of all existing photos.

---

## Phase 4: User Story 2 - Browse Colorful Albums (Priority: P2)

**Goal**: Colorful, informative album cards (cover image, title, count, date, gradient accent) while all existing album CRUD/reorder behavior keeps working unchanged.

**Independent Test**: With existing albums in the database, open Albums and verify cards show a cover image/title/count/date-range with the new styling; verify drag-and-drop reordering, opening, and deleting an album still work.

### Tests for User Story 2

- [X] T020 [P] [US2] Unit test in `tests/unit/db.test.js` (extend existing file): assert `getAlbums()` returns `cover_thumbnail_base64` matching the most recently uploaded photo's thumbnail for an album with photos, and `null` for an album with zero photos.
- [X] T021 [P] [US2] Integration test in `tests/integration/album-redesign.test.js`: render the redesigned album grid for seeded albums and assert each card shows the cover thumbnail, title, photo count, and date; assert drag-and-drop reordering (reusing the existing `modules/dnd.js` flow) still persists the new order via `updateAlbumOrder`. Existing `tests/integration/album-reorder.test.js` must continue to pass unmodified.

### Implementation for User Story 2

- [X] T022 [US2] Update `src/ui/album-grid.js::createAlbumCard` to render `album.cover_thumbnail_base64` as the card's cover image (falling back to the existing `📁` placeholder only when absent), and add a gradient-accent class per card, per `contracts/ui-views-contract.md` and `research.md` item 4. Function signature stays `createAlbumCard(album)`.
- [X] T023 [US2] Update `src/ui/album-grid.js::renderAlbumGrid`'s empty-state branch to call `ui/empty-state.js::createEmptyState('albums')` instead of its inline empty-state HTML.
- [X] T024 [P] [US2] Add rounded-corner, soft-shadow, hover-lift, and 3–4 colorful gradient-accent variant classes for album cards to `src/styles/components.css`, wrapped in `@media (prefers-reduced-motion: no-preference)` for the hover animation per `spec.md`'s Albums section.
- [X] T025 [US2] In `src/app.js`, wire the Albums nav section: mount `ui/nav.js::renderNav('albums')` plus the existing `renderAlbumGrid`/`attachAlbumGridEvents`/`attachAlbumDragDrop` flow (unchanged data/behavior) under the new section router from T017. Depends on T017, T022.

**Checkpoint**: User Stories 1 and 2 both work independently — home gallery and colorful album browsing with preserved drag-and-drop/CRUD.

---

## Phase 5: User Story 3 - Joyful Photo Upload (Priority: P3)

**Goal**: A redesigned drag-and-drop upload area with pending-photo previews and per-item removal, while the existing import/EXIF/storage pipeline remains completely untouched.

**Independent Test**: Trigger upload via drag-and-drop and via the picker button; verify thumbnails preview before confirming, an individual pending photo can be removed, and after confirming, photos are correctly dated/grouped exactly as before.

### Tests for User Story 3

- [X] T026 [P] [US3] Integration test in `tests/integration/upload-zone.test.js`: simulate dragging files over `ui/upload-zone.js`'s drop target (assert the drag-active visual state), drop/select files (assert pending thumbnails render), remove one pending file (assert it's excluded), confirm (assert the existing `modules/photo.js::uploadPhotos` is invoked with the remaining files and the resulting photos appear correctly dated/grouped).
- [X] T027 [P] [US3] Unit test in `tests/unit/upload-zone.test.js` for the pending-file list state management in `ui/upload-zone.js` (add via drop, add via picker, remove by index, and that `URL.revokeObjectURL` is called on removal/confirm).

### Implementation for User Story 3

- [X] T028 [US3] Create `src/ui/upload-zone.js` exporting `renderUploadZone()` and `attachUploadZoneEvents(zoneElement, onConfirm)` per `contracts/ui-views-contract.md` and `research.md` item 5: native `dragenter`/`dragover`/`dragleave`/`drop` handlers with a visual drag-active state; a "Choose photos from your device" button delegating to the existing, unmodified `ui/file-upload.js::showFileUploadDialog()`; pending-file thumbnails previewed via `URL.createObjectURL(file)` with per-item removal (calling `URL.revokeObjectURL`); a confirm action invoking `onConfirm(files)` with the final file list.
- [X] T029 [US3] In `src/app.js`, replace the direct `showFileUploadDialog()` calls in `handleUploadPhotos`/`handleAddPhotos` with the new `ui/upload-zone.js` flow (mounted from the hero's "Add Photos" button and from the album-view "+ Add Photos" action), passing the existing, unmodified `modules/photo.js::uploadPhotos(files)` as `onConfirm`. Depends on T028.
- [X] T030 [P] [US3] Add drag-active highlight, upload-icon, pending-thumbnail grid, and remove-button styles to `src/styles/components.css` for the upload zone, per `spec.md`'s Upload Experience section, wrapped in `@media (prefers-reduced-motion: no-preference)` where animated.

**Checkpoint**: User Stories 1, 2, and 3 all work independently — playful upload experience with the existing import pipeline fully intact.

---

## Phase 6: User Story 4 - Mark and View Favorites (Priority: P4)

**Goal**: A persisted favorite toggle on every photo card and a dedicated Favorites section showing only favorited photos.

**Independent Test**: Favorite a photo from the gallery, open Favorites and confirm it appears, unfavorite it from either location, reload, and confirm the favorite state persisted.

### Tests for User Story 4

- [X] T031 [P] [US4] Unit test in `tests/unit/db.test.js` (extend existing file): assert `toggleFavorite(photoId)` flips `is_favorite` 0→1→0, persists via `persistDB()` (verifiable by re-reading via `getPhoto`), and throws `"Photo not found"` for an invalid id; assert `getAllPhotos({ favoritesOnly: true })` returns only favorited, non-deleted photos.
- [X] T032 [P] [US4] Integration test in `tests/integration/favorites-flow.test.js` (per `plan.md`'s planned file): favorite a photo via its card, assert it appears in the Favorites view, reload/re-render from a fresh `initDB()` call against the same persisted store and assert it is still marked favorite and still listed, then unfavorite it from the Favorites view and assert it disappears immediately; assert the `'favorites'` empty state renders when nothing is favorited.

### Implementation for User Story 4

- [X] T033 [US4] Wire the `photo-card:favorite-toggle` event from `ui/photo-card.js` (T010) into a shared handler used by both `ui/photo-gallery.js::attachPhotoGalleryEvents` and `ui/album-view.js`'s photo grid: on the event, call `modules/db.js::toggleFavorite(photoId)` then update just that card's heart state (no full page re-render required).
- [X] T034 [US4] In `src/app.js`, wire the Favorites nav section: mount `ui/nav.js::renderNav('favorites')` plus `ui/photo-gallery.js::renderPhotoGallery(getAllPhotos({ favoritesOnly: true }), { emptyStateVariant: 'favorites' })`. Depends on T017, T033.
- [X] T035 [P] [US4] Add a heart-icon toggle with a pulse/pop animation (wrapped in `@media (prefers-reduced-motion: no-preference)`) to `src/styles/components.css`, and set an accessible label on the heart control in `ui/photo-card.js` (e.g. `aria-label="Add to favorites"` / `"Remove from favorites"` depending on state) per `spec.md` FR-014.

**Checkpoint**: All four user stories are independently functional — the full redesign, including favorites, is complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consolidate duplicated card rendering, add Settings, and verify the whole feature end-to-end.

- [X] T036 [P] Update `src/ui/album-view.js`'s photo grid to render cards via the shared `ui/photo-card.js::createPhotoCard` instead of its own `createPhotoTile`, removing the now-duplicate markup, per `contracts/ui-views-contract.md`'s "Changed" section. `renderAlbumView(album, photos)`'s exported signature stays unchanged.
- [X] T037 [P] Create `src/ui/settings-view.js` exporting `renderSettingsView(stats)` per `contracts/ui-views-contract.md` and `research.md` item 7: app name/version info plus storage stats (photo count, album count) — no new backend calls, no destructive "clear all data" action.
- [X] T038 In `src/app.js`, wire the Settings nav section: mount `ui/nav.js::renderNav('settings')` plus `ui/settings-view.js::renderSettingsView(...)` with stats computed from existing `getAlbums()`/`getAllPhotos()` results. Depends on T017, T037.
- [X] T039 [P] Reduced-motion audit: verify every animation rule added across `src/styles/components.css` and `src/styles/layout.css` (T019, T024, T030, T035, and any others) is scoped inside `@media (prefers-reduced-motion: no-preference)`, per `spec.md` FR-018.
- [X] T040 [P] Accessibility pass across all new/changed UI modules (`ui/nav.js`, `ui/hero.js`, `ui/photo-card.js`, `ui/photo-gallery.js`, `ui/upload-zone.js`, `ui/album-grid.js`, `ui/settings-view.js`): confirm alt text on every photo `<img>`, `aria-label`s on icon-only controls, and visible `:focus-visible` styles in `src/styles/components.css`, per `spec.md` FR-013/FR-014.
- [X] T041 Run the full regression suite: `npm run lint` and `npm test`, confirming all pre-existing suites (`tests/unit/db.test.js`, `tests/unit/exif.test.js`, `tests/unit/dnd.test.js`, `tests/integration/album-reorder.test.js`, `tests/integration/album-upload-view.test.js`, `tests/integration/exif-grouping.test.js`) plus all new tests from this feature pass, and coverage stays at or above the existing 80% thresholds in `vite.config.js`. **Result**: 20 suites / 124 tests passing, lint clean, coverage 90.47% stmts / 82.98% branch / 87.69% funcs / 90.47% lines (all ≥80%). Also fixed three pre-existing, previously-masked environment/test-infra bugs blocking this gate entirely (sql.js WASM path resolution under Vitest/Node, missing jsdom IndexedDB, and un-reset db.js module singleton causing cross-test UNIQUE constraint collisions) plus pre-existing lint errors — see `vite.config.js`, `tests/setup.js`, `src/modules/db.js::resetDatabaseForTests`.
- [X] T042 Execute `specs/002-emis-crafthouse-redesign/quickstart.md` scenarios 1–9 against a running instance, including scenario 7 (loading a pre-redesign IndexedDB database to confirm the migration from T004 runs with no data loss). **Result (partial, see note)**: `npm run dev` served correctly (HTTP 200; `curl` confirmed scenario 1's branding — tab title "Emi's Craft House" and updated meta tags are live in the served HTML) and `npm run build` produced a clean production bundle with no errors. Interactive in-browser click-through of scenarios 2–9 (empty state, drag-drop upload, gallery/date grouping, albums, favorites, migration, accessibility) was not completed via browser automation because the user asked mid-task not to use the browser tool — those scenarios are instead covered functionally by `tests/integration/app.test.js` (drives the same DOM/event flows end-to-end via jsdom: nav, hero, upload modal, album create/view/delete, favorite toggle) and `tests/integration/*.test.js`, all passing. Scenario 7's migration path is covered by `tests/unit/db.test.js` (schema-migration behavior) rather than a manual pre-redesign-database reload. A human should still click through the running app at least once before shipping.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational completion; may proceed in priority order (P1→P2→P3→P4) or in parallel across developers once Phase 2 is done. US1 (Phase 3) is the recommended MVP checkpoint.
- **Polish (Phase 7)**: Depends on all four user stories being complete (T036 and T040 touch files every story modified).

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories.
- **US2 (P2)**: Independent of US1's gallery work; shares the Phase 2 `nav.js`/`empty-state.js` and the `app.js` router scaffolded in T017.
- **US3 (P3)**: Independent of US1/US2's view logic; its upload zone is wired into hero/album-view entry points created by those stories (T029 depends on T017's router existing, but not on US2's album-card styling).
- **US4 (P4)**: Depends on `photo-card.js` (Phase 2) and `photo-gallery.js` (US1, T016) already existing, since favoriting is surfaced through those shared components.

### Within Each User Story

- Tests are written first and should fail before their corresponding implementation task lands.
- Shared/new files before `app.js` wiring tasks that consume them.
- `src/app.js` edits within a phase are sequential with each other (same file) but independent of other phases' non-`app.js` edits.

### Parallel Opportunities

- T001/T002 (Setup) — different files, parallel.
- T005, T009, T010, T011, T012 (Foundational) — different files from the sequential `db.js` chain (T003→T004→T006→T007→T008) and from each other — parallel.
- Within each user-story phase, the two test tasks are parallel to each other; new-file implementation tasks (e.g., T015 `hero.js` and T016 `photo-gallery.js`) are parallel to each other but precede the phase's `app.js` wiring task.
- T036, T037, T039, T040 (Polish) — different files, parallel.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T003/T004 land in db.js sequentially, these can run together:
Task: "Add is_favorite to src/models/Photo.js constructor and toJSON()"
Task: "Create src/ui/empty-state.js"
Task: "Create src/ui/photo-card.js"
Task: "Create src/ui/nav.js"
Task: "Add shared card/button/nav foundation styles to src/styles/components.css and src/styles/layout.css"
```

## Parallel Example: User Story 1

```bash
Task: "Integration test in tests/integration/home-gallery-redesign.test.js"
Task: "Unit test for date-bucketing helper in tests/unit/photo-gallery.test.js"

# Once tests are in place:
Task: "Create src/ui/hero.js"
Task: "Create src/ui/photo-gallery.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema migration, shared queries, shared components) — CRITICAL, blocks every story.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run `npm test`, then manually confirm the Home page (hero, nav, date-grouped gallery of existing photos) via `npm run dev` — this alone is a shippable, "wow this looks fun" first impression.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate independently → this is the MVP.
3. Add US2 → validate independently (albums colorful + drag-reorder intact).
4. Add US3 → validate independently (joyful upload, pipeline intact).
5. Add US4 → validate independently (favorites persist across reload).
6. Polish (Settings, de-duplication, accessibility/reduced-motion audit, full regression, quickstart validation).

Each story adds value without breaking previously delivered stories, since every story's independent test re-verifies no functional regression in the existing sql.js/EXIF/album/drag-and-drop behavior.
