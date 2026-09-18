# Phase 1 Data Model: Full-Resolution Photo Viewer

No schema changes. No new entities. This feature adds a runtime-only capability on the existing `Photo` entity.

## Photo (existing entity, unchanged persisted shape)

Source of truth: `specs/004-supabase-data-migration/contracts/schema.sql` (`public.photos`) and `specs/004-supabase-data-migration/contracts/data-access.md` — reproduced here only for the field this feature relies on.

| Field | Type | Relevant to this feature |
|---|---|---|
| `storage_path` | `text`, not null | Already present on every `Photo` object `db.js` returns (via `toPhoto()`'s row spread) — the original, full-resolution image's Storage object path, set at upload time. **Never resolved to a displayable URL today.** This feature adds that resolution. |
| `thumbnail_storage_path` | `text`, nullable | Unchanged — already resolved to `thumbnail_url` by `toPhoto()`; remains the image shown in every gallery grid. |

## Runtime-only field added by this feature

- **Full-resolution URL**: Not persisted, not attached to `Photo` objects returned by `getPhotos`/`getAllPhotos`/`getPhoto` (see research.md §1 — attaching it there would double signed-URL calls on every list load). Instead, resolved on demand by a new `db.js` function, called with a photo's existing `storage_path` at the moment a user opens the viewer for that specific photo. This mirrors how `thumbnail_url` is already a runtime-only, resolved-not-stored field — the difference is only *when* resolution happens (eager for thumbnails, on-demand for the original).

## Validation rules

None new. The resolver takes an already-known, already-validated `storage_path` string (every photo row has one, enforced `not null` at the database level per schema.sql) — there is no new user input to validate.

## State/flow notes (not persisted entities)

- **Viewer open/loading/error state**: transient UI state only (which photo's viewer is open, whether its URL resolution is pending/succeeded/failed) — never written to storage, matching FR-007 ("opening or closing MUST NOT change the photo's stored data, favorite status, or album membership").
