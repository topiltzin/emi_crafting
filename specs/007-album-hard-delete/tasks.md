---

description: "Task list template for feature implementation"
---

# Tasks: Permanent Album Deletion

**Input**: Design documents from `/specs/007-album-hard-delete/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/album-hard-delete.md, quickstart.md

**Tests**: Included as required tasks — the project constitution (`.specify/memory/constitution.md`, Principle II: Comprehensive Testing) mandates tests at all levels and test-first where practical, so test tasks are not optional for this feature. This is especially load-bearing here: the code path this feature turns on has zero existing test coverage today.

**Organization**: This feature is a single, atomic behavior change — spec.md defines one user story (US1). Tasks are grouped accordingly.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (the only user story in spec.md)
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

Not applicable — there is only one user story, and it has no shared prerequisite beyond its own test infrastructure (T001 below), which lives inside its own phase.

---

## Phase 3: User Story 1 - Deleting an album actually removes it (Priority: P1) 🎯 MVP

**Goal**: Confirming an album's deletion permanently removes that album, every photo in it, and their image/thumbnail files — matching what the existing confirmation dialog already promises — instead of only hiding them.

**Independent Test**: Create an album with a photo, delete it through the existing confirm dialog, and confirm the album and its photo no longer appear anywhere in the app and cannot be recovered through any action in the app.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (constitution Principle II).

- [X] T001 [P] [US1] Add `_failNextStorageRemoves(count)` and `_failNextTableDeletes(table, count)` to `tests/helpers/fake-supabase.js`, mirroring the existing `_failNextUploads(count)` countdown pattern already used by `specs/004-supabase-data-migration`'s migration-partial-failure tests (contracts/album-hard-delete.md).
- [X] T002 [US1] Add a unit test in `tests/unit/db.test.js`'s existing "Album deletion" describe block: `deleteAlbum(albumId, true)` removes the album row, every photo row that belonged to it, and their Storage objects (original + thumbnail) — verify via `getAlbum`/`getPhoto` returning null and `fakeClient._storageObjects` no longer containing their paths (data-model.md "happy path"; FR-001; SC-001, SC-002). Depends on T001.
- [X] T003 [US1] Add a unit test for the Storage-removal-failure/retry case: `fakeClient._failNextStorageRemoves(1)`, then call `deleteAlbum(albumId, true)` — assert it rejects and the album, its photos, and their Storage objects are all still fully present and unchanged; then call it again (retry) — assert it now succeeds and everything is gone (research.md §2 "fails during Storage removal"; FR-004, FR-007). Depends on T001.
- [X] T004 [US1] Add a unit test for the photo-row-delete-failure/retry case: `fakeClient._failNextTableDeletes('photos', 1)`, then call `deleteAlbum(albumId, true)` — assert it rejects, Storage objects are already gone (the disclosed transient window from data-model.md), and the photo/album rows are still present; then retry — assert success and everything gone, with no error from re-removing already-gone Storage objects (research.md §2 "fails during photo-row deletion"; FR-004, FR-007). Depends on T001.
- [X] T005 [US1] Add a unit test for the album-row-delete-failure/retry case: `fakeClient._failNextTableDeletes('albums', 1)`, then call `deleteAlbum(albumId, true)` — assert it rejects, photo rows and Storage are already gone, and only an empty album row remains (the disclosed orphan-album window from data-model.md); then retry — assert success with no error from deleting zero matching photo rows (research.md §2 "fails during album-row deletion"; FR-004, FR-007). Depends on T001.
- [X] T006 [P] [US1] Extend the existing "deletes an album after confirmation" test in `tests/integration/app.test.js` to also assert the album's photo is gone from `getAllPhotos()` and its Storage objects no longer exist in the fake client — not just that `getAlbums()` is empty — confirming the UI-triggered flow performs a real deletion end-to-end (spec.md Acceptance Scenarios 1-2; SC-001, SC-002).
- [X] T007 [P] [US1] Confirm the existing "does not delete the album when the confirmation dialog is cancelled" test in `tests/integration/app.test.js` still passes unchanged and adequately covers FR-003/SC-003 for this feature — no album/photo/Storage state changes when cancelling. Add a Storage-object assertion only if the existing test doesn't already make cancellation's no-op nature obvious.

### Implementation for User Story 1

- [X] T008 [US1] In `handleDeleteAlbum` (`src/app.js`), change `await deleteAlbum(albumId, false)` to `await deleteAlbum(albumId, true)` (contracts/album-hard-delete.md — the sole call site; no other code path calls `deleteAlbum`). Depends on T002, T003, T004, T005, T006, T007 (tests written and failing first).

**Checkpoint**: User Story 1 is fully functional and independently testable — album deletion is permanent, exercised and verified at every failure/retry point, matching what the confirmation dialog already promises.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene and final verification against the constitution's gates.

- [X] T009 [P] Run `npm run coverage` and confirm the ≥80% lines/functions/branches/statements thresholds in `vite.config.js` still pass across all changed files (constitution Principle II). **Result**: 93.12% statements / 82.36% branches / 92.04% functions / 93.12% lines, 270/270 tests passing. `db.js` climbed from 92.92% to 98.23% statements — the new hard-delete tests closed the gap this feature was specifically about.
- [X] T010 [P] Run `npm run lint` across changed files. Note: a pre-existing missing ESLint config in this repo was already flagged in `specs/004-supabase-data-migration/tasks.md` (T034), `specs/005-album-ux-fixes/tasks.md` (T027), and `specs/006-photo-zoom-view/tasks.md` (T018) — if still unresolved, note it again here rather than fixing it as part of this feature (out of scope). **Confirmed still unresolved** (same "ESLint couldn't find a configuration file" error); not fixed here, fourth feature to hit this pre-existing gap.
- [X] T011 Run `specs/007-album-hard-delete/quickstart.md` end-to-end against the running dev app and confirm SC-001 through SC-005 all pass. Depends on T008. **§1/§2 and the retry edge case are fully covered by the automated suite** (`tests/unit/db.test.js`'s 4 new hard-delete cases, `tests/integration/app.test.js`'s 2 updated cases) — all passing. **A live-browser pass confirming actual Supabase dashboard state (real row/Storage removal) is not runnable from this sandbox** (no owner credentials, same documented constraint as every other feature this session) — recommend a manual spot-check before shipping.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None required for this feature.
- **Foundational (Phase 2)**: Not applicable — single user story.
- **User Story 1 (Phase 3)**: No dependency on other stories (there are none) — start here.
- **Polish (Phase 4)**: Depends on User Story 1 being complete.

### Within User Story 1

- T001 (test infrastructure) before T002-T005 (the tests that use it).
- Tests (T002-T007) are written first and must fail before T008 (the one-line implementation change), per the constitution's test-first preference.
- T008 is intentionally last and intentionally tiny — every failure mode it needs to handle correctly was already implemented in `db.js` by a prior feature; this task only starts exercising it.

### Parallel Opportunities

- T001 can start immediately (no dependencies).
- T006 and T007 (integration test file) can proceed in parallel with T002-T005 (unit test file) once T001 lands, since they're different files.
- Polish: T009, T010 in parallel.

---

## Parallel Example: User Story 1

```bash
# T001 first (both test files below depend on it):
Task: "Add _failNextStorageRemoves/_failNextTableDeletes to tests/helpers/fake-supabase.js"

# Then in parallel:
Task: "Add hard-delete unit tests (happy path + 3 failure/retry cases) to tests/unit/db.test.js"
Task: "Extend/confirm integration tests in tests/integration/app.test.js"
```

---

## Implementation Strategy

### MVP First (and only) — User Story 1

1. Complete Phase 3: User Story 1 (tests, then the single-line fix).
2. **STOP and VALIDATE**: run quickstart.md and confirm SC-001 through SC-005.
3. Complete Phase 4: Polish.
4. This is the entire feature — there is no incremental-delivery sequencing beyond this one story.

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependency.
- The small task count reflects the actual size of this fix accurately, per plan.md's Summary — the bulk of the work is test coverage for an already-implemented, previously-untested code path, not new implementation.
- Commit after each task or logical group; verify tests fail before implementing against them.
