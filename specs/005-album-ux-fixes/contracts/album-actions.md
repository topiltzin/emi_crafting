# Contract: Album actions (additions/fixes to `src/modules/db.js`, `src/ui/*`, `src/modules/dnd.js`)

This is the internal contract for the code this feature touches. It extends — and does not break — `specs/004-supabase-data-migration/contracts/data-access.md`, which remains authoritative for every unchanged `db.js` export.

## `db.js` — new export

- `updateAlbum(albumId: string, { title: string }) → Promise<Album>`
  - Validates exactly like `createAlbum`'s title rule: rejects with a `'validation'`-coded error (see 004's "Error surfacing contract") if `title` is empty/blank after trimming, or exceeds 255 characters. On rejection, no write is issued and the album's stored title is unchanged.
  - On success, updates `albums.title` (and `updated_at`) for the given `id`, scoped to the signed-in owner via existing RLS (no explicit `owner_id` filter needed client-side, matching `toggleFavorite`'s existing pattern), and returns the updated `Album` in the same shape as every other `db.js` album-returning function.

## `db.js` / `album.js` — existing behavior, now surfaced instead of swallowed

- `createAlbumIfNeeded(albumDate, title?) → Promise<{ album: Album, created: boolean }>`
  - **Shape change, caller-visible**: today this returns just `Album`; this feature changes it to return `{ album, created }` so `app.js`'s `handleCreateAlbum` can tell "created a new album" apart from "found today's existing album" and branch per FR-002. `created: true` when a new row was inserted; `created: false` when an existing same-date album was found and returned as-is (its title is **not** overwritten by the caller's requested title — same as today).
  - This is the one intentional caller-visible shape change in this feature; `ensureAlbumsExist` (used by the photo-upload auto-grouping path, spec Assumptions) is updated to unwrap `.album` so its own callers see no change.

## UI contracts

- `showCreateAlbumDialog() → Promise<string | null>` — **unchanged** signature/behavior (existing "Create Album" entry point).
- `showCreateAlbumDialog({ mode: 'rename', initialValue, title }) → Promise<string | null>` (or an equivalent second export, e.g. `showRenameAlbumDialog(currentTitle)` — implementation's choice, contract is: same resolve-with-trimmed-string-or-null behavior as today's `showCreateAlbumDialog`, pre-filled with `currentTitle`, labeled for renaming rather than creating).
- `attachAlbumGridEvents(gridElement, onViewAlbum, onDeleteAlbum, onEditAlbum?)` — gains an optional edit callback; existing two-callback call sites keep working unchanged (edit is additive, not replacing view/delete).
  - **New click contract**: a click anywhere within `.album-card` invokes `onViewAlbum` unless the click's target is inside a `[data-action]` control other than the card-level "view" trigger (i.e. Delete or Edit keep their own handling and do not also invoke `onViewAlbum`).
  - **New keyboard contract**: `.album-card` responds to Enter/Space exactly like a click on the card (invokes `onViewAlbum`), only when the keypress originates on the card itself (not bubbled from a nested `<button>`, which already handles its own Enter/Space natively).
- `attachAlbumViewEvents(container, onBack, onAddPhotos, onDeletePhoto, onEditAlbum?)` — gains an optional edit callback for the detail-view header's new Edit action; existing four-callback call sites keep working unchanged.

## `dnd.js` — corrected (not new) contract

- `initDragDrop(gridElement, onReorder)` — **unchanged signature**. Only the *value* passed to `onReorder`'s second argument changes: it now equals `calculateNewPosition(fromIndex, dropIndex, totalCards)` instead of the raw DOM `dropIndex`, matching `calculateNewPosition`'s own existing, already-tested contract (`src/modules/dnd.js`).

## Error surfacing

`updateAlbum` follows the exact `.code` contract already defined in `specs/004-supabase-data-migration/contracts/data-access.md`'s "Error surfacing contract" (`'network'` / `'auth'` / `'validation'`) — no new error-handling pattern is introduced.
