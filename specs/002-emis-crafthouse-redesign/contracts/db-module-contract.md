# Contract: `modules/db.js` additions/changes

This app has no network API — its only real "interface" is the exported function surface of `modules/db.js` that the UI layer depends on. This contract documents the new and changed exports so UI work (Phase 2 tasks) and tests can be written against a stable signature before implementation.

## Changed

### `initDB()`

- **Behavior change**: after loading an existing database from IndexedDB (the `if (stored)` branch), MUST check for the `is_favorite` column via `PRAGMA table_info(Photos)` and, if absent, run the migration described in `research.md` item 1, then `persistDB()`.
- **Signature**: unchanged — `initDB(): Promise<Database>`.
- **Guarantee**: idempotent; calling it against an already-migrated database is a no-op beyond the existing load logic.

### `getAlbums(sortByCustom = true)`

- **Behavior change**: each returned album object gains a `cover_thumbnail_base64` field (string or `null` if the album somehow has zero photos).
- **Signature**: unchanged.

## New

### `toggleFavorite(photoId: number): Promise<Photo>`

- Flips `is_favorite` (`0 ↔ 1`) for the given photo, touches `updated_at`, calls `persistDB()`, and returns the updated photo row (same shape as `getPhoto()`).
- Throws if `photoId` does not resolve to a non-deleted photo (mirrors `deletePhoto`'s "Photo not found" behavior).

### `getAllPhotos(options?: { favoritesOnly?: boolean, offset?: number, limit?: number }): Photo[]`

- Returns non-deleted photos across all non-deleted albums, each row including `album_date` and `album_title` (joined from `Albums`) so the UI can render date-section headers and album labels without a second query per photo.
- Ordered by `photo_date DESC, upload_date DESC`.
- `favoritesOnly: true` adds `AND p.is_favorite = 1`.
- Defaults: `offset = 0`, `limit = 50` (same pagination convention as the existing `getPhotos(albumId, offset, limit)`).

### `getFavoritePhotos(offset?: number, limit?: number): Photo[]`

- Thin convenience wrapper: `getAllPhotos({ favoritesOnly: true, offset, limit })`. Exists only so call sites in `ui/photo-gallery.js` read clearly; not strictly required if the UI just calls `getAllPhotos` directly with the option — implementers may inline this instead of adding a second export, as long as the `favoritesOnly` behavior above is exercised by tests.

## Unchanged (explicitly, for regression-safety)

`createAlbum`, `getAlbum`, `getPhotos`, `createPhoto`, `getPhoto`, `deletePhoto`, `deleteAlbum`, `updateAlbumOrder`, `persistDB` — signatures and behavior MUST remain exactly as today. Existing tests in `tests/unit/db.test.js` and `tests/integration/*.test.js` exercising these functions MUST continue to pass unmodified.
