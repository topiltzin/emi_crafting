---

description: "Task list template for feature implementation"
---

# Tasks: Cloud Data Migration (Supabase)

**Input**: Design documents from `/specs/004-supabase-data-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/schema.sql, contracts/data-access.md, quickstart.md

**Tests**: Included as required tasks — the project constitution (`.specify/memory/constitution.md`, Principle II: Comprehensive Testing) mandates tests at all levels and test-first where practical, so test tasks are not optional for this feature.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to the repository root (`/home/topiltzin/emi_crafting`)

## Path Conventions

Single project (unchanged from today): `src/`, `tests/` at repository root, per plan.md's Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the Supabase dependency and the environment/schema scaffolding every later phase needs.

- [X] T001 Add `@supabase/supabase-js` to `dependencies` in `package.json` and run `npm install` to update `package-lock.json`.
- [X] T002 [P] Create `.env.example` at the repo root documenting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only — with a comment that the Supabase secret/service key must never be set here or shipped to the browser (plan.md Constraints).
- [X] T003 [P] Create `supabase/schema.sql` as the versioned copy of `specs/004-supabase-data-migration/contracts/schema.sql` (the `albums`/`photos` tables, indexes, RLS policies, and Storage policies) so the repo has a single source of truth for the schema to apply to the Supabase project.
- [X] T004 [P] Add a "Supabase setup" section to `DEPLOYMENT.md` documenting: applying `supabase/schema.sql`, creating the private `photos` Storage bucket, and creating the single owner Auth user, per `specs/004-supabase-data-migration/quickstart.md` steps 1–3.

**Checkpoint**: Schema and environment scaffolding exist; no application code changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that every user story's implementation depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create `src/modules/supabase-client.js` exporting a singleton Supabase client initialized from `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` (research.md §1 — publishable/anon key only, never the secret key).
- [X] T006 Implement the owner sign-in flow in `src/ui/auth-view.js` (new file) using Supabase Auth email+password against the client from T005, and wire it into `src/app.js`'s init sequence so the gallery does not render until a session exists (research.md §1; contracts/data-access.md `initDB()`). Depends on T005.
- [X] T007 [P] Create `src/modules/supabase-errors.js` exporting a helper that classifies a thrown/rejected Supabase error into `'network'`, `'auth'`, or `'validation'` and re-throws an `Error` with a `.code` set accordingly, per contracts/data-access.md's "Error surfacing contract".
- [X] T008 [P] Create `src/modules/photo-storage-path.js` exporting helpers that build the Storage object paths `<owner_id>/<photo_id>/original` and `<owner_id>/<photo_id>/thumb`, matching the `(storage.foldername(name))[1] = auth.uid()::text` policy in `contracts/schema.sql`.
- [X] T009 [P] Create `src/modules/photo-url.js` exporting a helper that resolves a displayable URL for a `storage_path`/`thumbnail_storage_path` via the Supabase client's Storage signed-URL API (from T005), for `db.js` to attach as `thumbnail_url`/`photo_url` on returned rows. **Correction from planning**: `src/models/Photo.js`'s `getThumbnailUrl()`/`getPhotoUrl()` turned out to be dead code — the actual UI reads `photo.thumbnail_base64` directly in `src/ui/photo-card.js` (local `getThumbnailUrl()`) and `album.cover_thumbnail_base64` in `src/ui/album-grid.js`. Update those two call sites to read `photo.thumbnail_url` / `album.cover_thumbnail_url` instead, once `db.js` (T014/T015) attaches the resolved URL. Depends on T005.
- [X] T010 Rewrite `initDB()` in `src/modules/db.js` to: establish/confirm the Supabase session (via T006), and stop initializing sql.js for new writes — sql.js is retained only as the read path for pre-migration local data (used by Phase 4/US2). Depends on T005, T006.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Photos and albums survive the browser (Priority: P1) 🎯 MVP

**Goal**: Replace `db.js`'s Album/Photo CRUD with Supabase-backed implementations (Postgres + Storage) so data persists in the cloud, is reachable from any browser/device, and connectivity failures are surfaced clearly.

**Independent Test**: Create an album with photos, clear the browser's local site data (or switch browsers), and confirm the same albums/photos are still visible; disconnect network and confirm a clear error appears instead of an empty gallery.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (constitution Principle II).

- [X] T011 [P] [US1] Update `tests/unit/db.test.js` to mock the Supabase client (from T005) and assert `createAlbum`/`getAlbum`/`getAlbums`/`deleteAlbum`/`updateAlbumOrder`/`createPhoto`/`getPhoto`/`getPhotos`/`getAllPhotos`/`deletePhoto`/`toggleFavorite` call the expected Supabase table/Storage operations and return the same shape as today's `rowToAlbum`/`rowToPhoto` output (contracts/data-access.md). Built `tests/helpers/fake-supabase.js`, an in-memory fake of the `@supabase/supabase-js` surface `db.js` actually uses, as the mock target (mocked at the `supabase-client.js` boundary, per contracts/data-access.md's testing strategy).
- [ ] T012 [P] [US1] Add `tests/integration/supabase-rls.test.js` running against the Supabase local dev stack (`supabase start`, per quickstart.md §8) that verifies a second owner's session cannot read/write another owner's `albums`/`photos` rows, exercising the RLS policies in `contracts/schema.sql`. **BLOCKED**: this environment has no Docker (WSL Docker integration inactive) and no `supabase` CLI, so `supabase start` cannot run here. `contracts/schema.sql`'s RLS policies (`owner_id = auth.uid()`) are straightforward and match the standard Supabase RLS pattern, but they are unverified against a real Postgres instance — **run this manually against the local dev stack (or the real project) before relying on RLS for data isolation.**
- [X] T013 [P] [US1] Add `tests/integration/connectivity-error.test.js` that forces a Supabase call to reject with a network error and asserts the UI surfaces the FR-007/SC-005 message within the existing `showError()` alert banner in `src/app.js`, rather than an empty gallery.

### Implementation for User Story 1

- [X] T014 [US1] Implement `createAlbum`, `getAlbum`, `getAlbums`, `deleteAlbum`, and `updateAlbumOrder` in `src/modules/db.js` against the `albums` table: enforce `album_date` "must be ISO 8601 (`YYYY-MM-DD`)", `title` "if present, must be ≤255 characters", the `UNIQUE (owner_id, album_date)` constraint, and order listing by the `position` column (data-model.md `albums`; `updateAlbumOrder` keeps its existing `0 <= newPosition < total` validation, now writing `position` directly instead of an `AlbumOrder` table). Depends on T005, T007.
- [X] T015 [US1] Implement `createPhoto`, `getPhoto`, `getPhotos`, `getAllPhotos`, `deletePhoto`, and `toggleFavorite` in `src/modules/db.js` against the `photos` table + Storage: enforce `filename` "required, ≤255 characters", `file_size` "required, > 0 (and ≤50MB)", `mime_type` "required, from the supported set" (`image/jpeg`, `image/png`, `image/webp`), and upload the photo/thumbnail binary to Storage (via T008's path helper) *before* the row is considered successfully created, per FR-008 and contracts/data-access.md's "input shape change" (accept the same base64 strings `photo.js` already sends). Depends on T005, T007, T008, T009.
- [X] T016 [US1] Apply the `supabase-errors.js` classifier from T007 to every function touched in T014/T015 so each rejects with `.code` of `'network'`, `'auth'`, or `'validation'`, per contracts/data-access.md's "Error surfacing contract". Depends on T014, T015.
- [X] T017 [US1] Update the `catch` blocks in `src/app.js` (album load, photo load, create album, upload, toggle favorite, delete, reorder) to check `error.code === 'network'` and show the specific "can't reach your photo library" message from research.md §4 via the existing `showError()` banner, distinct from validation/auth errors. Depends on T016. Also removed the now-obsolete `persistDB()` calls (Supabase writes are immediate) and added `await` to the `getAlbums`/`getAllPhotos`/`getAlbum`/`getPhotos` call sites, which became async under Supabase.
- [ ] T018 [US1] Run `specs/004-supabase-data-migration/quickstart.md` §5 (User Story 1) manually against a real Supabase project and confirm SC-001, SC-002, SC-003, and SC-005 all pass. Depends on T014, T015, T016, T017. **BLOCKED**: requires a live Supabase project with real credentials and a browser — not runnable from this environment. See completion report.

**Checkpoint**: User Story 1 is fully functional and independently testable — albums/photos persist in Supabase and survive a cleared browser.

---

## Phase 4: User Story 2 - Existing local data is not lost during the switch (Priority: P2)

**Goal**: Automatically and resumably migrate any pre-existing local sql.js/IndexedDB albums/photos into Supabase, without data loss or duplication on retry.

**Independent Test**: On a browser with existing local albums/photos, load the updated app and confirm they appear in Supabase without re-uploading; interrupt the migration and confirm local data is untouched and retry doesn't duplicate anything.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Add `tests/unit/migration.test.js` asserting that re-running `runMigration()` after a partial run skips photos already present in the ledger (matched by `local_photo_key`) and does not create duplicate `photos`/`albums` rows (FR-010).
- [X] T020 [P] [US2] Add `tests/integration/migration-partial-failure.test.js` that fails a Storage upload partway through a simulated migration and asserts: no local Album/Photo rows were deleted (FR-005), `migration_status` remains `'in_progress'`, and the user-facing message from FR-006 is shown.

### Implementation for User Story 2

- [X] T021 [P] [US2] Create `src/modules/migration-ledger.js` implementing the local (non-Supabase) ledger from data-model.md: per-photo entries `{ local_photo_key, cloud_photo_id, migrated_at }` plus a `migration_status` flag (`'not_started' | 'in_progress' | 'completed'`), persisted in the browser's local storage/IndexedDB. Used `localStorage` (matches the existing `theme.js` precedent) rather than IndexedDB, since the ledger is a small key/value map.
- [X] T022 [US2] Create `src/modules/migration.js` implementing `runMigration(onProgress)` per research.md §3. **Correction from planning**: rather than keeping a legacy sql.js read path inside `db.js` (T010), it lives in its own new module `src/modules/legacy-local-db.js` (read-only: opens the old `PhotoOrganizerDB` IndexedDB, loads it with sql.js, returns plain rows) — cleaner separation now that `db.js` is Supabase-only. Skips any photo whose `local_photo_key` is already in the ledger (T021); also treats a cloud album already having a same filename+file_size photo as migrated (guards the narrow crash window between a successful upload and its ledger write) instead of the originally-planned `ON CONFLICT (id) DO NOTHING` (simpler given inserts already go through `createPhoto()`'s validation path). Reports progress via `onProgress(done, total)`. Depends on T021.
- [X] T023 [US2] Implement `getMigrationStatus()` in `src/modules/migration.js` returning the ledger's `migration_status` flag from T021. Depends on T021.
- [X] T024 [US2] Wire the migration check into app startup: `db.js`'s `initDB()` now dynamically imports `migration.js` (avoids a circular import) and runs `runMigration()` whenever the ledger status isn't `'completed'`, returning the result to its caller. `src/app.js`'s `startAuthenticatedApp()` awaits that result after rendering the gallery. Depends on T022, T023.
- [X] T025 [US2] `migration.js`/`legacy-local-db.js` have no delete/write path into the legacy local database at all (FR-005 holds by construction, not just by care). Added an incomplete-migration message in `src/app.js` reusing the `showError()` pattern (T017) when `runMigration()` reports any failures (FR-006). Depends on T022, T024.
- [ ] T026 [US2] Run `specs/004-supabase-data-migration/quickstart.md` §6 (User Story 2) manually, including the simulated partial-failure-and-retry step, and confirm FR-004, FR-005, FR-006, FR-010, and SC-001 all pass. Depends on T022, T023, T024, T025. **Automated equivalent passes** (`tests/unit/migration.test.js`, `tests/integration/migration-partial-failure.test.js`). **Manual live-browser/live-Supabase-project pass still recommended** — not runnable from this environment.

**Checkpoint**: User Stories 1 and 2 both work independently — new data persists in Supabase (US1) and pre-existing local data is safely carried over (US2).

---

## Phase 5: User Story 3 - Everyday album and photo management keeps working (Priority: P3)

**Goal**: Confirm every existing album/photo operation behaves identically against the Supabase-backed `db.js`, with no UI-layer changes required.

**Independent Test**: Perform create album, upload photo, toggle favorite, reorder albums, and delete/restore against the Supabase-backed app and confirm identical behavior to the pre-migration app.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Update the existing suites `tests/integration/album-reorder.test.js`, `tests/integration/favorites-flow.test.js`, `tests/integration/delete-confirmation-flow.test.js`, `tests/integration/create-album-flow.test.js`, and `tests/integration/album-upload-view.test.js` to mock the Supabase-backed `db.js` (per T011's mocking approach) instead of sql.js, asserting the same user-visible outcomes as before (FR-003). **Expanded scope**: a global `vi.mock('src/modules/supabase-client.js')` was centralized in `tests/setup.js` (via `tests/helpers/fake-supabase-mock.js`) instead of per-file, since essentially every test transitively depends on it. Every test file calling the now-async `getAlbum(s)`/`getPhotos`/`getAllPhotos` directly also needed `await` added: additionally touched `album-redesign.test.js`, `app.test.js`, `dialog-dismissal.test.js`, `exif-grouping.test.js`, `home-gallery-redesign.test.js`, `upload-zone.test.js`, `album-module.test.js`, `photo-module.test.js`. Also fixed the test-only canvas-thumbnail shim in `tests/setup.js` (was returning a non-base64 string, which broke once `db.js` actually decodes thumbnails to upload them).
- [X] T028 [P] [US3] Review `src/modules/photo.js`'s `addPhoto()`/`uploadPhotos()` against the new async `createPhoto()` signature (T015) and adjust only if awaits/error handling need updating — no change to the base64-in input contract per contracts/data-access.md's "Input shape change". No changes needed.
- [X] T029 [P] [US3] Review `src/modules/album.js`'s `createAlbumIfNeeded()`/`ensureAlbumsExist()`/`incrementPhotoCount()`/`decrementPhotoCount()` against the new async Album CRUD (T014) and adjust only if awaits need updating — public function signatures stay the same. `incrementPhotoCount`/`decrementPhotoCount` needed `async`/`await` added.
- [X] **Bug found while verifying US3 parity**: `src/ui/album-grid.js`, `src/ui/album-view.js`, `src/ui/photo-gallery.js`, and `src/modules/dnd.js` all read album/photo ids from DOM attributes via `parseInt(..., 10)`, which silently truncates a UUID (e.g. `"5815d587-...".` → `5815`). Fixed all four call sites to use the raw string id, since ids are UUIDs end-to-end now. Caught by the automated suite (`app.test.js`'s "deletes an album after confirmation" and the `dnd.test.js`/`album-view.test.js` id-shape assertions), not by inspection — confirms why running the tests (not just reading the diff) matters here.
- [ ] T030 [US3] Run `specs/004-supabase-data-migration/quickstart.md` §7 (User Story 3) manually — create album, upload photo, toggle favorite, drag-and-drop reorder, soft-delete + restore an album and a photo — and confirm identical outcomes to the pre-migration app (FR-003). Depends on T027, T028, T029. **Automated equivalent passes** (`tests/integration/app.test.js`, `album-redesign.test.js`, `favorites-flow.test.js`, `delete-confirmation-flow.test.js` all green against the Supabase-backed app). **Manual live-browser/live-Supabase-project pass still recommended** before shipping — not runnable from this environment (no live project, no browser).

**Checkpoint**: All three user stories are independently functional; the migration is feature-complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene and final verification against the constitution's gates.

- [X] T031 [P] Update `QUICKSTART.md` (repo root) with the new Supabase environment variable setup and a pointer to `specs/004-supabase-data-migration/quickstart.md` for full validation steps.
- [X] T032 [P] Remove the now-dead sql.js write path (`saveToIndexedDB`/`persistDB` calls made after every mutation) from `src/modules/db.js`, keeping only the read-only path used by migration. Satisfied by the full `db.js` rewrite (T010/T014/T015) — it has zero sql.js/IndexedDB references left; the read-only path lives in the new `src/modules/legacy-local-db.js` (see T022's correction note).
- [X] T033 Run `npm run coverage` and confirm the ≥80% lines/functions/branches/statements thresholds in `vite.config.js` still pass (constitution Principle II). **Result**: 90.5% statements / 83.2% branches / 89.2% functions / 90.5% lines, 208/208 tests passing. Added `tests/unit/auth-view.test.js` and `tests/unit/supabase-client.test.js` (which `vi.unmock`s the real module) since those two were the weakest-covered new modules.
- [ ] T034 Run `npm run lint` and fix any reported issues across the new/changed modules. **BLOCKED**: this repository has no ESLint config (`.eslintrc*`/`eslint.config.*`) despite `package.json`'s `lint` script and `vite.config.js`/`DEPLOYMENT.md` referencing one — a pre-existing gap, not introduced by this feature. `npm run lint` fails immediately with "ESLint couldn't find a configuration file" on `main`, before any of this feature's changes. Not fixed here as out of scope; flagged for a separate task.
- [X] T035 Grep the diff for this feature (`git diff main`) and `.env.example` to confirm the Supabase secret/service key never appears in any committed file (plan.md Constraints). **Result**: clean — no match for the project ref, key fragment, or `service_role` anywhere in the diff or new files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion.
  - US1 (P1) has no dependency on US2/US3.
  - US2 (P2) depends on US1's `db.js` rewrite (T014/T015) and the retained sql.js read path (T010) being in place, since migration writes into the same Supabase tables US1 defines.
  - US3 (P3) depends on US1's `db.js` rewrite (T014/T015) since it verifies parity against it; independent of US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests are written first and must fail before implementation, per the constitution's test-first preference.
- `db.js` CRUD (models/tables) before error-code wiring before UI error-message wiring.
- Story complete (including its manual quickstart validation task) before moving to the next priority.

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel (after T001).
- Foundational: T005, T007, T008, T009 in parallel; T006 and T010 are sequential (each depends on T005/T006).
- US1 tests: T011, T012, T013 in parallel.
- US2 tests: T019, T020 in parallel; T021 can start alongside them.
- US3: T027, T028, T029 in parallel.
- Polish: T031, T032 in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests (write first, confirm they fail):
Task: "Update tests/unit/db.test.js to mock the Supabase client and assert CRUD calls"
Task: "Add tests/integration/supabase-rls.test.js verifying RLS owner scoping"
Task: "Add tests/integration/connectivity-error.test.js verifying the FR-007 message"

# Foundational pieces already done; CRUD implementation is sequential within db.js (T014 → T015 → T016 → T017)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md §5 and confirm SC-001/SC-002/SC-003/SC-005.
5. This alone already satisfies the feature's core motivation — data no longer lives only in one browser.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → validate independently → this is the deployable MVP.
3. Add User Story 2 → validate independently → protects existing users' data through the switch.
4. Add User Story 3 → validate independently → confirms full parity, safe to fully retire the old sql.js write path (T032).
5. Polish → final constitution-gate checks (coverage, lint, no leaked secrets).

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependency.
- [Story] labels map tasks to spec.md's user stories for traceability.
- Every field constraint referenced above is quoted verbatim from `data-model.md` so it isn't left to implementation-time discretion.
- Commit after each task or logical group; verify tests fail before implementing against them.
