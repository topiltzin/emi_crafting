# Contract: `src/modules/db.js` data-access API

This is the internal contract the rest of the app (`app.js`, `src/modules/photo.js`, `src/modules/album.js`, `src/ui/*`) depends on. It is unchanged in shape from today's sql.js-backed implementation — only the implementation behind it moves to Supabase — so no caller-side code changes are required by this feature (Constitution: User Experience Consistency, Simplicity).

All functions become (or remain) `async` and now reject with an `Error` carrying a `.code` of `'network'`, `'auth'`, or `'validation'` so callers/tests can distinguish failure kinds for FR-007's messaging without parsing strings.

## Lifecycle

- `initDB()` → `Promise<void>` — establishes the Supabase session for the single owner (see quickstart.md for how the session is obtained) and, on first run only, triggers the migration check from research.md §3 before resolving.

## Albums

- `createAlbum(albumDate: string, title?: string) → Promise<Album>`
- `getAlbum(albumId: string) → Promise<Album | null>`
- `getAlbums(sortByCustom?: boolean) → Promise<Album[]>` — same default-true behavior as today; ordering now reads `albums.position` instead of joining `AlbumOrder`.
- `deleteAlbum(albumId: string, hard?: boolean) → Promise<void>`
- `updateAlbumOrder(albumId: string, newPosition: number) → Promise<void>` — same validation (`0 <= newPosition < total`) and re-indexing behavior as today, now writing `albums.position` directly instead of the `AlbumOrder` table.

## Photos

- `createPhoto(albumId: string, photoData: PhotoInput) → Promise<Photo>` — `photoData` gains no new required fields from the caller's perspective; the data-access layer internally uploads the binary to Storage and stores `storage_path`/`thumbnail_storage_path` instead of accepting `photo_data_base64`/`thumbnail_base64` as final storage — see "Input shape change" below.
- `getPhoto(photoId: string) → Promise<Photo | null>`
- `getPhotos(albumId: string, offset?: number, limit?: number) → Promise<Photo[]>`
- `getAllPhotos(options?: { favoritesOnly?: boolean, offset?: number, limit?: number }) → Promise<Photo[]>`
- `deletePhoto(photoId: string, hard?: boolean) → Promise<void>`
- `toggleFavorite(photoId: string) → Promise<Photo>`

### Input shape change (caller-visible, minimal)

`photo.js`'s `addPhoto()` today builds `{ ..., photo_data_base64, thumbnail_base64, ... }` and passes it to `createPhoto()`. Under Supabase, `createPhoto()` still accepts the same base64 strings (so `photo.js` and `storage.js` need no change) but now uploads them to Storage internally and persists only the resulting paths — the base64-in/paths-out conversion is an implementation detail of `db.js`, not a contract change for its callers.

### Returned `Photo`/`Album` shape

Same fields as today's `rowToPhoto`/`rowToAlbum` output, with two differences callers must tolerate:
- `id`/`album_id` are now UUID strings instead of integers.
- `Photo` gains `storage_path`/`thumbnail_storage_path`; `getThumbnailUrl()`/`getPhotoUrl()` in `src/models/Photo.js` resolve these to a displayable URL (via Supabase Storage's public/signed URL helper) instead of building a `data:` URI from base64 — this is the one model-layer change required, isolated to those two methods.

## Migration

- `getMigrationStatus() → Promise<'not_started' | 'in_progress' | 'completed'>`
- `runMigration(onProgress?: (done: number, total: number) => void) → Promise<{ migrated: number, alreadyDone: number, failed: number }>` — implements research.md §3; safe to call multiple times (resumable, no duplicates per FR-010).

## Error surfacing contract

Any rejection from the above functions MUST carry `.code`:
- `'network'` — request couldn't reach Supabase (offline, timeout, DNS) → UI shows the FR-007/SC-005 connectivity message.
- `'auth'` — session missing/expired → UI prompts re-authentication.
- `'validation'` — request violated a rule in data-model.md (e.g. bad `album_date`, oversized file) → UI shows the existing per-field error messaging, unchanged from today.
