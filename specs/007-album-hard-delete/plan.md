# Implementation Plan: Permanent Album Deletion

**Branch**: `007-album-hard-delete` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-album-hard-delete/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Make album deletion permanent, matching what its own confirmation dialog already promises ("This can't be undone"). A fully-correct permanent-delete implementation (`deleteAlbum(albumId, hard: true)` in `db.js` — removes Storage files, then photo rows, then the album row, in an order already safe to retry at every step) already exists in the data layer but has never been called: the UI's only call site (`handleDeleteAlbum` in `app.js`) always passes `hard: false`, so every album delete today only sets a hidden flag. The app has no trash/restore screen, so that hidden data is invisible and unrecoverable in practice while still consuming storage forever. This plan's core change is a single call-site fix, backed by the test coverage that code path has never had.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser runtime, built with Vite 4 — unchanged.

**Primary Dependencies**: None added. Uses the existing, already-implemented `deleteAlbum(albumId, hard)` in `src/modules/db.js` and the existing Supabase Storage `remove()` call it already makes.

**Storage**: No schema change. `photos.album_id references public.albums(id)` has no `ON DELETE CASCADE` today, which is why `deleteAlbum(hard: true)` must (and already does) delete photo rows before the album row — a schema-level cascade was considered and rejected (research.md §3): it would require a live migration against the Supabase project that this environment has no way to apply or verify (the same documented constraint as `specs/004-supabase-data-migration`), for a correctness benefit the existing app-level ordering already delivers.

**Testing**: Vitest (existing suite) — extends `tests/unit/db.test.js`'s "Album deletion" describe block with the hard-delete path (currently zero coverage), and extends `tests/helpers/fake-supabase.js` with two new failure-injection hooks (mirroring the existing `_failNextUploads`) so partial-failure/retry behavior (FR-004, FR-007) can actually be tested, not just asserted informally.

**Target Platform**: Client-only single-page web app — unchanged.

**Project Type**: Single frontend project (Option 1) — unchanged.

**Performance Goals**: SC-005 ("deleted album disappears from every screen within 1s") is met by construction — a hard-deleted row simply no longer exists, so every existing `getAlbums()`/`getAllPhotos()` query already excludes it with no additional code; the UI already re-navigates to the albums list immediately after a successful deletion.

**Constraints**: The deletion sequence's existing order (fetch photo Storage paths → remove Storage objects → delete photo rows → delete album row) MUST NOT be reordered — research.md §2 traces every failure point and shows this specific order is the only one where a retry can always rediscover what still needs cleaning up (once a photo row is deleted, nothing durable records which Storage paths it owned, so Storage cleanup must happen while the row — and thus its path — still exists).

**Scale/Scope**: Single-owner library scale, unchanged; deleting an album is bounded by that album's own photo count.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality Standards**: The fix is a one-argument change at a single call site (`false` → `true`), invoking code that already follows this file's established validate/`throwClassified`/sequential-Supabase-calls pattern. **Pass.**
- **Comprehensive Testing**: The hard-delete path has zero existing tests despite being fully implemented — this plan's test additions (happy path, Storage-removal failure + retry, photo-row-delete failure + retry, cancel-does-nothing) close that gap directly; 80% coverage threshold maintained. **Pass.**
- **Performance Requirements**: SC-005 is met by construction (see Performance Goals above) — no new performance work needed. **Pass.**
- **User Experience Consistency**: The existing delete-confirmation dialog's wording already accurately describes permanent deletion — this feature makes the behavior match that existing, unchanged UX promise rather than introducing a new one. **Pass.**
- **Simplicity and Maintainability**: Rejected the schema-cascade alternative specifically because it adds a live-migration dependency for a correctness benefit the existing (already-implemented) app-level sequencing already provides — the smallest change that satisfies the spec. **Pass.**

No violations requiring justification — Complexity Tracking table is not needed.

**Post-Phase 1 re-check**: data-model.md documents the one accepted, disclosed, self-healing partial-state window (a temporarily-broken thumbnail if Storage removal succeeds but the following photo-row delete fails, healed by the next retry) rather than claiming impossible cross-store atomicity — consistent with Simplicity over premature/disproportionate engineering (an outbox or staging-table pattern was considered and rejected for the same reason). All gates still **Pass** after design.

## Project Structure

### Documentation (this feature)

```text
specs/007-album-hard-delete/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── album-hard-delete.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Single project (existing structure, unchanged shape)
src/
└── app.js                    # handleDeleteAlbum: deleteAlbum(albumId, false) → deleteAlbum(albumId, true)

tests/
├── helpers/
│   └── fake-supabase.js      # + _failNextStorageRemoves(count), _failNextTableDeletes(table, count)
├── unit/
│   └── db.test.js            # + hard-delete coverage in the existing "Album deletion" describe block
└── integration/
    └── app.test.js           # extends the existing "deletes an album after confirmation" test's assertions
                                #   to also confirm Storage objects and photo rows are actually gone
```

**Structure Decision**: Keep the existing single-project layout. This is the smallest possible change: one call-site fix in already-existing application code, plus new tests exercising an already-existing (previously untested) code path. No new modules, no schema change, no new dependencies.

## Complexity Tracking

*No Constitution Check violations — table not needed.*
