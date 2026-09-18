# Phase 1 Data Model: Permanent Album Deletion

No schema changes (research.md §3). No new entities. This feature changes which existing, already-implemented deletion behavior the UI invokes.

## Album / Photo (existing entities, unchanged persisted shape)

Source of truth: `specs/004-supabase-data-migration/contracts/schema.sql`.

| Field | Relevant to this feature |
|---|---|
| `albums.deleted_at` | No longer set by the UI's delete action — the row is removed outright instead. Column itself is unchanged (still used elsewhere, e.g. if a future feature reintroduces soft-delete for a different action). |
| `photos.deleted_at` | Same — no longer set when an album is deleted; the photo rows are removed outright along with their album. |
| `photos.storage_path` / `thumbnail_storage_path` | Read once (before row deletion) to know which Storage objects to remove — see research.md §2 for why this must happen before the rows are deleted, not after. |

## State transition: Album deletion

```
[Album exists, with N photos]
        │  user confirms delete
        ▼
[Storage objects for all N photos removed]   ← retry-safe: re-derivable from still-present rows
        │
        ▼
[Photo rows deleted]                         ← retry-safe: Storage removal on already-gone
        │                                        objects is a no-op, not an error
        ▼
[Album row deleted]                          ← retry-safe: deleting 0 matching photo rows is a
        │                                        no-op; album row deletion is the final step
        ▼
[Album and all N photos gone — SC-001/SC-002]
```

**Disclosed partial-state windows** (research.md §2 — accepted, not eliminated, because every one of them is retry-safe and self-healing on the very next attempt):

1. Between "Storage objects removed" and "photo rows deleted" — the photo rows exist but their images are gone (a transient broken-thumbnail state if the user reloads at exactly this moment). Heals on retry.
2. Between "photo rows deleted" and "album row deleted" — an empty, childless album row is visible in the Albums list. Heals on retry.

Neither window is reachable by anything short of an actual mid-operation failure (network drop, etc.) — the happy path (the overwhelming majority of deletions) goes straight through to "gone" with no intermediate state ever observable by the user.

## Validation rules

None new. `deleteAlbum(albumId, hard: true)` already validates the album exists (`getAlbum(albumId)`, throwing `validationError('Album not found')` otherwise) before doing anything — unchanged by this feature.
