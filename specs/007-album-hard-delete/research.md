# Phase 0 Research: Permanent Album Deletion

No `NEEDS CLARIFICATION` markers were left in the Technical Context. Research below justifies the decisions in Constraints/Constitution Check — most importantly, *why the existing, unchanged sequencing in `deleteAlbum(hard: true)` is correct and must not be "improved" during this fix*.

## 1. Wire the existing hard-delete implementation to the UI

**Decision**: Change the single call site in `handleDeleteAlbum` (`src/app.js`) from `deleteAlbum(albumId, false)` to `deleteAlbum(albumId, true)`. No other code path calls `deleteAlbum`.

**Rationale**: `deleteAlbum(albumId, hard: true)` already exists in `src/modules/db.js`, already correctly removes Storage objects, photo rows, and the album row (see §2 for why its ordering is sound), and is already covered by the same `throwClassified`/error-code contract every other `db.js` write uses — `handleDeleteAlbum`'s existing `catch` block (`showError(describeError(error, 'Delete album failed'))`) already satisfies FR-004's "tell the user it didn't complete" with no changes needed there.

**Alternatives considered**: None — the fix is a single, unambiguous line change; the only real work is the missing test coverage (§4).

## 2. Do not reorder the existing delete sequence

**Decision**: Keep the existing order exactly as implemented — fetch each photo's Storage paths → remove those Storage objects → delete photo rows → delete the album row.

**Rationale**: This was traced through every failure point to confirm it is the only ordering where a retry can always determine what still needs to happen:

- **Fails before Storage removal** (fetching photo records): nothing has changed yet; fully intact, trivially retry-safe.
- **Fails during Storage removal**: no DB rows have changed; a retry re-derives the *same* Storage paths from the *still-present* photo rows and re-issues the removal — safe, because removing an already-gone Storage object is a no-op, not an error, under Supabase Storage's semantics.
- **Fails during photo-row deletion** (Storage already removed): the photo rows now reference Storage objects that no longer exist — a **transient broken-thumbnail window** — but a retry re-runs the same steps (Storage removal on already-gone paths is again a safe no-op) and completes the row deletion. Self-healing on the very next successful retry.
- **Fails during album-row deletion** (photo rows already gone): an empty, childless album row is left behind — visible as an "empty album" until a retry deletes it (a retry finds zero photos, skips Storage removal, and deletes the now-trivial album row).

The critical, easy-to-get-backwards insight: **once a photo row is deleted, there is no durable record of which Storage paths it owned.** A design that deletes rows *before* Storage cleanup (which an earlier draft of this plan considered, reasoning that it would avoid ever showing a broken thumbnail) has no way to rediscover and finish that cleanup on retry — it would permanently orphan those Storage objects. A transient, self-healing broken-thumbnail window is a strictly better failure mode than a permanent, silent Storage leak with no code path that could ever clean it up. The existing implementation already made the correct choice.

**Alternatives considered**:
- *Delete DB rows first, clean up Storage last* — rejected: permanently orphans Storage objects on any failure between row-deletion and Storage-cleanup, since nothing records the paths once the rows are gone (see above).
- *A staging/outbox table recording pending Storage deletions* — would give true recoverability from any failure point, but is real infrastructure (a new table, a reconciliation job) for a single-owner hobby app's edge case; rejected as disproportionate (Constitution: Simplicity).

## 3. Do not add `ON DELETE CASCADE` to the schema

**Decision**: Leave `photos.album_id references public.albums(id)` as-is; continue deleting photo rows before the album row at the application level rather than letting Postgres cascade it.

**Rationale**: A cascade would make the *database-row* portion of the deletion atomic in a single statement, closing the narrow "empty orphan album" window from §2's last bullet. But it requires a schema migration applied to the live Supabase project — this sandboxed environment has no `psql`/`supabase` CLI and cannot apply or verify DDL against the live project (the identical constraint already documented in `specs/004-supabase-data-migration/tasks.md` T012). The app-level ordering in §2 is already fully retry-safe and self-healing without that dependency, so the cascade's marginal correctness benefit doesn't justify the deployment risk of a change that can't be verified from here.

**Alternatives considered**: The cascade itself, rejected for the reason above. Left as a candidate for a future feature if someone with direct database access wants to tighten the guarantee further.

## 4. Extend the fake Supabase client to test partial failures

**Decision**: Add `_failNextStorageRemoves(count)` and `_failNextTableDeletes(table, count)` to `tests/helpers/fake-supabase.js`, mirroring the existing `_failNextUploads(count)` (already used by `specs/004-supabase-data-migration`'s migration-partial-failure tests).

**Rationale**: The hard-delete path has never been tested, and FR-004/FR-007 are specifically about behavior *under failure* — untestable without a way to inject a failure at a chosen step. The existing `_failNextUploads` pattern (a countdown counter checked at the relevant call site, returning a `TypeError('Failed to fetch')` once) is the established, already-reviewed way to do this in this codebase.

**Alternatives considered**: `_setNetworkDown(true)` (already exists) fails *everything* from that point on, which can't isolate "only this one step fails, then a retry succeeds" — insufficient for exercising the retry-safety this feature is specifically about.
