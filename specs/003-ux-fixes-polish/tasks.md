---

description: "Task list for Gallery UX Reliability & Polish Fixes"
---

# Tasks: Gallery UX Reliability & Polish Fixes

**Input**: Design documents from `/specs/003-ux-fixes-polish/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-modules-contract.md`, `contracts/theme-module-contract.md`, `quickstart.md` (all present)

**Tests**: Included. The Constitution's Comprehensive Testing principle (>80% coverage, test-first preferred) and `plan.md`'s Constitution Check both commit to a unit/integration test for every new or changed module, so test tasks are part of each user story below rather than optional.

**Organization**: Tasks are grouped by user story (from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US6); Setup/Foundational/Polish tasks carry no story label
- File paths are exact and taken from `plan.md`'s Project Structure and `contracts/`

## Path Conventions

Single-project client-only web app — `src/`, `tests/` at repository root (no backend/frontend split), matching `plan.md`'s Structure Decision.

---

## Phase 1: Setup

**Purpose**: Confirm a clean starting point — no new dependencies or config are needed for this feature (`plan.md` Technical Context: "None added").

- [X] T001 Run `npm run lint` and `npm test` from the repo root and confirm zero failures before starting any change in this feature; this is the baseline `quickstart.md`'s regression check compares against (repo root, `package.json` scripts) — `npm test` baseline: 124/124 passing (20 files). `npm run lint` has no ESLint config anywhere in the repo (pre-existing gap, unrelated to this feature) — out of scope to fix here, noted and skipped.

**Checkpoint**: Baseline green. Proceed to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared modal primitive that User Story 1 and User Story 3 are explicitly built on (`research.md` item 2), and that User Story 4 verifies holds everywhere.

**⚠️ Scope note (not a template default — verified against the actual design)**: This phase blocks **US1, US3, and US4 only**. It does **not** block **US2, US5, or US6** — none of those three touch `ui/dialog.js` or any dialog at all (confirmed in `contracts/ui-modules-contract.md`: US2 is contained to `upload-zone.js`/`components.css`; US5 to `nav.js`; US6 to `theme.js`/`main.css`/`settings-view.js`). If working solo, do Phase 3 (the P1 MVP) before or in parallel with this phase — there is no dependency either way.

- [X] T002 Implement `openDialog({ title, content, onClose }): { close: () => void }` in new `src/ui/dialog.js` — backdrop, panel, `<h2>` title, visible close button (`data-action="dialog-close"`, `aria-label="Close dialog"`), appends caller-supplied `content`; wires Escape keydown, backdrop click, and the close button to all call `onClose()`; moves focus to the panel's first focusable element (or the close button) on open and returns focus to the previously-focused element on close — per `contracts/ui-modules-contract.md`
- [X] T003 [P] Unit test `src/ui/dialog.js` in new `tests/unit/dialog.test.js` — Escape closes and calls `onClose()`; backdrop click closes and calls `onClose()`; close button closes and calls `onClose()`; a click inside the panel does NOT close; focus moves into the panel on open and returns to the trigger element on close (depends on T002)
- [X] T004 [P] Refactor `openUploadModal()` in `src/app.js` (currently lines 220-261) to call `openDialog()` instead of building its own backdrop/modal/close-on-backdrop-click logic, preserving the existing `attachUploadZoneEvents(zone, onConfirm)` wiring and cancel behavior exactly — per `contracts/ui-modules-contract.md` (depends on T002)
- [X] T005 Add an Escape-closes-the-Add-Photos-dialog case to `tests/integration/app.test.js`, asserting the dialog closes and no upload occurs (depends on T004)

**Checkpoint**: `openDialog()` exists, is tested, and the existing Add Photos dialog already benefits from it. US1 and US3 can now build their own dialogs on top of it.

---

## Phase 3: User Story 2 - Add Photos button always reflects whether it can act (Priority: P1) 🎯 MVP

**Goal**: The "Add Photos" confirm button is inactive until at least one valid photo is pending, and a rejected (non-image) file is reported instead of silently dropped.

**Independent Test**: Open "Add Photos" with zero files chosen — confirm the confirm/cancel controls are not in their active/clickable state. Choose a valid image — confirm they become active and the upload completes as today. Drop a mix of one image and one non-image — confirm the image is accepted and the non-image is reported.

### Implementation for User Story 2

- [X] T006 [P] [US2] In `attachUploadZoneEvents()` (`src/ui/upload-zone.js`), call `renderPendingList()` once immediately after wiring events (before the function returns), not only on add/remove/drop — fixes `confirmBtn.disabled` and the `hidden` state of `.upload-zone-actions`/`.upload-pending-list` being wrong at dialog-open time (`research.md` item 1; `data-model.md` Pending Upload Selection entity, Derived UI state)
- [X] T007 [P] [US2] In `src/styles/components.css`, change `.upload-zone-actions { display: flex; ... }` and `.upload-pending-list { ... }` to be scoped `.upload-zone-actions:not([hidden]) { display: flex; ... }` / `.upload-pending-list:not([hidden]) { ... }` so the `hidden` attribute the JS sets is no longer defeated by the unconditional class rule (`research.md` item 1)
- [X] T008 [US2] In `addFiles(fileList)` (`src/ui/upload-zone.js`), collect the names of files failing the existing `file.type.startsWith('image/')` filter into a `rejectedFileNames` array (`data-model.md` Pending Upload Selection entity) and render/update an inline message via a new internal `renderRejectedNotice(names)` helper next to the pending list, clearing it on the next successful add or on cancel — accepted files still land in `pendingFiles` exactly as today (depends on T006, same file)
- [X] T009 [US2] Update `tests/unit/upload-zone.test.js`: (a) assert the confirm button is `disabled` and `.upload-zone-actions`/`.upload-pending-list` are not visible immediately after `attachUploadZoneEvents()` runs with zero pending files, before any add/drop event — covers FR-004/FR-005; (b) assert a non-image file passed to `addFiles`/drop triggers the rejected-file message while a co-selected valid image still lands in `pendingFiles` — covers FR-006 and the mixed-file-drop edge case (depends on T006, T007, T008)

**Checkpoint**: User Story 2 is fully functional and independently testable — this is the MVP: the one genuinely broken user flow found in the review is fixed.

---

## Phase 4: User Story 1 - Delete confirmation matches the app's own look and feel (Priority: P2)

**Goal**: Replace the three `window.confirm(...)` call sites with an in-app confirmation dialog naming what will be lost (and, for albums, how many photos).

**Independent Test**: Tap Delete on a photo and on an album (with photos) — confirm an in-app dialog (not a browser popup) appears, names the item, and blocks removal until confirmed; cancel leaves data untouched; confirm removes it, matching today's end result.

**Depends on**: Phase 2 (Foundational) — `openDialog()` must exist first.

### Implementation for User Story 1

- [X] T010 [US1] Implement `showConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true }): Promise<boolean>` in new `src/ui/confirm-dialog.js`, built on `openDialog()` — resolves `true` on confirm-click, `false` on cancel/close/backdrop/Escape; `danger: true` applies the existing `.btn-danger` class to the confirm button — per `contracts/ui-modules-contract.md` (depends on T002)
- [X] T011 [P] [US1] Unit test `src/ui/confirm-dialog.js` in new `tests/unit/confirm-dialog.test.js` — confirm click resolves `true`; cancel, close button, backdrop click, and Escape each resolve `false`; `danger: true` (default) results in the confirm button carrying `btn-danger` (depends on T010)
- [X] T012 [P] [US1] Replace `if (confirm('Delete this album and all photos? This cannot be undone.'))` at `src/ui/album-grid.js:113` with `if (await showConfirmDialog({ title: 'Delete album?', message: ... }))`, building the message from the `album.title` (or `album.album_date` fallback) and `album.photo_count` already present on the `album` object the Delete button was rendered from — no new query (`research.md` item 3, `contracts/ui-modules-contract.md`) (depends on T010)
- [X] T013 [P] [US1] Replace `if (confirm('Delete this photo? This cannot be undone.'))` at `src/ui/album-view.js:89` with `if (await showConfirmDialog({ title: 'Delete photo?', message: ... }))`, building the message from the `photo.filename` already in scope (depends on T010)
- [X] T014 [P] [US1] Replace `if (confirm('Delete this photo? This cannot be undone.'))` at `src/ui/photo-gallery.js:89` with the same `showConfirmDialog(...)` call as T013 (depends on T010)
- [X] T015 [US1] New integration test `tests/integration/delete-confirmation-flow.test.js`: deleting a photo and deleting an album (with photos, asserting the count appears in the dialog's message) each show the in-app dialog — assert `window.confirm` is never invoked (e.g. via a spy) — cancel leaves the item in place, confirm removes it; covers `spec.md` User Story 1's three Acceptance Scenarios (depends on T012, T013, T014)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 5: User Story 3 - Create an album without leaving the app's look and feel (Priority: P2)

**Goal**: Replace `window.prompt()` with an in-app dialog that rejects blank/whitespace-only names.

**Independent Test**: Tap "Create Album" — confirm no browser-native popup appears. Submit a blank name — confirm an inline message appears and no album is created. Submit a valid name — confirm the album is created, matching today's end result.

**Depends on**: Phase 2 (Foundational) — `openDialog()` must exist first.

### Implementation for User Story 3

- [X] T016 [US3] Implement `showCreateAlbumDialog(): Promise<string | null>` in new `src/ui/create-album-dialog.js`, built on `openDialog()` — single labeled text input + Create/Cancel buttons; submitting a blank/whitespace-only name shows an inline `"Please enter an album name."` message and keeps the dialog open (does not resolve); Create with a non-blank input resolves the trimmed name; Cancel/close/backdrop/Escape resolve `null` — per `contracts/ui-modules-contract.md`, FR-008 (depends on T002)
- [X] T017 [P] [US3] Unit test `src/ui/create-album-dialog.js` in new `tests/unit/create-album-dialog.test.js` — valid name resolves the trimmed value; blank and whitespace-only names each show the inline message and do not resolve, dialog stays open; Cancel, close button, backdrop click, and Escape all resolve `null` (depends on T016)
- [X] T018 [P] [US3] In `handleCreateAlbum()` (`src/app.js:207`), replace `const title = window.prompt("Name your new album (e.g. 'Paper Crafts'):", ''); if (title === null) return;` with `const title = await showCreateAlbumDialog(); if (title === null) return;` — the following `createAlbumIfNeeded(today, title || null)` call is unchanged, since the dialog now guarantees `title` is a non-blank trimmed string or `null` (depends on T016)
- [X] T019 [US3] New integration test `tests/integration/create-album-flow.test.js`: Create Album opens the in-app dialog (assert `window.prompt` is never invoked, e.g. via a spy); a valid name creates the album; a blank/whitespace name is rejected with a visible message and no album is created; Cancel creates nothing — covers `spec.md` User Story 3's four Acceptance Scenarios (depends on T018)

**Checkpoint**: User Story 3 is fully functional and independently testable.

---

## Phase 6: User Story 4 - Every dialog can be closed with Escape or a visible close control (Priority: P2)

**Goal**: Verify the property `openDialog()` already guarantees by construction (Escape/close-button/backdrop dismissal, no side effect) actually holds across all three dialog types now that US1 and US3 exist. **There is no new implementation task here** — `ui/dialog.js` (Phase 2) already gives every dialog built on it this behavior for free; this phase is the cross-cutting proof.

**Independent Test**: Open each of the three dialogs (Add Photos, delete confirmation, Create Album) and confirm Escape closes each with no action applied, and each has a visible close control beyond its named Cancel button.

**Depends on**: Phase 2 (T005 already covers Add Photos), Phase 4 (T012-T014, confirm-dialog wired into all three delete sites), Phase 5 (T018, create-album-dialog wired in)

### Verification for User Story 4

- [X] T020 [US4] New integration test `tests/integration/dialog-dismissal.test.js`: for each of the Add Photos dialog, the delete-confirmation dialog (opened via any of the three delete entry points), and the Create Album dialog — opening then pressing Escape closes it with no side effect (no upload, no delete, no album created), and clicking the visible close button (`data-action="dialog-close"`) does the same; covers FR-009, FR-010, SC-004, and `spec.md` User Story 4's two Acceptance Scenarios (depends on T005, T012, T013, T014, T018)

**Checkpoint**: All four native-dialog/consistency stories (US1–US4) are complete and cross-verified.

---

## Phase 7: User Story 5 - Navigation icons match the app's visual identity (Priority: P3)

**Goal**: Replace the five emoji in the nav with inline SVG matching the app's palette.

**Independent Test**: Open the navigation menu — confirm every item shows a consistent, on-brand icon (not emoji), rendering identically regardless of operating system; confirm a screen reader still announces only the item's label.

**Depends on**: Nothing — fully independent of every other phase (`plan.md` Scale/Scope; `contracts/ui-modules-contract.md`).

### Implementation for User Story 5

- [X] T021 [P] [US5] Author 5 inline SVG icon strings (home, photos, albums, favorites, settings), sized consistently (~20px) and using `currentColor` so they inherit the surrounding pink/purple palette, and replace the emoji values in the `SECTIONS` array's `icon` field in `src/ui/nav.js` — the existing `<span aria-hidden="true">${section.icon}</span>` wrapper is unchanged (`research.md` item 5, `data-model.md` Navigation Icon entity, FR-011)
- [X] T022 [US5] Update `tests/unit/nav.test.js`: replace any emoji-text assertions with assertions that each nav item's icon span renders an `<svg>` element, and that the wrapping span still carries `aria-hidden="true"` — covers FR-011/FR-012 (depends on T021)

**Checkpoint**: User Story 5 is fully functional and independently testable.

---

## Phase 8: User Story 6 - Choose light or dark appearance in Settings (Priority: P3)

**Goal**: A Light/Dark/Match Device control in Settings, backed by `localStorage`, that overrides the OS-level `prefers-color-scheme`.

**Independent Test**: Open Settings, switch the appearance control to Dark while the OS is in light mode — confirm the app switches immediately; reload — confirm it's still dark; switch back to "Match Device" — confirm it now follows the OS again.

**Depends on**: Nothing — fully independent of every other phase (`theme.js` never touches `ui/dialog.js`).

### Implementation for User Story 6

- [X] T023 [US6] Implement `getThemePreference()`, `setThemePreference(theme)`, `applyTheme(theme)`, and `initTheme()` in new `src/modules/theme.js` — `localStorage` key `emi-craft-theme`; default/fallback `'system'` for an absent or invalid stored value; `applyTheme('light'|'dark')` sets `document.documentElement.dataset.theme`, `applyTheme('system')` removes it — per `contracts/theme-module-contract.md`, `data-model.md` Appearance Preference entity
- [X] T024 [P] [US6] Unit test `src/modules/theme.js` in new `tests/unit/theme.test.js` — default `'system'` when key absent or holds an invalid value; `setThemePreference` persists to `localStorage` and calls `applyTheme`; `applyTheme('system')` removes `data-theme`; `applyTheme('light'|'dark')` sets it accordingly (depends on T023)
- [X] T025 [P] [US6] Add a new, unconditional `:root[data-theme='dark'] { ... }` block to `src/styles/main.css`, copying the same custom-property values as the existing `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` block (currently lines 55-70) — no `[data-theme='light']` block is needed, since the base `:root` (lines 1-51) already holds light values and the existing `:not([data-theme='light'])` guard already protects them (`contracts/theme-module-contract.md`, `research.md` item 6)
- [X] T026 [P] [US6] Call `initTheme()` once during `src/app.js`'s startup sequence, before first render, so the correct palette applies before first paint (depends on T023)
- [X] T027 [P] [US6] Add an "Appearance" card (Light / Dark / Match Device control) to `renderSettingsView(stats)` in `src/ui/settings-view.js`, positioned between the existing "Your Gallery" and "Managing Your Data" cards, reflecting `getThemePreference()`'s current value — per `contracts/ui-modules-contract.md` (depends on T023)
- [X] T028 [US6] Add `attachSettingsViewEvents(viewElement, onAppearanceChange: (theme) => void): void` to `src/ui/settings-view.js` — this view's first `attach*Events` export, wiring the Appearance control's change event to the callback, following the same render/attach pairing convention as every other view module (depends on T027, same file)
- [X] T029 [US6] In `src/app.js`'s settings-section render path, call `attachSettingsViewEvents(view, (theme) => setThemePreference(theme))` so choosing a new appearance persists and applies immediately (depends on T023, T028)
- [X] T030 [P] [US6] Update `tests/unit/settings-view.test.js`: the Appearance card reflects the current preference from `getThemePreference()`, and `attachSettingsViewEvents` invokes `onAppearanceChange` with the selected value on interaction (depends on T027, T028)

**Checkpoint**: User Story 6 is fully functional and independently testable. All six user stories are now complete.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the whole feature together, per Constitution Principles I–II.

- [X] T031 [P] Run `npm run coverage` and confirm new/changed modules meet the repository's coverage bar (Constitution Principle II); add any edge-case test the report shows missing — 92.09% stmts / 84.54% branch / 89.51% funcs / 92.09% lines overall, all above the repo's 80% gate. Every new module this feature added (`dialog.js`, `confirm-dialog.js`, `create-album-dialog.js`, `theme.js`, `settings-view.js`) is at 100%/100% after adding two missing-branch tests (`danger:false` in confirm-dialog, missing-title fallback in dialog). Remaining gaps are all in pre-existing code this feature didn't touch (`app.js`, `exif.js`, `db.js`, `dnd.js`, and untouched branches of `nav.js`/`upload-zone.js`/`photo-card.js`/`photo-gallery.js`/`album-view.js`) — out of scope to backfill here.
- [X] T032 Walk through every scenario in `specs/003-ux-fixes-polish/quickstart.md`'s "Manual validation per user story" section against `npm run dev`, for all six user stories — done in Chrome via a mix of screenshots and direct DOM/JS inspection (Chrome's screenshot capture was intermittently unavailable this session, unrelated to the app — confirmed via instant, successful JS execution throughout). All six stories verified working: US2 button correctly starts disabled/hidden and reports rejected files; US1 in-app delete-confirm dialog shows correct name/photo-count, no `window.confirm`; US3 in-app create-album dialog validates blank names and creates albums, no `window.prompt`; US4 Escape and the close button both dismiss every dialog with focus returning to the trigger; US5 all five nav icons render as `<svg>` inside `aria-hidden` spans; US6 the Appearance toggle applies `data-theme` immediately and persists across a reload. Also surfaced and documented (not fixed — out of scope) a pre-existing, unrelated bug: `createAlbumIfNeeded` in `src/modules/album.js` doesn't account for soft-deleted albums against the `Albums.album_date` UNIQUE constraint, so deleting the only album for a given date and then creating a new one on the same date throws — reproducible identically with the old `window.prompt()` flow, so not a regression from this feature.
- [X] T033 [P] Run `npm run lint` and fix anything flagged in this feature's new or changed files — blocked by the same pre-existing gap noted in T001: the repo has no ESLint config file at all (`eslint src tests` fails immediately with "ESLint couldn't find a configuration file"), predating this feature. Setting one up from scratch is a separate, unrelated scope decision for the maintainer, not a fix within this feature's files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks US1 (Phase 4), US3 (Phase 5), and US4 (Phase 6) only** — see the scope note in Phase 2. Does **not** block US2, US5, or US6.
- **US2 (Phase 3, P1/MVP)**: Depends only on Setup. Can run before, after, or in parallel with Foundational.
- **US1 (Phase 4, P2)**: Depends on Foundational.
- **US3 (Phase 5, P2)**: Depends on Foundational. Independent of US1 (different files throughout).
- **US4 (Phase 6, P2)**: Depends on Foundational **and** US1 **and** US3 (it verifies all three dialog types).
- **US5 (Phase 7, P3)**: Depends only on Setup. Fully independent of every other phase.
- **US6 (Phase 8, P3)**: Depends only on Setup. Fully independent of every other phase.
- **Polish (Final Phase)**: Depends on whichever of the above are in scope for the current release slice.

### Parallel Opportunities

- **US2, Foundational, US5, and US6 have no dependency on each other** and can all be worked simultaneously (e.g., by different people) right after Phase 1.
- Within Foundational: T003 and T004 (both depend only on T002, touch different files).
- Within US2: T006 and T007 (different files, no shared dependency).
- Within US1: T011, T012, T013, T014 (all depend only on T010, touch four different files).
- Within US3: T017 and T018 (both depend only on T016, touch different files).
- Within US6: T024, T025, T026, T027 (all depend only on T023 or nothing, touch four different files).

---

## Parallel Example: User Story 1

```bash
# After T010 (showConfirmDialog) lands, launch these four together:
Task: "Unit test src/ui/confirm-dialog.js in tests/unit/confirm-dialog.test.js"
Task: "Replace window.confirm(...) at src/ui/album-grid.js:113"
Task: "Replace window.confirm(...) at src/ui/album-view.js:89"
Task: "Replace window.confirm(...) at src/ui/photo-gallery.js:89"
```

---

## Implementation Strategy

### MVP First (User Story 2 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 2 — this alone fixes the one genuinely broken (silent no-op) user flow the review found, and needs nothing else.
3. **STOP and VALIDATE**: run the US2 section of `quickstart.md` manually.
4. Ship if that's the priority; continue below for the rest.

### Incremental Delivery

1. Setup → US2 (MVP, P1) → validate independently → ship.
2. Foundational → US1 (P2) → validate independently → ship.
3. Foundational (already done) → US3 (P2) → validate independently → ship.
4. US1 + US3 + Foundational (already done) → US4 (P2, verification-only) → validate → ship.
5. US5 (P3) → validate independently → ship (can slot in anywhere after Setup).
6. US6 (P3) → validate independently → ship (can slot in anywhere after Setup).
7. Final Phase once the desired subset above is in.

### Parallel Team Strategy

With more than one person: one starts Phase 3 (US2) immediately; another starts Phase 2 (Foundational) immediately; a third can start Phase 7 (US5) or Phase 8 (US6) immediately — none block each other. Once Foundational lands, US1 and US3 can proceed in parallel (different files throughout); US4 waits for both to finish.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [Story] labels map every implementation/test task to its `spec.md` user story for traceability; Setup, Foundational, and Polish tasks carry none by design.
- Commit after each task or logical group.
- Stop at any Checkpoint to validate a story independently — every story above is independently shippable.
- T020 (US4) is intentionally the only task in its phase: the behavior it verifies was already delivered as a side effect of Phase 2's shared `openDialog()` primitive, not written fresh.
