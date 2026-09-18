# Implementation Plan: Album Reliability & Usability Fixes

**Branch**: `005-album-ux-fixes` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-album-ux-fixes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Fix five defects/gaps in the existing Albums area surfaced by a UX/functional audit: a silent no-op on "Create Album" when a same-day album already exists (FR-001/002), non-functional full-card click and keyboard access on album cards (FR-005/006/007), a missing album-rename capability (FR-003/004), an unwired off-by-one drag-reorder calculation (FR-008), and an unstyled sign-in screen (FR-009/010). All five are fixes/extensions to existing, already-shipped code (`src/modules/db.js`, `src/modules/album.js`, `src/app.js`, `src/ui/album-grid.js`, `src/ui/album-view.js`, `src/modules/dnd.js`, `src/ui/create-album-dialog.js`, `src/ui/auth-view.js`, `src/styles/components.css`) — no schema changes, no new dependencies, no new backend calls beyond one new `db.js` function (`updateAlbum`) that mirrors the shape of the existing `updateAlbumOrder`.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser runtime, built with Vite 4 — unchanged from the current codebase.

**Primary Dependencies**: None added. Reuses existing `@supabase/supabase-js` client (`src/modules/supabase-client.js`), existing `db.js` data-access module, and existing UI primitives (`src/ui/dialog.js`'s `openDialog`, `src/ui/confirm-dialog.js`).

**Storage**: Supabase Postgres `albums` table (existing `title` column, already nullable/≤255 chars per `specs/004-supabase-data-migration/contracts/schema.sql`). No schema migration needed — renaming an album is a plain `UPDATE` on an existing column.

**Testing**: Vitest (existing unit/integration suite) — extends `tests/unit/db.test.js`, `tests/unit/album-module.test.js`, `tests/unit/dnd.test.js`, `tests/unit/create-album-dialog.test.js`, `tests/integration/album-redesign.test.js`, `tests/integration/album-reorder.test.js`, `tests/integration/create-album-flow.test.js`, and `tests/unit/auth-view.test.js`.

**Target Platform**: Client-only single-page web app (unchanged) — no project-owned backend server.

**Project Type**: Single frontend project (Option 1) — unchanged from today's structure.

**Performance Goals**: Rename and reorder actions reflect everywhere they're shown within 2s (SC-004), consistent with the existing single-row Supabase update latency already used by `toggleFavorite`/`updateAlbumOrder` — no new performance target beyond what's already met.

**Constraints**: Every existing `db.js` export keeps its current name/shape (Constitution: UX Consistency, Simplicity) — this feature only adds one new export (`updateAlbum`) rather than changing any existing signature. The one-album-per-calendar-date uniqueness rule from the 004 migration is preserved as-is (see spec Assumptions) — this feature changes only how the app communicates and recovers when that rule blocks a create, not the rule itself.

**Scale/Scope**: Same single-owner scale as the rest of the app; no scale-sensitive change (a rename/reorder is a single-row update regardless of library size).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality Standards**: All new code (`updateAlbum` in `db.js`, the card click/keydown delegation, the `dnd.js` one-line fix, the CSS additions) follows the exact patterns already established in the same files (e.g., `updateAlbum` mirrors `updateAlbumOrder`'s validate-then-`throwClassified`-then-update shape). **Pass.**
- **Comprehensive Testing**: Every user story maps to specific extensions of existing test files (listed in Technical Context → Testing); the 80% coverage threshold (`vite.config.js`) is maintained by testing the new/changed branches directly. **Pass.**
- **Performance Requirements**: SC-004 gives a concrete, measurable target already met by the existing single-row-update pattern used elsewhere in `db.js`; no new performance risk introduced. **Pass.**
- **User Experience Consistency**: This feature's entire purpose is restoring/improving consistency — reusing the existing modal (`openDialog`) and design-token system rather than introducing new patterns. **Pass.**
- **Simplicity and Maintainability**: Every design decision below (see research.md) picked the smallest-diff option: reuse the existing dialog component instead of building a new one, wire in the already-written and already-tested `calculateNewPosition` instead of writing new reorder math, and extend the existing `components.css` instead of adding a new stylesheet. **Pass.**

No violations requiring justification — Complexity Tracking table is not needed.

**Post-Phase 1 re-check**: data-model.md adds no new entities or columns (title already exists on `albums`); contracts/album-actions.md's `updateAlbum` matches `updateAlbumOrder`'s existing validation/error-shape conventions exactly (Code Quality, UX Consistency); quickstart.md's validation steps map 1:1 to spec.md's Independent Tests (Testing gate satisfied). All gates still **Pass** after design.

## Project Structure

### Documentation (this feature)

```text
specs/005-album-ux-fixes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── album-actions.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Single project (existing structure, unchanged shape)
src/
├── modules/
│   ├── db.js               # + updateAlbum(albumId, { title }); no other export's shape changes
│   ├── album.js             # createAlbumIfNeeded: exposes whether a same-date album already existed
│   └── dnd.js                # drop handler now calls the existing calculateNewPosition() helper
├── ui/
│   ├── album-grid.js         # card click/keydown delegate to "view" unless target is an action button; + Edit action
│   ├── album-view.js         # + Edit action in the album header
│   ├── create-album-dialog.js  # generalized to also support "rename" (pre-filled value, different labels)
│   └── auth-view.js          # unchanged JS — only needs matching CSS
├── app.js                    # handleCreateAlbum branches on "album already exists" instead of silently proceeding
└── styles/
    └── components.css        # + .auth-view/.auth-card/.auth-label/.auth-input/.auth-error/.auth-submit rules

tests/
├── unit/          # extends db.test.js, album-module.test.js, dnd.test.js, create-album-dialog.test.js, auth-view.test.js
└── integration/   # extends album-redesign.test.js, album-reorder.test.js, create-album-flow.test.js
```

**Structure Decision**: Keep the existing single-project layout. This feature only touches files that already exist (plus test extensions); it adds exactly one new data-access export and no new modules, top-level directories, or dependencies, per the Simplicity gate above.

## Complexity Tracking

*No Constitution Check violations — table not needed.*
