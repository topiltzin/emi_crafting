# Phase 1 Data Model: Emi's Craft House Redesign

This feature makes one additive change to the persisted schema (the `is_favorite` flag on `Photo`) and introduces one derived, query-time-only field (`cover_thumbnail_base64` on `Album`). Everything else in the existing `Albums`/`Photos`/`AlbumOrder` schema is unchanged. A new UI-only, non-persisted concept (`NavigationSection`) drives navigation state.

## Photo (existing entity, extended)

Represents a single uploaded craft photo. Backed by the `Photos` table in `modules/db.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK | unchanged |
| `album_id` | integer, FK → Album | unchanged — every photo still belongs to exactly one date-based album |
| `filename` | text | unchanged |
| `file_size` | integer | unchanged |
| `mime_type` | text | unchanged (`image/jpeg`, `image/png`, `image/webp`) |
| `photo_date` | date, nullable | unchanged — derived from EXIF via `modules/exif.js`; falls back to upload date when EXIF is absent |
| `upload_date` | datetime | unchanged |
| `photo_data_base64` | long text | unchanged — full-resolution image data |
| `thumbnail_base64` | long text, nullable | unchanged — 150px square thumbnail |
| `exif_json` | text (JSON), nullable | unchanged |
| **`is_favorite`** | **integer (0/1), NOT NULL, default 0** | **NEW.** Toggled by the favorite-heart control on any photo card. Persisted immediately via `persistDB()` on toggle, same durability guarantee as every other mutation in the app. |
| `created_at` / `updated_at` | datetime | unchanged (existing `updated_at` touch behavior extends naturally to favorite toggles) |
| `deleted_at` | datetime, nullable | unchanged — soft-deleted photos are already excluded from every read query and continue to be excluded from the new gallery/favorites queries |

**Validation rules**: unchanged from the existing `Photo` model (`models/Photo.js::validate()`); `is_favorite` requires no validation beyond being coerced to `0`/`1` at the query layer (SQLite has no native boolean type).

**State transitions**: `is_favorite` toggles `0 → 1` and `1 → 0` only via the new `toggleFavorite(photoId)` database function; no other field affects or is affected by this flag. No transition is destructive or irreversible.

**Migration note**: see `research.md` item 1 — existing rows default to `is_favorite = 0` when the column is added to a pre-existing database, meaning no photo is ever silently "un-favorited" or lost; users simply start with nothing favorited, which is the only reasonable default for a brand-new capability.

## Album (existing entity, unchanged structurally)

Represents one calendar date's worth of photos (`Albums` table). Structurally unchanged by this feature — no new persisted columns.

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK | unchanged |
| `album_date` | date, unique | unchanged — one album per calendar date, auto-created on first upload for that date |
| `title` | text, nullable | unchanged — falls back to a formatted date string in the UI when absent |
| `photo_count` | integer | unchanged — maintained by existing increment/decrement logic on photo create/delete |
| `sort_order` / `AlbumOrder` join | — | unchanged — existing custom drag-and-drop ordering |
| `created_at` / `updated_at` / `deleted_at` | datetime | unchanged |
| **`cover_thumbnail_base64`** | **derived, not persisted** | **NEW, query-time only.** Computed by `getAlbums()` as the `thumbnail_base64` of the most recently uploaded non-deleted photo in that album. Never written to the database; recomputed on every read so it always reflects current photo contents. |

**Date range display**: since each `Album` already corresponds to exactly one calendar date, the "date range" shown on the redesigned album card is simply that single `album_date`, formatted (no new range-storage concept is needed).

## NavigationSection (new, UI-only, not persisted)

A purely client-side concept representing which of the five nav destinations is active, used only to drive the pill-style highlight and to select which view-render function `app.js` calls.

| Value | Renders |
|---|---|
| `home` | Hero + a short "recent activity" teaser (reuses the redesigned album grid or gallery, not a new data source) |
| `photos` | New flat, date-grouped gallery (`getAllPhotos()`, `favoritesOnly: false`) |
| `albums` | Redesigned album grid (`getAlbums()`, unchanged data source) |
| `favorites` | New flat, date-grouped gallery (`getAllPhotos()`, `favoritesOnly: true`) |
| `settings` | App info + storage stats (reuses existing count queries) |

No database table or IndexedDB entry is introduced for this; it lives entirely as in-memory state in `app.js`, exactly like the existing `currentView`/`currentAlbumId` variables already do today.

## Relationships (unchanged)

```
Album (1) ──< (many) Photo
```

Every `Photo` still belongs to exactly one `Album` (its upload date's album); favoriting a photo does not change or duplicate this relationship, and the Favorites/My Photos views are read-time projections across all albums, not a new ownership relationship.
