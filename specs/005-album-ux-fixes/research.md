# Phase 0 Research: Album Reliability & Usability Fixes

No `NEEDS CLARIFICATION` markers were left in the Technical Context — this feature modifies an existing, well-understood codebase (no new language/framework/storage decisions). Research below resolves the *design* choice behind each of the five fixes.

## 1. "Album already exists for today" flow (FR-001, FR-002)

**Decision**: In `src/modules/album.js`, change `createAlbumIfNeeded` (or add a thin new check ahead of it) so the caller (`handleCreateAlbum` in `app.js`) can distinguish "created new" from "found existing" and branch accordingly. On "found existing," `app.js` opens a dialog — built with the existing generic `openDialog` primitive — that names the existing album and offers two actions: **Rename it** (opens the rename dialog pre-filled with the existing title) or **Cancel** (no change). No album is created or mutated until the user picks an action.

**Rationale**: Reuses `openDialog`/`showConfirmDialog`-style primitives already in the codebase (Simplicity, UX Consistency). Keeps the one-album-per-date invariant from the 004 migration intact — this is a messaging/recovery fix, not a data-model change.

**Alternatives considered**:
- *Allow multiple albums per calendar date* (drop the unique constraint) — rejected: this would revert an intentional decision from the Supabase migration (`albums_owner_date_unique`), ripple into the auto-grouping-by-capture-date feature for photo uploads, and is far larger in scope than the reported bug.
- *Show a plain error and stop* — rejected: doesn't close the gap the audit called out (user still has no way to fix/rename); fails FR-002's "offer a way to rename" requirement.

## 2. Album rename (FR-003, FR-004)

**Decision**: Add `updateAlbum(albumId, { title })` to `src/modules/db.js`, following the exact validate → Supabase update → `throwClassified`-on-error pattern already used by `updateAlbumOrder` (same file) — validating with the same rule `createAlbum` already applies (`title` empty/blank rejected; `title.length > 255` rejected). On the UI side, generalize `src/ui/create-album-dialog.js` to accept an optional initial value and label overrides so one component serves both "Create Album" and "Rename Album" (avoiding a near-duplicate second modal file). Add an "Edit" action to the album card (`album-grid.js`) and to the album detail header (`album-view.js`), both calling the same rename flow.

**Rationale**: `updateAlbum` mirrors an existing, already-reviewed function shape 1:1 — no new validation philosophy introduced (Code Quality, Simplicity). Reusing the create-album dialog avoids maintaining two near-identical "type an album name" modals.

**Alternatives considered**:
- *New dedicated `edit-album-dialog.js` module* — rejected: the UI is identical to create-album's dialog (single text field + Cancel/Confirm) apart from pre-filled value and labels; a second file would duplicate ~80 lines for no behavioral gain.
- *Inline-editable title (click title to edit in place)* — rejected: bigger UX surface change than the audit asked for, and inconsistent with how every other write action in this app (create, delete) already goes through a modal.

## 3. Full-card click + keyboard access (FR-005, FR-006, FR-007)

**Decision**: In `attachAlbumGridEvents` (`album-grid.js`), extend the existing delegated `click` listener so that a click anywhere on `.album-card` triggers "view" *unless* `event.target.closest('[data-action]')` matches a control other than `view` (i.e., Delete, and the new Edit) — those keep their own handling exactly as today, and the guard prevents the "open album" behavior from double-firing alongside a nested control's own action. Add a parallel `keydown` listener on the grid (delegated, matching the existing pattern) that triggers "view" on Enter/Space **only when `event.target` is the `.album-card` itself** (not a nested button, which already has native Enter/Space activation as a `<button>`), satisfying the "no double-trigger" edge case.

**Rationale**: Matches the codebase's existing event-delegation style exactly (same file already delegates click for `view`/`delete`) — no new interaction pattern introduced. Guarding on `event.target` rather than restructuring the DOM avoids the invalid-HTML problem of nesting interactive elements inside another interactive element.

**Alternatives considered**:
- *Wrap card content in a `<button>` or `<a>`* — rejected: HTML forbids interactive elements nested inside another interactive element (the Delete/Edit buttons already live inside the card); would require restructuring the card's DOM and its existing tests.
- *`role="link"` on the whole card with `aria-label` only, no keyboard handling* — rejected: doesn't satisfy FR-006 (keyboard operability is explicitly required, not just a label).

## 4. Drag-reorder accuracy (FR-008)

**Decision**: In `src/modules/dnd.js`'s `drop` handler, replace the raw `cards.indexOf(card)` value currently passed to `onReorder` with `calculateNewPosition(draggedFromIndex, cards.indexOf(card), cards.length)` — the exact exported helper that already exists in the same file with 5 passing unit tests, just never called.

**Rationale**: The correct logic is already written and tested; this is a one-line integration fix, the smallest possible change (Simplicity). No new logic, no new tests needed for the math itself — only a test confirming the drop handler now calls through to it (extends `tests/unit/dnd.test.js`'s existing "calls onReorder with the dragged album id and drop index" case, whose expected value changes to match the adjusted, correct index).

**Alternatives considered**: None — this is the unambiguous minimal fix; the helper's existing test suite already defines the expected behavior.

## 5. Sign-in screen styling (FR-009, FR-010)

**Decision**: Add `.auth-view` (full-viewport flex-centering, matching how `.modal-backdrop` centers its content), `.auth-card` (centered card using the same `--border-radius-lg`/`--shadow-lg`/`--color-white` tokens as `.modal`), `.auth-label`/`.auth-input` (reusing existing input styling conventions from `create-album-input` if present, otherwise the same tokens), `.auth-error` (reusing `--color-danger` the same way `.alert-error` does), and `.auth-submit` (already gets `.btn.btn-primary`, needs no new rule beyond spacing) to `src/styles/components.css`. All new rules exclusively reference existing CSS custom properties from `main.css` — no new colors/fonts/spacing values introduced.

**Rationale**: `auth-view.js`'s class names already anticipate this styling (`auth-view`, `auth-card`, `auth-label`, `auth-input`, `auth-error`, `auth-submit` are already applied in the JS, just unstyled) — this is purely additive CSS, zero JS changes. Reusing existing tokens guarantees light/dark-mode parity for free (the dark-mode variable overrides in `main.css` already cover every token this reuses).

**Alternatives considered**:
- *New `auth.css` file* — rejected: ~40 lines doesn't warrant a fourth stylesheet when `components.css` already holds every other dialog/card style in the app (Simplicity — avoids fragmenting the existing 3-file `main.css`/`layout.css`/`components.css` split).
