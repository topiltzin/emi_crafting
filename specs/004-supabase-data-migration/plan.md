# Implementation Plan: Cloud Data Migration (Supabase)

**Branch**: `004-supabase-data-migration` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-supabase-data-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace the app's sole data store — a sql.js database persisted into browser IndexedDB — with Supabase (Postgres + Storage + Auth), so a single owner's albums and photos survive browser data clears and are reachable from any browser/device. The existing public function surface in `src/modules/db.js` (create/get/list album & photo, favorites, ordering, soft-delete) is preserved so the UI layer (`app.js`, `src/ui/*`) needs no behavioral changes — only the implementation behind those functions changes from local SQL to Supabase calls. A one-time, resumable client-side migration reads any existing local IndexedDB data and copies it into Supabase before the app relies on Supabase exclusively.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser runtime, built with Vite 4

**Primary Dependencies**: Existing: `piexifjs` (EXIF), `sql.js` (retained only to read pre-migration local data, not for new writes). New: `@supabase/supabase-js` (Postgres queries, Storage uploads, Auth session for the single owner).

**Storage**: Supabase Postgres for `albums` and `photos` metadata (see data-model.md); Supabase Storage (private bucket) for original photo files and thumbnails, referenced from `photos` rows by storage path. Browser IndexedDB is retained only transiently, as the source for the one-time migration and as a local ledger of which records have already been migrated.

**Testing**: Vitest (existing unit/integration suite). Supabase calls are isolated behind a thin data-access module (same shape as today's `db.js`) so existing unit/integration tests continue to mock at that boundary; a small set of integration tests run against the Supabase local dev stack (documented in quickstart.md) to validate real schema/RLS behavior.

**Target Platform**: Client-only single-page web app (no project-owned backend server); Supabase is the sole backend-as-a-service dependency.

**Project Type**: Single frontend project (Option 1) — unchanged from today's structure.

**Performance Goals**: Photo upload visibly appears in its album in <5s on standard broadband (SC-004); album list and photo grid remain responsive (perceived load <1s) for a library on the order of thousands of photos.

**Constraints**: The Supabase secret/service key MUST NEVER ship in client code or be committed to the repo — only the publishable (anon) key is used in the browser, paired with Supabase Auth + Row Level Security (RLS) scoping every row to the single owner's user id. The app must clearly surface connectivity/auth failures (FR-007, SC-005) rather than showing an empty or broken gallery. Offline use is out of scope (per spec Assumptions) — the app requires connectivity to read/write data going forward.

**Scale/Scope**: Single owner account; library sized up to several thousand photos across hundreds of albums, consistent with existing personal-use scope. No multi-tenant or multi-account support (FR-009).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality Standards**: The new Supabase data-access module mirrors the existing `db.js` export shape and passes through the same lint/format tooling already configured. **Pass.**
- **Comprehensive Testing**: Existing unit/integration tests remain valid by mocking the data-access boundary; new tests are added for migration logic (idempotent retry, partial-failure handling) and for Supabase-backed CRUD via the local dev stack. 80% coverage threshold (`vite.config.js`) is maintained. **Pass.**
- **Performance Requirements**: SC-004/SC-005 give concrete, measurable targets carried into this plan's Performance Goals/Constraints; Phase 1 quickstart includes a manual check against them. **Pass.**
- **User Experience Consistency**: FR-003 requires identical behavior for all existing operations; preserving `db.js`'s function signatures means `app.js` and all `src/ui/*` components require no changes, so interaction patterns are unchanged. **Pass.**
- **Simplicity and Maintainability**: Supabase is used directly as a managed backend (Postgres + Storage + Auth) rather than introducing a project-owned server — the smallest change that satisfies "data survives the browser" and "reachable from any device." No new services or projects are added. **Pass.**

No violations requiring justification — Complexity Tracking table is not needed.

**Post-Phase 1 re-check**: data-model.md collapses `AlbumOrder` into `albums.position` (fewer moving parts, still Simplicity-compliant); contracts/schema.sql adds RLS scoped to a single owner (Security, satisfies FR-009 without a new service); contracts/data-access.md preserves every existing `db.js` export's name and behavior (UX Consistency unchanged); quickstart.md gives concrete, testable steps against SC-001–SC-006 (Performance/Testing gates satisfied). All gates still **Pass** after design.

## Project Structure

### Documentation (this feature)

```text
specs/004-supabase-data-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── schema.sql
│   └── data-access.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Option 1: Single project (existing structure, unchanged shape)
src/
├── modules/
│   ├── db.js            # Rewritten: same exports, now backed by Supabase instead of sql.js
│   ├── supabase-client.js   # NEW: Supabase client init (URL + publishable key from env)
│   ├── migration.js         # NEW: one-time local→cloud migration + resumable ledger
│   ├── photo.js         # Unchanged public API; internal calls flow through db.js as today
│   ├── album.js         # Unchanged public API
│   ├── exif.js          # Unchanged
│   ├── storage.js       # Unchanged (file read/thumbnail generation stays client-side)
│   └── theme.js         # Unchanged
├── ui/                  # Unchanged — no UI contract changes required by this feature
└── app.js               # Unchanged wiring; gains one migration-check call during init

tests/
├── unit/                # Existing tests + new unit tests for migration.js, supabase-client.js
└── integration/         # Existing tests + new integration tests against Supabase local dev stack
```

**Structure Decision**: Keep the existing single-project layout. This feature only replaces `db.js`'s internals and adds two small modules (`supabase-client.js`, `migration.js`); it does not introduce a backend project, a second app, or new top-level directories, per the Simplicity gate above.

## Complexity Tracking

*No Constitution Check violations — table not needed.*
