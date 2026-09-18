# Phase 0 Research: Full-Resolution Photo Viewer

No `NEEDS CLARIFICATION` markers were left in the Technical Context — this feature extends an existing, well-understood codebase with no new language/framework/storage decisions. Research below resolves the *design* choice behind each part of the plan.

## 1. Resolve the full-resolution URL on demand, not eagerly (Constraints)

**Decision**: Add a new `db.js` export that resolves a signed URL for a photo's `storage_path` only when called — invoked by the viewer at the moment a user opens it for a specific photo — rather than resolving it inside `toPhoto()` (the function every list/get call already funnels through).

**Rationale**: `toPhoto()` already resolves one signed URL per photo (the thumbnail) for every row returned by `getPhotos`/`getAllPhotos`/`getPhoto` — that cost is paid on every gallery/album load today. Resolving a *second* signed URL per photo there would double Storage API calls on every list load, for full-resolution images the large majority of which a user will never open in a given session. On-demand resolution pays that cost exactly once per photo actually viewed.

**Alternatives considered**:
- *Resolve eagerly in `toPhoto()`, mirroring `thumbnail_url`* — rejected: doubles a cost already paid on every list load, for no benefit until a user actually opens a photo (Performance gate).
- *Resolve eagerly only when a gallery/album is opened, cached client-side* — rejected: same doubled-cost problem, just moved from "every `db.js` call" to "every screen visit"; still pays for images never opened.

## 2. Build the viewer on the existing `openDialog` primitive (Simplicity, UX Consistency)

**Decision**: `src/ui/photo-viewer.js` calls the existing `openDialog({ title, content, onClose, className })` from `src/ui/dialog.js`, which already implements Escape-to-close, backdrop-click-to-close, a visible close button, and focus management/restoration — exactly FR-003's three dismiss methods. `openDialog` gains one new optional parameter, `className`, appended to `.modal`'s class list so the viewer can override sizing (near-fullscreen, not the ~500px width used by confirm/create-album dialogs) without touching any existing caller.

**Rationale**: Every dismiss behavior FR-003 requires is already implemented, tested, and used by every other dialog in the app — reusing it is the smallest possible diff and guarantees interaction consistency (Constitution: UX Consistency) for free. The `className` addition is additive and backward compatible: every existing `openDialog` call site continues to work unchanged.

**Alternatives considered**:
- *A separate, bespoke overlay implementation for the viewer* — rejected: would duplicate Escape/backdrop/focus-trap logic that already exists and is already exercised by `tests/unit/dialog.test.js` (Simplicity).
- *Reuse `openDialog` with zero changes, accepting the ~500px modal width* — rejected: too small to serve as a "full-resolution" viewer; fails FR-002's implicit expectation that the image reads as meaningfully larger/clearer than the grid thumbnail.

## 3. Wire "open on click/keyboard" once, inside `attachPhotoGalleryEvents` (Simplicity, coverage of FR-001)

**Decision**: Add an optional `onOpenPhoto` callback parameter to `attachPhotoGalleryEvents` (`src/ui/photo-gallery.js`), and handle both a delegated `click` and a delegated `keydown` (Enter/Space, guarded to the `.photo-card` element itself, not a nested control) there. Every one of FR-001's four screens (Home, My Photos, Favorites, Album detail) already renders its photo grid through this one function — `renderAlbumView`'s photo grid is the exception rendered via its own `renderPhotoGrid`, but `app.js` already calls `attachPhotoGalleryEvents(view, ...)` on the album-detail view too, so the same wiring point covers all four screens without duplication.

**Rationale**: One implementation point automatically satisfies "every screen where photo thumbnails are shown" (FR-001) instead of requiring four separate wiring sites to stay in sync. This mirrors the click/keyboard pattern just established for `.album-card` in `specs/005-album-ux-fixes` (`attachAlbumGridEvents`), keeping the codebase's interaction model consistent between its two card types.

**Alternatives considered**:
- *Wire click handling separately in each of the four `app.js` render functions* — rejected: four copies of the same logic, with the demonstrated risk (per the 005 feature) that one call site quietly diverges or gets missed (Simplicity, correctness).

## 4. Guard nested controls with the same `closest('[data-action]')` pattern as album cards (correctness, FR-009)

**Decision**: The new click handler in `attachPhotoGalleryEvents` checks `event.target.closest('[data-action]')` before treating a click as "open the viewer," matching the guard pattern `attachAlbumGridEvents` already uses. The keydown handler only opens the viewer when `event.target` is the `.photo-card` element itself, not a bubbled event from a nested `<button>`.

**Rationale**: `photo-card.js`'s favorite button already calls `event.stopPropagation()` on click — but its delete button does not, and neither guards against a future nested control forgetting to. A `closest()`-based check at the delegation point protects every current and future nested control uniformly, rather than relying on each one remembering to stop propagation individually — the same reasoning already applied to album cards.

**Alternatives considered**:
- *Rely on each nested control's own `stopPropagation()`* — rejected: already inconsistently applied within `photo-card.js` itself (favorite has it, delete doesn't), and is easy to forget on the next new control.

## 5. Make `.photo-card` focusable and keyboard-operable (FR-008)

**Decision**: `createPhotoCard()` gains `tabindex="0"` and a descriptive `aria-label` (e.g. "View full-resolution photo: {filename}"), mirroring `createAlbumCard()`.

**Rationale**: `src/styles/components.css` already contains a `.photo-card:focus-visible` rule (shared with `.album-card`/`.photo-tile`) — but `.photo-card` has never had a `tabindex`, so that CSS has been unreachable dead styling until now. This feature is completing an already-half-built pattern, not introducing a new one.

**Alternatives considered**: None — this is the direct, minimal fix; the styling target already existed.
