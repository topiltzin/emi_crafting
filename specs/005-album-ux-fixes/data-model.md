# Phase 1 Data Model: Album Reliability & Usability Fixes

No schema changes. This feature reads and writes an existing column (`albums.title`) through an existing table; no migration is required.

## Album (existing entity, unchanged shape)

Source of truth: `specs/004-supabase-data-migration/contracts/schema.sql` (`public.albums`) — reproduced here only for the fields this feature touches.

| Field | Type | Relevant rule for this feature |
|---|---|---|
| `id` | `uuid` | Identifies which album a rename/reorder/open action targets. |
| `owner_id` | `uuid` | Unchanged; every operation in this feature stays scoped to the signed-in owner via existing RLS. |
| `album_date` | `date` | Unchanged. `UNIQUE (owner_id, album_date)` is the constraint behind FR-002's "album already exists for today" case — this feature does not alter it. |
| `title` | `text`, nullable, ≤255 chars | **Now writable post-creation.** Rename (FR-003) enforces the same non-empty/≤255-char rule `createAlbum` already applies (see `data-model.md` in 004: "title, if present, must be ≤255 characters"). |
| `position` | `integer`, nullable | **Correctness fix, not a new field.** FR-008 corrects the *value* written here during drag-reorder (via the now-wired `calculateNewPosition`); the write path (`updateAlbumOrder`) and column are unchanged. |
| `photo_count` | `integer` | Unchanged; unaffected by this feature. |

## Validation rules added by this feature

- **Rename title**: non-empty after trimming, ≤255 characters. Rejecting an invalid rename leaves `title` at its previous value (spec Edge Cases) — i.e., `updateAlbum` validates *before* issuing any write, exactly like `createAlbum` and `updateAlbumOrder` already do.
- **Create-when-exists**: no new validation rule; this is a UI-flow change (spec FR-002) around the pre-existing `albums_owner_date_unique` constraint. The app already gets an authoritative answer from `getAlbums()` (used today by `createAlbumIfNeeded`) about whether a same-date album exists — this feature surfaces that answer to the user instead of silently swallowing it.

## State/flow notes (not persisted entities)

- **"Album already exists" prompt**: transient UI state only (which dialog is open, what it's pre-filled with) — never written to storage. Resolves to either an `updateAlbum` call (if the user chooses to rename) or no call at all (if cancelled).
- **Album card interaction state** (hover/focus/dragging/drag-over): purely presentational, already exists today as CSS classes (`dragging`, `drag-over`) — this feature does not add new persisted or in-memory state for it, only correct event wiring.
