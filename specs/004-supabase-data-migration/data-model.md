# Data Model: Cloud Data Migration (Supabase)

Derived from the spec's Key Entities, mapped onto Supabase (Postgres tables + Storage objects), scoped to a single owner via `owner_id` + RLS.

## albums

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | Replaces today's autoincrement int id. |
| `owner_id` | `uuid`, not null, FK → `auth.users.id` | Always the single app owner; set from the authenticated session, never client-supplied. |
| `album_date` | `date`, not null | Same meaning as today's `Albums.album_date`. |
| `title` | `text`, nullable, max 255 chars | Enforced by app-level validation (mirrors existing `Album.validate()`). |
| `photo_count` | `integer`, not null, default 0 | Maintained by the data-access layer on photo insert/soft-delete, same as today. |
| `position` | `integer`, nullable | Custom display order. Collapses today's separate `AlbumOrder` table into a column on `albums` — see "Design notes" below. |
| `created_at` | `timestamptz`, default `now()` | |
| `updated_at` | `timestamptz`, default `now()` | Updated by the data-access layer on every write. |
| `deleted_at` | `timestamptz`, nullable | Soft-delete marker, same semantics as today. |

**Constraints**: `UNIQUE (owner_id, album_date)` — same uniqueness rule as today's single-owner `Albums.album_date UNIQUE`, now scoped per owner for forward compatibility even though only one owner exists.

**Validation rules** (enforced in the data-access layer, mirroring `src/models/Album.js`):
- `album_date` must be ISO 8601 (`YYYY-MM-DD`).
- `title`, if present, must be ≤255 characters.

## photos

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | Replaces today's autoincrement int id; also used as the Storage object key prefix. |
| `owner_id` | `uuid`, not null, FK → `auth.users.id` | Same owner as the parent album; set server-side/RLS-checked, never client-supplied. |
| `album_id` | `uuid`, not null, FK → `albums.id` | |
| `filename` | `text`, not null, max 255 chars | |
| `file_size` | `bigint`, not null, > 0 | |
| `mime_type` | `text`, not null | One of `image/jpeg`, `image/png`, `image/webp` (matches `getMimeType()` in `storage.js`). |
| `photo_date` | `date`, nullable | Capture date from EXIF, same as today. |
| `upload_date` | `timestamptz`, not null, default `now()` | |
| `storage_path` | `text`, not null | Path of the original image object in the `photos` Storage bucket. |
| `thumbnail_storage_path` | `text`, nullable | Path of the thumbnail object in the same bucket. |
| `exif_json` | `jsonb`, nullable | Same content as today's `exif_json` column, now natively JSON instead of a serialized string. |
| `is_favorite` | `boolean`, not null, default `false` | |
| `created_at` | `timestamptz`, default `now()` | |
| `updated_at` | `timestamptz`, default `now()` | |
| `deleted_at` | `timestamptz`, nullable | Soft-delete marker, same semantics as today. |

**Validation rules** (mirroring `src/models/Photo.js`):
- `filename` required, ≤255 characters.
- `file_size` required, > 0 (and ≤50MB per `validateFileSize()` in `storage.js`).
- `mime_type` required, from the supported set.
- The uploaded binary must exist in Storage at `storage_path` before the row is considered successfully created (FR-008).

## migration_ledger (local only — not a Supabase table)

Tracks progress of the one-time local→cloud migration (see research.md §3). Kept in the browser's local storage/IndexedDB, not in Supabase, since it only matters to the browser performing the migration.

| Field | Type | Notes |
|---|---|---|
| `local_photo_key` | `string` | Stable key derived from the local row, e.g. `` `${album_date}:${filename}:${upload_date}` ``. |
| `cloud_photo_id` | `uuid` | The `photos.id` created for this local photo, once migrated. |
| `migrated_at` | `ISO timestamp` | When this photo's migration succeeded. |

A top-level `migration_status` flag (`not_started` \| `in_progress` \| `completed`) lives alongside the ledger and gates whether the app runs the migration check on startup.

## Design notes

- **Album Order → `albums.position`**: the current schema keeps a separate `AlbumOrder` table with its own unique-position constraint. With a single owner and RLS already scoping rows, a nullable `position` column directly on `albums` expresses the same entity (per spec's "Album Order" key entity) with one fewer table and no join required for the common "list albums in custom order" query — consistent with the Simplicity constitution gate. Reordering logic (shift positions of affected albums) moves from `AlbumOrder` rows to `UPDATE albums SET position = ...` statements.
- **IDs become UUIDs**: Supabase/Postgres convention and required for client-generated, retry-safe inserts during migration (a UUID can be generated locally before the network call, making the insert idempotent on retry via `ON CONFLICT (id) DO NOTHING`).
- **Photo binaries are not modeled as table columns**: `photo_data_base64`/`thumbnail_base64` are replaced by `storage_path`/`thumbnail_storage_path` pointers per research.md §2.

## Relationships

```
auth.users (1 owner) ──< albums ──< photos
                                     │
                                     └─ storage object(s) in `photos` bucket
                                        (original + thumbnail), referenced by path
```

## State transitions

- **Album/Photo lifecycle**: `active` → (soft delete) `deleted_at` set → (restore) `deleted_at` cleared → (hard delete) row removed + associated Storage objects removed.
- **Migration lifecycle**: `not_started` → `in_progress` (ledger being written per-photo) → `completed` (flag set once every local photo has a ledger entry) ; a failed pass simply leaves status at `in_progress` for a later resumed run, per research.md §3.
