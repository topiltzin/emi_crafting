# Contract: Permanent album deletion (`app.js` call site + test helper additions)

This is the internal contract for the code this feature touches. It extends — and does not break — `specs/004-supabase-data-migration/contracts/data-access.md`, which remains authoritative for `db.js`'s existing `deleteAlbum(albumId, hard)` signature (unchanged by this feature — only the argument value passed to it changes).

## `app.js` — behavior change, no signature change

- `handleDeleteAlbum(albumId)` now calls `deleteAlbum(albumId, true)` instead of `deleteAlbum(albumId, false)`. Its own signature, its confirmation-dialog trigger (`attachAlbumGridEvents`'s existing delete flow), and its error handling (`catch` → `showError(describeError(...))`) are all unchanged.

## `db.js` — no change

- `deleteAlbum(albumId, hard)` itself is not modified. Its existing `hard: true` branch (Storage removal → photo-row deletion → album-row deletion, each `throwClassified` on error) is exactly what this feature now actually exercises in production instead of leaving untested.

## `tests/helpers/fake-supabase.js` — new test-only hooks

- `_failNextStorageRemoves(count: number)`: the next `count` calls to `storage.from(bucket).remove(paths)` reject with the same `TypeError('Failed to fetch')` shape `_failNextUploads` already uses, then behave normally again.
- `_failNextTableDeletes(table: string, count: number)`: the next `count` `.from(table).delete()...` calls reject the same way, scoped to the named table (so a test can fail `photos` deletes without also failing `albums` deletes, or vice versa).

Both follow the exact pattern already established by `_failNextUploads` (a countdown counter checked at the relevant call site) — no new failure-simulation mechanism is introduced.

## Error surfacing

Unchanged. `deleteAlbum`'s existing `.code` contract (`'network'` / `'auth'` / `'validation'`, per `specs/004-supabase-data-migration/contracts/data-access.md`) is exactly what `handleDeleteAlbum`'s `describeError()` call already branches on — no new error-handling pattern.
