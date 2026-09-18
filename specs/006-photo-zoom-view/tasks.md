---

description: "Task list template for feature implementation"
---

# Tasks: Full-Resolution Photo Viewer

**Input**: Design documents from `/specs/006-photo-zoom-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/photo-viewer.md, quickstart.md

**Tests**: Included as required tasks — the project constitution (`.specify/memory/constitution.md`, Principle II: Comprehensive Testing) mandates tests at all levels and test-first where practical, so test tasks are not optional for this feature.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are relative to the repository root (`/home/topiltzin/emi_crafting`)

## Path Conventions

Single project (unchanged from today): `src/`, `tests/` at repository root, per plan.md's Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

No setup tasks are required. This feature adds no new dependencies, environment variables, or schema (plan.md Technical Context: "None added" / "No schema change").

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: Both user stories exercise the same viewer (US1 opens it, US2 dismisses it) — the resolver, the dialog primitive's new option, and the viewer module itself are shared prerequisites for both, not just one.

### Tests for Foundational work ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (constitution Principle II).

- [X] T001 [P] Add unit tests in `tests/unit/db.test.js` for the new `getPhotoOriginalUrl(storagePath)`: resolves to a URL for a valid `storage_path` (reuse the existing fake Storage bucket pattern already used for `thumbnail_url`); rejects with a `'network'`-coded error when Storage is unreachable, using the same `fakeClient._setNetworkDown(true)` pattern already exercised in the "Error classification" describe block (contracts/photo-viewer.md).
- [X] T002 [P] Add unit tests in `tests/unit/dialog.test.js` for `openDialog`'s new optional `className` param: the rendered `.modal` element has the extra class appended when provided; omitting it produces the exact same class list as today (contracts/photo-viewer.md).
- [X] T003 [P] Create `tests/unit/photo-viewer.test.js` asserting `openPhotoViewer(photo)`: shows a loading state while the URL resolution promise is pending; renders an `<img>` using the resolved URL on success; renders a clear, user-readable error message when resolution rejects (FR-004, FR-005).

### Implementation for Foundational work

- [X] T004 [P] Implement `getPhotoOriginalUrl(storagePath)` in `src/modules/db.js`: call the already-imported `resolvePhotoUrl` (from `photo-url.js`) and wrap any error with `throwClassified`, matching the exact `.code` contract (`'network'`/`'auth'`/`'validation'`) every other `db.js` export already uses. Do **not** call this from `toPhoto()` — it must only ever be invoked on demand (research.md §1: resolving it for every photo in a list would double Storage calls on every gallery load). Depends on T001.
- [X] T005 [P] Add an optional `className` parameter to `openDialog({ title, content, onClose, className })` in `src/ui/dialog.js`: when provided, append it to the rendered `.modal` element's class list alongside the existing `modal` class. Every existing call site (unchanged) must keep behaving exactly as today when `className` is omitted (contracts/photo-viewer.md). Depends on T002.
- [X] T006 Create `src/ui/photo-viewer.js` exporting `openPhotoViewer(photo)`: calls `openDialog(...)` with `className: 'photo-viewer'` and renders three states in its content area — loading (while `getPhotoOriginalUrl(photo.storage_path)` is pending), success (an `<img>` using the resolved URL, scaled to fit the viewport per FR-006), and error (a message classified the same way `app.js`'s `describeError()` already classifies `.code === 'network'` failures elsewhere) (contracts/photo-viewer.md; FR-002, FR-004, FR-005). Returns the same `{ close }` shape `openDialog` returns. Depends on T003, T004, T005.
- [X] T007 [P] Add `.photo-viewer`-scoped CSS to `src/styles/components.css`: a `.modal.photo-viewer` sizing override sized for a near-fullscreen image view (not the ~500px width used by `.modal` today), an image rule that scales to fit the viewport without scrolling (FR-006), and loading/error state styles reusing existing tokens (the same `--color-danger`/`.alert-error` treatment already used elsewhere) (research.md §2).

**Checkpoint**: The resolver, the dialog primitive's new option, and the viewer module all exist and are independently tested — user story implementation can now begin.

---

## Phase 3: User Story 1 - View a photo at full resolution (Priority: P1) 🎯 MVP

**Goal**: Clicking, tapping, or keyboard-activating any photo thumbnail on Home, My Photos, Favorites, or an open album opens a view of the original, full-resolution image.

**Independent Test**: From any screen that shows photo thumbnails, click a photo and confirm a larger view opens showing the original image quality, clearly sharper/bigger than the grid thumbnail.

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] Add unit tests in `tests/unit/photo-gallery.test.js` asserting `createPhotoCard()`'s card element carries `tabindex="0"` and a descriptive `aria-label`, and that `attachPhotoGalleryEvents`: invokes a new `onOpenPhoto(photoId)` callback when a click lands anywhere on `.photo-card` outside a `[data-action]` control; does **not** invoke it when the click lands on the favorite or delete control; invokes it on an Enter/Space `keydown` whose `event.target` is the `.photo-card` element itself; does **not** invoke it on Enter/Space bubbled from a nested `<button>` (contracts/photo-viewer.md "Click contract"/"Keyboard contract"; FR-001, FR-008, FR-009).
- [X] T009 [P] [US1] Add an integration test (new file `tests/integration/photo-viewer-flow.test.js`, or extend an existing one) covering: clicking a photo thumbnail on Home opens the viewer showing an image sourced from the resolved original URL (not the thumbnail URL); repeating from inside an opened album produces the same result (spec.md Independent Test §1; FR-001, FR-002).

### Implementation for User Story 1

- [X] T010 [US1] Add `tabindex="0"` and an `aria-label` (e.g. `` `View full-resolution photo: ${photo.filename || 'craft photo'}` ``) to the card element in `createPhotoCard()` (`src/ui/photo-card.js`), mirroring `createAlbumCard()`'s existing pattern — this makes the already-existing-but-unreachable `.photo-card:focus-visible` CSS rule finally take effect (research.md §5). Depends on T008.
- [X] T011 [US1] Extend `attachPhotoGalleryEvents(galleryElement, onToggleFavorite, onDeletePhoto, onOpenPhoto)` in `src/ui/photo-gallery.js` with the new optional 4th parameter: a delegated `click` invokes `onOpenPhoto(photoId)` unless `event.target.closest('[data-action]')` matches a nested control (favorite, delete, select-checkbox); a delegated `keydown` invokes it on Enter/Space only when `event.target` is the `.photo-card` element itself (research.md §3, §4). Depends on T008, T010.
- [X] T012 [US1] Wire `onOpenPhoto` at all four render sites in `src/app.js` (`renderHomeSection`, `renderPhotosSection`, `renderFavoritesSection`, `renderAlbumDetail`) to a shared `handleOpenPhoto(photoId)` that resolves the `Photo` object already available from the rendered list and calls `openPhotoViewer(photo)` from `src/ui/photo-viewer.js` (research.md §3; FR-001). Depends on T006, T009, T011.
- [X] T013 [US1] Add `cursor: pointer` to `.photo-card` in `src/styles/components.css`, matching `.album-card`'s existing clickable-card affordance styling. Depends on T010.

**Checkpoint**: User Story 1 is fully functional and independently testable — every photo thumbnail on every screen opens a full-resolution view.

---

## Phase 4: User Story 2 - Dismiss the full-resolution view (Priority: P2)

**Goal**: The full-resolution view can always be closed — via its close control, an outside click, or Escape — returning the user to exactly where they were, with no side effects on the photo's data.

**Independent Test**: Open the full-resolution view for a photo from partway down a long gallery, close it three different ways, and confirm each returns to the same gallery at the same scroll position.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Extend `tests/integration/photo-viewer-flow.test.js` (from T009) asserting: activating the visible close control closes the viewer; clicking outside the image closes it; pressing Escape closes it; in every case the underlying gallery/album view and its scroll position are unchanged; the photo's favorite status and album membership are unchanged after closing (spec.md Acceptance Scenarios 1-4; FR-003, FR-007).
- [X] T015 [P] [US2] Add a unit test in `tests/unit/photo-viewer.test.js` (from T003) asserting `openPhotoViewer()` returns a `{ close }` handle with the same shape `openDialog` returns, and that calling it removes the overlay without issuing any data-layer write or mutation (FR-007).

### Implementation for User Story 2

- [X] T016 [US2] Confirm `openPhotoViewer()`'s `openDialog(...)` call correctly surfaces the close control, backdrop-click, and Escape dismissal `openDialog` already implements (research.md §2 — no new dismiss logic is expected here by construction). If the `.photo-viewer` sizing CSS from T007 visually crowds or obscures `.modal-close-btn` against the enlarged image, adjust its positioning in `src/styles/components.css` so it stays visible and reachable, including on mobile widths (FR-003 edge case). Depends on T007, T014, T015. **Verified by construction, no change needed**: `.modal-close-btn` is `position: absolute`, which paints above the static-flow `.modal-content` by default CSS stacking order regardless of DOM order, and T007 already gives it a semi-opaque white background for contrast against any image beneath it.

**Checkpoint**: User Story 2 is fully functional and independently testable — the viewer can always be dismissed, returning the user to exactly where they were.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene and final verification against the constitution's gates.

- [X] T017 [P] Run `npm run coverage` and confirm the ≥80% lines/functions/branches/statements thresholds in `vite.config.js` still pass across all changed files (constitution Principle II). **Result**: 92.39% statements / 82.14% branches / 92.04% functions / 92.39% lines, 266/266 tests passing. `photo-viewer.js` itself at 100% stmts/funcs/lines.
- [X] T018 [P] Run `npm run lint` across changed files. Note: a pre-existing missing ESLint config in this repo was already flagged in `specs/004-supabase-data-migration/tasks.md` (T034) and `specs/005-album-ux-fixes/tasks.md` (T027) — if still unresolved, note it again here rather than fixing it as part of this feature (out of scope). **Confirmed still unresolved** (same "ESLint couldn't find a configuration file" error); not fixed here, third feature to hit this pre-existing gap.
- [X] T019 Run `specs/006-photo-zoom-view/quickstart.md` end-to-end (both stories plus its edge-case checks) against the running dev app and confirm SC-001 through SC-005 all pass. Depends on T012, T016. **Automated-equivalent coverage**: every §1/§2/edge-case scenario is exercised by `tests/integration/photo-viewer-flow.test.js` (12 tests) and the Foundational/US1 unit suites — all passing. **Live-browser pass against a real authenticated session not runnable from this sandbox** (no owner credentials available, same documented constraint as specs/004 and specs/005's tasks.md) — recommend a manual pass before shipping, particularly the mobile-width (FR-006) and slow-connection loading-state (FR-004) checks.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None required for this feature.
- **Foundational (Phase 2)**: BLOCKS both user stories — the resolver, the `openDialog` option, and `photo-viewer.js` are shared by both.
- **User Stories (Phase 3-4)**:
  - US1 (P1) depends only on Foundational — start here.
  - US2 (P2) depends on Foundational and, for its CSS-crowding check (T016), on US1's sizing work (T013) having landed; its own dismiss *mechanics* come from `openDialog` (Foundational), not from US1.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each Phase

- Tests are written first and must fail before implementation, per the constitution's test-first preference.
- Data-access/primitive changes (`db.js`, `dialog.js`) before the module that composes them (`photo-viewer.js`) before UI wiring (`photo-card.js`, `photo-gallery.js`, `app.js`).
- Story complete (including checkpoint) before moving to the next priority.

### Parallel Opportunities

- Foundational tests: T001, T002, T003 in parallel.
- Foundational implementation: T004, T005, T007 in parallel (T006 depends on all three).
- US1 tests: T008, T009 in parallel.
- US2 tests: T014, T015 in parallel (after US1 lands, since T014 extends US1's integration test file).
- Polish: T017, T018 in parallel.

---

## Parallel Example: Foundational

```bash
# Tests (write first, confirm they fail):
Task: "Add unit tests for getPhotoOriginalUrl in tests/unit/db.test.js"
Task: "Add unit tests for openDialog's className param in tests/unit/dialog.test.js"
Task: "Create tests/unit/photo-viewer.test.js for loading/success/error states"

# Implementation: db.js, dialog.js, and components.css can proceed in parallel;
# photo-viewer.js (T006) waits on all three since it composes them.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: run quickstart.md §1 and confirm SC-001/SC-003.
4. This alone delivers the requested feature's core value — clicking a photo shows it at full resolution.

### Incremental Delivery

1. Foundational → resolver + dialog option + viewer module ready.
2. User Story 1 → validate independently → deployable: photos open at full resolution.
3. User Story 2 → validate independently → confirms every dismiss path is reliable and side-effect-free.
4. Polish → final constitution-gate checks (coverage, lint) and full quickstart.md sign-off.

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependency.
- [Story] labels map tasks to spec.md's user stories for traceability.
- Commit after each task or logical group; verify tests fail before implementing against them.
