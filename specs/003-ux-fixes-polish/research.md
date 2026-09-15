# Phase 0 Research: Gallery UX Reliability & Polish Fixes

No items in Technical Context were marked `NEEDS CLARIFICATION` — the stack, storage, and testing approach are all fixed by the existing codebase (see `plan.md`). The research below instead resolves the open implementation decisions needed before Phase 1 design, each grounded in what was directly observed in the running app and its source during the review that produced `spec.md`.

## 1. Where the "Add Photos" button bug actually lives

**Decision**: Fix it at the source — call `renderPendingList()` once during `attachUploadZoneEvents()` initialization (`src/ui/upload-zone.js`), and scope `.upload-zone-actions` / `.upload-pending-list` in `src/styles/components.css` to `:not([hidden])`.

**Rationale**: Confirmed via DOM inspection of the live app that `confirmBtn.disabled` is `false` on modal open because the only code path that sets it (`renderPendingList()`, `upload-zone.js:80`) is wired to file-change/drop events, never called at init. Independently, `.upload-zone-actions { display: flex }` and `.upload-pending-list { display: grid }` are unconditional class rules that beat the browser's `[hidden] { display: none }` default, so the `hidden` attribute the JS does set has no visible effect. Both defects have to be fixed together — fixing only the disabled state leaves the confirm/cancel buttons visible (just faded) before any file is chosen, which still reads as broken; fixing only the CSS leaves the button clickable-but-inert during the brief window it's forced hidden-but-not-actually-hidden.

**Alternatives considered**: Rewriting the upload zone as a fresh component was rejected — the existing `render*()`/`attach*Events()` structure is sound and used everywhere else in the app (see `contracts/ui-modules-contract.md`); introducing a second pattern here for what is a two-line/one-selector bug would violate the Simplicity principle.

## 2. Shared dialog primitive vs. three separate modals

**Decision**: Introduce one small `ui/dialog.js` module providing a shell (backdrop, panel, title, visible close button, Escape-key handling, focus-on-open) that `ui/confirm-dialog.js`, `ui/create-album-dialog.js`, and the existing Add Photos modal (currently built ad hoc in `app.js:224-247`) all build on.

**Rationale**: The review found the *same* gap — no Escape, no close control — in the one modal that already exists, and the spec requires it to hold for two more new dialogs. Implementing Escape/close-button handling three times invites the three implementations drifting apart the next time someone touches one of them, which is exactly the kind of inconsistency this feature is meant to eliminate (Constitution Principle IV). A single primitive makes "every dialog behaves the same" true by construction instead of by convention.

**Alternatives considered**: A full accessible-dialog library (e.g., a focus-trap or dialog polyfill package) was rejected — the app has zero UI dependencies today beyond vanilla DOM APIs, and the native `<dialog>` element combined with a small amount of hand-rolled focus/Escape logic is sufficient for this app's scope (Constitution Principle V, Simplicity).

## 3. Confirm-delete: replacing `window.confirm()`, not adding a missing safety net

**Correction**: An earlier draft of this research (and of `spec.md`'s User Story 1) assumed deleting a photo or album had no confirmation step at all. Re-checking the source during this research phase found that's wrong: `src/ui/album-grid.js:113`, `src/ui/album-view.js:89`, and `src/ui/photo-gallery.js:89` already wrap every delete action in `window.confirm('Delete this photo/album...? This cannot be undone.')` before calling into `app.js`'s `handleDeletePhoto`/`handleDeleteAlbum`. There is no data-loss bug today — `spec.md` was corrected accordingly (Story 1 moved from P1/"add confirmation" to P2/"replace native confirm").

**Decision**: Replace the three `window.confirm(...)` call sites with the new `ui/confirm-dialog.js` (built on `ui/dialog.js`), which for the album case reads `photo_count` off the already-fetched album object (returned by the existing `getAlbum(albumId)` in `src/modules/db.js`) instead of hardcoding a generic message.

**Rationale**: Confirmed `getAlbum()` already returns `photo_count` on every call site that would need it (album grid, album detail view). No `db.js` change is needed for this feature at all — `deletePhoto`/`deleteAlbum` already default to `hard = false` (soft delete via `deleted_at`), so the underlying delete behavior is already correct and already gated by an explicit confirm; this feature only replaces *how* that confirmation is presented (in-app dialog vs. native `confirm()`), for the same reasons `Create Album`'s `window.prompt()` is being replaced — brand consistency, styling, and avoiding a main-thread-blocking native dialog.

**Alternatives considered**: Adding a dedicated `getAlbumDeletePreview(albumId)` query was rejected as unnecessary — it would duplicate data the caller already has in hand at the moment the user clicks Delete.

## 4. Rejected-file feedback

**Decision**: `addFiles()` in `upload-zone.js` keeps its existing `file.type.startsWith('image/')` filter, but now also collects the filtered-out file names and passes them to a small inline message region already reserved next to the pending list, instead of discarding them silently.

**Rationale**: Confirmed the current filter (`upload-zone.js:105`) already correctly excludes non-image files from being uploaded — the bug is purely that it gives zero feedback about what happened to them. This is a minimal, additive change to an already-correct filter, not a rewrite of the validation logic.

**Alternatives considered**: Blocking the entire drop/selection when any file is invalid (all-or-nothing) was rejected — it would regress the current (silent but at least non-blocking) behavior for the common case of dragging a mixed folder of images and non-images, which is called out as an edge case in `spec.md`.

## 5. Native emoji vs. SVG in navigation, and existing `aria-hidden`

**Decision**: Replace the five emoji characters in `SECTIONS` (`src/ui/nav.js`) with inline SVG markup sized/colored to match the existing pink/purple palette via `currentColor`; keep the existing `aria-hidden="true"` wrapper unchanged.

**Rationale**: Confirmed `nav.js` already wraps every icon in `<span aria-hidden="true">`, so FR-012 (icons not redundantly announced to screen readers) is already satisfied today — the only real defect is the *visual* one (OS-dependent emoji rendering, off-brand color/weight), which inline SVG fixes directly with zero new dependency.

**Alternatives considered**: An icon font or icon-library dependency (e.g., a curated SVG icon package) was rejected — five static icons don't justify a new dependency; inline SVG keeps bundle size and complexity minimal (Constitution Principle V).

## 6. Theme preference storage and application

**Decision**: New `modules/theme.js` reads/writes a single `localStorage` key holding `'light' | 'dark' | 'system'` (default `'system'`, preserving today's behavior for every existing user), and applies the choice by setting `data-theme` on `document.documentElement`. **Found while implementing this decision that half the CSS work is already done**: `main.css:53-54`'s dark-palette block already reads `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` — someone previously anticipated this exact mechanism, so forcing *light* appearance under a dark OS requires no CSS change, only `modules/theme.js` actually setting the attribute (nothing in the codebase sets `data-theme` today — confirmed via repo-wide search). Only forcing *dark* under a light OS needs a new, unconditional `:root[data-theme="dark"]` block, since the existing dark values are trapped inside a `prefers-color-scheme` media query that a `data-theme` attribute alone can't satisfy. See `contracts/theme-module-contract.md` for the exact CSS.

**Rationale**: Mirrors the pattern the codebase already uses (CSS custom properties keyed off a root-level selector) rather than introducing a new theming abstraction. `localStorage` is the right store because this is a per-device UI preference, not gallery data that belongs in the SQLite database — it has no relationship to `Photo`/`Album` and doesn't need to survive a database export/import.

**Alternatives considered**: Storing the preference in the SQLite `Settings`-style table (if one existed) was rejected — there is no such table today, and adding one purely to hold a single UI toggle would be a disproportionate schema change for what `localStorage` already solves in one line, per Constitution Principle V.
