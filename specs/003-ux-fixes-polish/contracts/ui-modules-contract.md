# Contract: UI module additions/changes

This app has no network API — its "interface" is the exported function surface of the `ui/*` modules, following the existing `render*()` / `attach*Events()` pairing already established by `ui/album-grid.js` and `ui/album-view.js` (see `specs/002-emis-crafthouse-redesign/contracts/ui-views-contract.md` for the convention this feature continues). This contract documents new and changed exports so implementation (Phase 2 tasks) and tests can be written against a stable signature before implementation.

## New

### `ui/dialog.js` (new)

- `openDialog({ title, content, onClose }): { close: () => void }` — creates the shared modal shell: backdrop, panel, `<h2>` title, a visible close button (`data-action="dialog-close"`, `aria-label="Close dialog"`), and appends the caller-supplied `content` element. Wires: `Escape` keydown closes and calls `onClose()`; a click on the backdrop itself (not the panel) closes and calls `onClose()`; the close button closes and calls `onClose()`. Returns a handle whose `close()` method callers can invoke programmatically (e.g. after a successful confirm/create) — calling `close()` does **not** itself call `onClose()` again (callers that already know the outcome call it directly).
- Focus: on open, focus moves to the panel's first focusable element (or the close button if none); on close, focus returns to the element that was focused before the dialog opened.
- Replaces the ad hoc backdrop/modal construction currently inlined in `app.js:220-261` (`openUploadModal`) — that function is refactored to call `openDialog()` instead of building its own backdrop/modal/close-on-backdrop-click logic, so the existing Add Photos dialog gains Escape-to-close and a visible close button for free, with no behavior change to its upload flow.

### `ui/confirm-dialog.js` (new)

- `showConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true }): Promise<boolean>` — renders a confirmation prompt inside `openDialog()`'s shell; resolves `true` if the user clicks the confirm button, `false` if they cancel, close, click the backdrop, or press Escape. `danger: true` (the default, used for all current call sites) styles the confirm button as `btn-danger`, matching the existing `.btn-danger` class already used for the album card's Delete button.
- **Replaces** the three `window.confirm(...)` call sites (see `research.md` item 3's correction — this is a like-for-like replacement of an existing confirmation step, not new gating logic):
  - `ui/album-grid.js:113` — `if (confirm('Delete this album and all photos? This cannot be undone.'))` becomes `if (await showConfirmDialog({ title: 'Delete album?', message: `"${album.title || album.album_date}" and its ${album.photo_count} photo(s) will be removed. This can't be undone.` }))`, using the `photo_count` already present on the `album` object the Delete button was rendered from (`research.md` item 3) — no new query.
  - `ui/album-view.js:89` and `ui/photo-gallery.js:89` — `if (confirm('Delete this photo? This cannot be undone.'))` becomes `if (await showConfirmDialog({ title: 'Delete photo?', message: `"${photo.filename || 'This craft photo'}" will be removed. This can't be undone.` }))`.
- `attachAlbumGridEvents(gridElement, onViewAlbum, onDeleteAlbum)`, `attachAlbumViewEvents(container, onBack, onAddPhotos, onDeletePhoto)`, and `attachPhotoGalleryEvents(galleryElement, onToggleFavorite, onDeletePhoto)` signatures are all unchanged — the swap happens inside their existing delete-click handlers, so `app.js`'s `onDeleteAlbum`/`onDeletePhoto` callback wiring is unaffected.

### `ui/create-album-dialog.js` (new)

- `showCreateAlbumDialog(): Promise<string | null>` — renders a single labeled text input + Create/Cancel buttons inside `openDialog()`'s shell. Resolves the trimmed name on Create with a non-blank input; resolves `null` on Cancel, close, backdrop click, or Escape. Submitting a blank/whitespace-only name does **not** resolve — it shows an inline validation message (`"Please enter an album name."`) next to the input and keeps the dialog open, matching FR-008.
- **Replaces** `window.prompt("Name your new album (e.g. 'Paper Crafts'):", '')` at `app.js:207`. `handleCreateAlbum()` changes from `const title = window.prompt(...); if (title === null) return;` to `const title = await showCreateAlbumDialog(); if (title === null) return;` — the rest of `handleCreateAlbum()` (the call to `createAlbumIfNeeded(today, title || null)`) is unchanged, since the dialog itself now guarantees `title` is either a non-blank trimmed string or `null`.

## Changed

### `ui/upload-zone.js`

- `attachUploadZoneEvents(zoneElement, onConfirm)` — **behavior change, signature unchanged**: calls `renderPendingList()` once immediately after wiring events (before returning), instead of only in response to add/remove events, so `confirmBtn.disabled` and the `hidden` state of `.upload-zone-actions` / `.upload-pending-list` are correct from the moment the dialog opens (fixes FR-004/FR-005; see `research.md` item 1).
- `addFiles(fileList)` — **behavior change, still internal**: files failing the existing `file.type.startsWith('image/')` filter are no longer silently dropped; their names are collected and passed to a new `renderRejectedNotice(names)` internal helper that shows/updates an inline message near the pending list (cleared on the next successful add or on cancel). No new exported function — this stays an implementation detail of `attachUploadZoneEvents`.

### `ui/nav.js`

- `renderNav(activeSection)` — **behavior change, signature unchanged**: the `SECTIONS` array's `icon` field changes from an emoji character to an inline SVG markup string (see `data-model.md`'s Navigation Icon entity). The existing `<span aria-hidden="true">${section.icon}</span>` wrapper is unchanged, so the accessibility tree is unaffected — screen readers still announce only `section.label`.

### `ui/settings-view.js`

- `renderSettingsView(stats)` — **signature unchanged** (`stats` shape unchanged). Gains one new card, "Appearance", rendered between the existing "Your Gallery" and "Managing Your Data" cards, containing a three-way control (Light / Dark / Match Device) reflecting the current value from `modules/theme.js` (see `contracts/theme-module-contract.md`).
- A new `attachSettingsViewEvents(viewElement, onAppearanceChange: (theme: 'light'|'dark'|'system') => void): void` is added (this view currently has no `attach*Events` export because it has no interactive elements — this is the first one, following the same pairing convention as every other view module).

## Unchanged (explicitly, for regression-safety)

`ui/album-grid.js`'s `renderAlbumGrid()`, `ui/album-view.js`'s render function, `ui/photo-gallery.js`'s `renderPhotoGallery()`, `ui/photo-card.js`, `ui/hero.js`, `ui/empty-state.js`, `ui/file-upload.js` — all unchanged. `modules/db.js`, `modules/album.js`, `modules/photo.js`, `modules/storage.js`, `modules/dnd.js`, `modules/exif.js` — all unchanged (confirmed no schema or query changes are needed; see `data-model.md`). Existing tests exercising any of the above MUST continue to pass unmodified.
