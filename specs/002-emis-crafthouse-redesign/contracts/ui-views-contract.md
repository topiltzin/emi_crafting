# Contract: New/changed UI view modules

Following the existing `render*()` / `attach*Events()` pairing already established by `ui/album-grid.js` and `ui/album-view.js`, each new UI module exposes a pure render function (returns a detached DOM node, no side effects) and a separate event-attachment function (wires callbacks, no rendering logic). This keeps the redesign consistent with the current codebase's architecture rather than introducing a new UI pattern.

## `ui/nav.js` (new)

- `renderNav(activeSection: 'home'|'photos'|'albums'|'favorites'|'settings'): HTMLElement` — renders the nav bar with a pill highlight on `activeSection`; on narrow viewports the same markup collapses into a mobile menu via CSS (no separate mobile-only render path).
- `attachNavEvents(navElement, onNavigate: (section) => void): void` — one delegated click handler per nav item, plus a mobile-menu open/close toggle.

## `ui/hero.js` (new)

- `renderHero(): HTMLElement` — static hero markup (title "Emi's Craft House", tagline, primary "Add Photos" button, secondary "Create Album" button, decorative shapes). No data dependency.
- `attachHeroEvents(heroElement, onAddPhotos: () => void, onCreateAlbum: () => void): void`.

## `ui/photo-card.js` (new)

- `createPhotoCard(photo: Photo, options?: { showAlbumLabel?: boolean, showCheckbox?: boolean }): HTMLElement` — single shared card used by `album-view.js`'s photo grid, and the new `photo-gallery.js`. Renders thumbnail, date label, optional album label, favorite heart (reflecting `photo.is_favorite`), optional selection checkbox. Replaces/extends the existing `createPhotoTile()` in `album-view.js` (that function's call sites are updated to use this shared card instead of duplicating markup).
- Card dispatches a custom DOM event (`photo-card:favorite-toggle`, detail `{ photoId }`) rather than taking an inline callback, so both `album-view.js` and `photo-gallery.js` can listen for it with one delegated handler, matching the existing delegated-click pattern already used in `album-grid.js`/`album-view.js`.

## `ui/photo-gallery.js` (new)

- `renderPhotoGallery(photos: Photo[], options?: { emptyStateVariant?: 'photos'|'favorites' }): HTMLElement` — groups the already-sorted `photos` array by month/year (per `research.md` item 3) and renders date-section headers + a responsive grid of `createPhotoCard()` cards; renders the appropriate empty state (via `ui/empty-state.js`) when `photos.length === 0`.
- `attachPhotoGalleryEvents(galleryElement, onToggleFavorite: (photoId) => void, onDeletePhoto?: (photoId) => void): void`.

## `ui/upload-zone.js` (new)

- `renderUploadZone(): HTMLElement` — drop target + "choose photos" button + (initially empty) pending-thumbnails list.
- `attachUploadZoneEvents(zoneElement, onConfirm: (files: File[]) => Promise<void>): void` — wires `dragenter`/`dragover`/`dragleave`/`drop`, the file-picker button (delegating to existing `showFileUploadDialog()`), per-item removal from the pending list, and a confirm action that calls `onConfirm` with the final file list (callers pass this straight into the existing, unmodified `uploadPhotos()`).

## `ui/settings-view.js` (new)

- `renderSettingsView(stats: { photoCount: number, albumCount: number, appVersion: string }): HTMLElement` — static info panel; no events beyond standard navigation (handled by `nav.js`).

## `ui/empty-state.js` (new)

- `createEmptyState(variant: 'photos'|'albums'|'favorites'): HTMLElement` — returns the icon/heading/message/CTA markup appropriate to `variant` (copy matches `spec.md`'s Edge Cases / Empty States requirements, e.g. "No creations yet!" / "Add My First Photo" for the photos variant).

## Changed

- `ui/album-grid.js::createAlbumCard(album)` — renders `album.cover_thumbnail_base64` as the card's cover image (falling back to the existing placeholder icon only if absent), plus the new gradient-accent and date-range styling. Function signature unchanged.
- `ui/album-view.js` — its internal photo grid now delegates card rendering to `ui/photo-card.js::createPhotoCard` instead of its own `createPhotoTile`; `renderAlbumView(album, photos)` signature unchanged.
- `app.js` — gains a top-level section router (`home`/`photos`/`albums`/`favorites`/`settings`) driving which `render*` module is mounted, replacing the current `addHeader()`/`renderMainPage()`-only flow; existing `renderAlbumPage(albumId)` drill-down from Albums is unchanged.

## Unchanged (explicitly, for regression-safety)

`ui/file-upload.js::showFileUploadDialog()` and `modules/dnd.js::initDragDrop`/`calculateNewPosition` — signatures and behavior MUST remain exactly as today; `upload-zone.js` and the restyled `album-grid.js` consume them as-is rather than reimplementing their logic.
