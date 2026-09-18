---

description: "Task list template for feature implementation"
---

# Tasks: Album Reliability & Usability Fixes

**Input**: Design documents from `/specs/005-album-ux-fixes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/album-actions.md, quickstart.md

**Tests**: Included as required tasks — the project constitution (`.specify/memory/constitution.md`, Principle II: Comprehensive Testing) mandates tests at all levels and test-first where practical, so test tasks are not optional for this feature.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paths are relative to the repository root (`/home/topiltzin/emi_crafting`)

## Path Conventions

Single project (unchanged from today): `src/`, `tests/` at repository root, per plan.md's Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

No setup tasks are required. This feature adds no new dependencies, environment variables, or schema (research.md: "No new dependencies added"; data-model.md: "No schema changes"). Proceed directly to the user stories below.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No task in this feature blocks all five user stories simultaneously — User Story 1's `updateAlbum`/rename-dialog work is the one piece shared with User Story 3, and per the task-generation rule ("if an entity serves multiple stories, put it in the earliest story") it is built as part of User Story 1 below rather than a separate Foundational phase.

---

## Phase 3: User Story 1 - Creating a new album always works (Priority: P1) 🎯 MVP

**Goal**: Every "Create Album" attempt either creates a new, correctly named album or clearly explains why not and offers a way to resolve it — never a silent no-op.

**Independent Test**: On a day that already has an album, open "Create Album," type a distinct new name, and submit. Confirm the app tells the user today's album already exists (naming it) and offers to rename it or cancel — never a silent no-op.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (constitution Principle II).

- [X] T001 [P] [US1] Add unit tests in `tests/unit/db.test.js` for the new `updateAlbum(albumId, { title })`: succeeds and returns the updated `Album` for a valid title; rejects with a `'validation'`-coded error and issues no write when `title` is empty/blank after trimming or exceeds 255 characters (contracts/album-actions.md).
- [X] T002 [P] [US1] Add unit tests in `tests/unit/album-module.test.js` for `createAlbumIfNeeded(albumDate, title)` returning `{ album, created }`: `created: true` and a new row when no album exists for that date; `created: false` and the existing album returned **with its title unchanged** when one already exists for that date (contracts/album-actions.md).
- [X] T003 [P] [US1] Update `tests/integration/create-album-flow.test.js` (and/or `tests/integration/app.test.js`) to assert that submitting "Create Album" on a day that already has one opens a dialog naming the existing album and offering "Rename" / "Cancel," and that cancelling leaves the existing album unchanged with no duplicate created (spec.md Acceptance Scenarios 2–3, Edge Cases; FR-001, FR-002).

### Implementation for User Story 1

- [X] T004 [US1] Implement `updateAlbum(albumId, { title })` in `src/modules/db.js`: validate `title` is non-empty after trimming and `title.length <= 255` (the same rule `createAlbum` already applies), else `throw validationError(...)`; otherwise update `albums.title`/`updated_at` for the row and return it via the existing `toAlbum()` shape, using `throwClassified` on any Supabase error (contracts/album-actions.md, data-model.md). Depends on T001.
- [X] T005 [US1] Change `createAlbumIfNeeded(albumDate, title)` in `src/modules/album.js` to return `{ album, created }` instead of `Album` (contracts/album-actions.md), and update `ensureAlbumsExist()` in the same file to unwrap `.album` so the photo-upload auto-grouping path (`src/modules/photo.js`) sees no behavior change. Depends on T002.
- [X] T006 [P] [US1] Generalize `src/ui/create-album-dialog.js` to support a rename mode: accept an optional pre-filled value and label overrides while `showCreateAlbumDialog()` keeps its existing zero-argument call signature and behavior; export a second function (e.g. `showRenameAlbumDialog(currentTitle)`) built on the shared internal implementation (contracts/album-actions.md "UI contracts").
- [X] T007 [US1] In `handleCreateAlbum()` in `src/app.js`, when `createAlbumIfNeeded` resolves with `created: false`, open a dialog (via the existing `openDialog` primitive, research.md §1) that names the existing today's album and offers "Rename it" (opens T006's rename dialog pre-filled with the current title, then calls T004's `updateAlbum` on submit) or "Cancel" (no change, no navigation). Depends on T004, T005, T006.
- [X] T008 [US1] Confirm `handleCreateAlbum()`'s `created: true` path is unchanged (navigates to Albums as today), and that no remaining code path can discard a typed album name without either creating an album or showing the T007 dialog (FR-001). Depends on T007.

**Checkpoint**: User Story 1 is fully functional and independently testable — Create Album never silently no-ops.

---

## Phase 4: User Story 2 - Album cards behave the way they look (Priority: P2)

**Goal**: Clicking or tapping anywhere on an album card — not just the "View" button — opens it, and the same works from the keyboard.

**Independent Test**: Click the thumbnail or title area of a card (not "View") and confirm the album opens. Using only the keyboard, tab to a card and press Enter or Space and confirm the same.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] Add unit tests (in `tests/unit/album-module.test.js` or a new `tests/unit/album-grid.test.js`) asserting `attachAlbumGridEvents`: a click anywhere on `.album-card` outside of a `[data-action]` control invokes `onViewAlbum`; a click on the "Delete" control invokes only the delete flow and does not also invoke `onViewAlbum` (FR-005, FR-007).
- [X] T010 [P] [US2] Add unit tests for keyboard activation: an Enter/Space `keydown` dispatched with `event.target` set to the `.album-card` element invokes `onViewAlbum`; the same keys dispatched with `event.target` set to a nested `<button>` do not additionally invoke `onViewAlbum` (FR-006, FR-007, Edge Cases).

### Implementation for User Story 2

- [X] T011 [US2] In `attachAlbumGridEvents` (`src/ui/album-grid.js`), extend the delegated `click` listener so a click anywhere in `.album-card` invokes `onViewAlbum` unless `event.target.closest('[data-action]')` matches a control other than the card's own "view" trigger (research.md §3). Depends on T009.
- [X] T012 [US2] Add a delegated `keydown` listener in `attachAlbumGridEvents`: on Enter or Space where `event.target` is the `.album-card` element itself (not a nested button, which already handles its own activation natively), call `event.preventDefault()` and invoke `onViewAlbum` (FR-006, FR-007). Depends on T010.

**Checkpoint**: User Story 2 is fully functional and independently testable — album cards are fully clickable and keyboard-operable.

---

## Phase 5: User Story 3 - Renaming an album (Priority: P3)

**Goal**: Users can rename any existing album from the album list or its detail view.

**Independent Test**: Edit an album's name from the album list and from its detail view; confirm the new name is reflected everywhere; confirm an empty name is rejected with the previous name intact.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] Add unit tests (in the file from T009) asserting `createAlbumCard()` renders an "Edit" action and that `attachAlbumGridEvents` invokes an `onEditAlbum(albumId)` callback when it's clicked, without also invoking `onViewAlbum` (spec.md Acceptance Scenario 1; reuses T011's guard pattern).
- [X] T014 [P] [US3] Add unit tests in `tests/unit/album-view.test.js` asserting the album detail header renders an "Edit" action and that `attachAlbumViewEvents` invokes an `onEditAlbum` callback when clicked (spec.md Acceptance Scenario 2).
- [X] T015 [P] [US3] Extend an integration test (e.g. `tests/integration/album-redesign.test.js`) covering the full rename flow end-to-end: opening the rename dialog pre-filled with the current title, submitting a new title updates the album list and the album detail header; submitting an empty title is rejected and the previous name remains (spec.md Acceptance Scenarios 1–4, Edge Cases).

### Implementation for User Story 3

- [X] T016 [US3] Add an Edit action (`data-action="edit"`) to `createAlbumCard()` in `src/ui/album-grid.js`, and extend `attachAlbumGridEvents` to accept an optional `onEditAlbum` callback invoked when it's clicked — guarded by the same `event.target.closest('[data-action]')` pattern from T011 so it never also triggers the card's open behavior (contracts/album-actions.md). Depends on T011, T013.
- [X] T017 [US3] Add an Edit action to the header built by `renderAlbumView()` in `src/ui/album-view.js`, and extend `attachAlbumViewEvents` to accept an optional `onEditAlbum` callback (contracts/album-actions.md). Depends on T014.
- [X] T018 [US3] Wire both `onEditAlbum` callbacks in `src/app.js` to open T006's `showRenameAlbumDialog`, pre-filled with the album's current title, and call T004's `updateAlbum()` on submit, re-rendering the current view on success (FR-003, FR-004). Depends on T004, T006, T016, T017.

**Checkpoint**: User Story 3 is fully functional and independently testable — albums can be renamed from both the list and the detail view.

---

## Phase 6: User Story 4 - Dragging an album to reorder lands where expected (Priority: P4)

**Goal**: Dropping a dragged album lands exactly in the slot the drop indicator showed, in both directions.

**Independent Test**: With four or more albums, drag the first onto the third and confirm it lands exactly there (not one slot off); repeat dragging backward.

### Tests for User Story 4 ⚠️

- [X] T019 [P] [US4] Update the existing "calls onReorder with the dragged album id and drop index" test in `tests/unit/dnd.test.js` so the expected `onReorder` position reflects `calculateNewPosition`'s corrected value rather than the raw DOM index, and add a case covering a backward drag confirming the same correction (FR-008).

### Implementation for User Story 4

- [X] T020 [US4] In the `drop` handler in `src/modules/dnd.js`, replace the raw index currently passed to `onReorder` with `calculateNewPosition(draggedFromIndex, newIndex, cards.length)` — the existing, already-tested exported helper in the same file (research.md §4). Depends on T019.

**Checkpoint**: User Story 4 is fully functional and independently testable — drag-reorder lands precisely where dropped.

---

## Phase 7: User Story 5 - Sign-in screen looks like part of the app (Priority: P5)

**Goal**: The sign-in screen renders as a centered, styled card consistent with the rest of the app, on desktop and mobile widths, with a clearly styled error state.

**Independent Test**: Load the app signed out and confirm a centered, styled card (not an unstyled top-left form) on both desktop and mobile widths; trigger a sign-in error and confirm it's visibly styled.

### Tests for User Story 5 ⚠️

- [X] T021 [P] [US5] Extend `tests/unit/auth-view.test.js` to assert the rendered structure carries the class names the new CSS targets (`.auth-view`, `.auth-card`, `.auth-label`, `.auth-input`, `.auth-error`, `.auth-submit`), so the styling hooks can't be silently dropped in a future refactor (FR-009, FR-010). Actual visual rendering is validated manually via quickstart.md §5, not via jsdom.

### Implementation for User Story 5

- [X] T022 [US5] Add `.auth-view` (full-viewport centering, matching how `.modal-backdrop` centers its content) and `.auth-card` (centered card using the existing `--border-radius-lg`/`--shadow-lg`/`--color-white` tokens, matching `.modal`) rules to `src/styles/components.css` (research.md §5). Depends on T021.
- [X] T023 [P] [US5] Add `.auth-label`/`.auth-input` rules to `src/styles/components.css`, reusing the existing input styling tokens already used elsewhere in the app (research.md §5).
- [X] T024 [P] [US5] Add `.auth-error` styling to `src/styles/components.css`, reusing `--color-danger` the same way `.alert-error` already does (FR-010).
- [X] T025 [US5] Verify `.auth-submit` (already `.btn.btn-primary`) reads correctly within the new `.auth-card` layout at both desktop and mobile widths; adjust only spacing if needed — no new button style. Depends on T022, T023.

**Checkpoint**: User Story 5 is fully functional and independently testable — the sign-in screen matches the app's visual language.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene and final verification against the constitution's gates.

- [X] T026 [P] Run `npm run coverage` and confirm the ≥80% lines/functions/branches/statements thresholds in `vite.config.js` still pass across all changed files (constitution Principle II).
- [X] T027 [P] Run `npm run lint` across changed files. Note: `specs/004-supabase-data-migration/tasks.md` (T034) flagged a pre-existing missing ESLint config in this repo — if still unresolved, note it again here rather than fixing it as part of this feature (out of scope).
- [X] T028 Run `specs/005-album-ux-fixes/quickstart.md` end-to-end (all five §sections) against the running dev app and confirm SC-001 through SC-006 all pass. Depends on T008, T012, T018, T020, T025. **§5 verified live** via headless-browser screenshots (desktop, mobile, error state) against the running dev server. **§1-§4 verified via the automated integration/unit suite** (create-album-flow.test.js, album-rename-flow.test.js, album-grid.test.js, dnd.test.js, album-reorder.test.js) — a live-browser pass of the authenticated album flows (§1-§4) requires a real signed-in session and isn't runnable from this sandboxed environment (same constraint documented in specs/004-supabase-data-migration/tasks.md T018/T026/T030); recommend a manual pass before shipping.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None required for this feature.
- **Foundational (Phase 2)**: None required — see Phase 2 note above.
- **User Stories (Phase 3–7)**:
  - US1 (P1) has no dependency on other stories — start here.
  - US2 (P2) has no dependency on other stories — can proceed in parallel with US1.
  - US3 (P3) depends on US1 (`updateAlbum` from T004, `showRenameAlbumDialog` from T006) and on US2 (the click-delegation guard pattern from T011) — implement after both.
  - US4 (P4) has no dependency on other stories — can proceed at any time.
  - US5 (P5) has no dependency on other stories — can proceed at any time.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests are written first and must fail before implementation, per the constitution's test-first preference.
- Data-access changes (`db.js`, `album.js`) before UI wiring before app.js integration.
- Story complete (including checkpoint) before moving to the next priority.

### Parallel Opportunities

- US1 and US2 can be implemented in parallel by different people (no shared files or dependencies).
- US4 and US5 can be implemented in parallel with anything else — fully isolated (`dnd.js` and `components.css` respectively).
- US1 tests: T001, T002, T003 in parallel.
- US2 tests: T009, T010 in parallel.
- US3 tests: T013, T014, T015 in parallel (after US1/US2 implementation lands).
- US5: T023, T024 in parallel (after T022).
- Polish: T026, T027 in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests (write first, confirm they fail):
Task: "Add unit tests for updateAlbum in tests/unit/db.test.js"
Task: "Add unit tests for createAlbumIfNeeded's {album, created} shape in tests/unit/album-module.test.js"
Task: "Update tests/integration/create-album-flow.test.js for the album-exists dialog flow"

# Implementation is then sequential within the shared files (T004 → T005 → T007 → T008),
# except T006 (create-album-dialog.js) which touches a different file and can run alongside T004/T005.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1.
2. **STOP and VALIDATE**: run quickstart.md §1 and confirm SC-001.
3. This alone fixes the reported "Albums doesn't work properly" root cause — the silent Create Album no-op.

### Incremental Delivery

1. User Story 1 → validate independently → deployable fix for the critical bug.
2. User Story 2 → validate independently → album cards become fully clickable/keyboard-operable.
3. User Story 3 → validate independently → adds album renaming (builds on US1 + US2).
4. User Story 4 → validate independently → drag-reorder precision fix.
5. User Story 5 → validate independently → sign-in screen restyle.
6. Polish → final constitution-gate checks (coverage, lint) and full quickstart.md sign-off.

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependency.
- [Story] labels map tasks to spec.md's user stories for traceability.
- Every validation rule referenced above (title ≤255 chars, non-empty) is quoted verbatim from `data-model.md`/`contracts/album-actions.md` so it isn't left to implementation-time discretion.
- Commit after each task or logical group; verify tests fail before implementing against them.
