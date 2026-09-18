# Contract: Full-resolution photo viewer (additions to `db.js`, `dialog.js`, `photo-card.js`, `photo-gallery.js`)

This is the internal contract for the code this feature touches. It extends — and does not break — `specs/004-supabase-data-migration/contracts/data-access.md`, which remains authoritative for every unchanged `db.js` export.

## `db.js` — new export

- `getPhotoOriginalUrl(storagePath: string) → Promise<string>`
  - Resolves a photo's original (full-resolution) image to a displayable URL, given the `storage_path` already present on any `Photo` object returned by `getPhoto`/`getPhotos`/`getAllPhotos`.
  - Follows the exact `.code` error contract already defined in `specs/004-supabase-data-migration/contracts/data-access.md`'s "Error surfacing contract" (`'network'` / `'auth'` / `'validation'`) — no new error-handling pattern.
  - Callers are expected to call this on demand (research.md §1), not for every photo in a list.

## `dialog.js` — additive, backward-compatible change

- `openDialog({ title, content, onClose, className? }) → { close: () => void }`
  - **New optional field**: `className` — when provided, added to the rendered `.modal` element's class list (alongside the existing `modal` class), letting a caller override sizing/layout via CSS without touching `openDialog`'s own markup or behavior.
  - Every existing call site (unchanged) continues to work exactly as today; omitting `className` is identical to today's behavior.

## `photo-viewer.js` — new module

- `openPhotoViewer(photo: Photo) → { close: () => void }`
  - Calls `openDialog` (with a viewer-specific `className`) to render:
    - A loading state while `getPhotoOriginalUrl(photo.storage_path)` is pending (FR-004).
    - The resolved image, scaled to fit the viewport, on success (FR-002, FR-006).
    - A clear, user-readable error message if resolution rejects (FR-005), following the same `.code`-based messaging pattern `app.js`'s `describeError()` already uses elsewhere.
  - Returns the same `{ close }` shape `openDialog` returns, for symmetry with the rest of the codebase's dialog-opening functions.

## `photo-card.js` — additive change

- `createPhotoCard(photo, options?)` — the returned card element gains `tabindex="0"` and an `aria-label` (e.g. `"View full-resolution photo: {filename}"`), mirroring `createAlbumCard()`'s existing pattern. No change to the function's parameters or to any existing nested control (favorite, delete, optional select-checkbox).

## `photo-gallery.js` — additive change

- `attachPhotoGalleryEvents(galleryElement, onToggleFavorite, onDeletePhoto, onOpenPhoto?)`
  - **New optional 4th parameter.** Existing two/three-argument call sites keep working unchanged (opening is simply not wired if omitted).
  - **Click contract**: a click anywhere within `.photo-card` invokes `onOpenPhoto(photoId)` unless `event.target.closest('[data-action]')` matches a nested control (favorite, delete, select-checkbox) — those keep their own existing handling and do not also open the viewer (FR-009).
  - **Keyboard contract**: `.photo-card` responds to Enter/Space exactly like a click (invokes `onOpenPhoto`), only when the keypress originates on the card itself, not a bubbled event from a nested `<button>` (FR-008).
  - This one wiring point covers all four FR-001 screens, since `renderPhotoGallery` (Home/My Photos/Favorites) and `renderAlbumView`'s photo grid (Album detail) are both driven through this same function from `app.js` (research.md §3).

## Error surfacing

`getPhotoOriginalUrl` follows the exact `.code` contract already defined in `specs/004-supabase-data-migration/contracts/data-access.md`'s "Error surfacing contract" (`'network'` / `'auth'` / `'validation'`) — the viewer's error state (FR-005) reuses `app.js`'s existing `describeError()` message mapping for the `'network'` case, consistent with how every other data-fetch failure in the app is already communicated.
