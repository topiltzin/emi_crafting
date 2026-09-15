# Implementation Plan: Emi's Craft House - Playful Kids Photo Gallery Redesign

**Branch**: `002-emis-crafthouse-redesign` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-emis-crafthouse-redesign/spec.md`

## Summary

Rebrand the existing local, client-only photo-organizer app (currently "Photo Organizer") to **"Emi's Craft House"** and redesign its UI into a playful, pink/purple/lavender kids-and-families aesthetic, while preserving 100% of existing behavior: sql.js-backed storage, EXIF-based date extraction, album creation/reordering/deletion, and photo upload/deletion. The redesign adds a top navigation bar (Home, My Photos, Albums, Favorites, Settings), a compact hero, restyled album/photo cards, a new drag-and-drop upload zone with pending-photo previews, and a new persisted **favorite** flag on photos surfaced through a new flat, date-grouped "My Photos"/"Favorites" gallery view. The technical approach extends the existing vanilla-JS module structure (no new frameworks), adds a backward-compatible schema migration for the favorite column, and retints the existing CSS custom-property design-token system rather than replacing it.

## Technical Context

**Language/Version**: JavaScript (ES2021+, native ES modules), built with Vite 4

**Primary Dependencies**: sql.js 1.8 (client-side SQLite via WASM), piexifjs 1.0 (EXIF parsing); vanilla DOM rendering, no UI framework (React/Vue/etc. intentionally not introduced, per spec constraint)

**Storage**: sql.js in-memory database, persisted as a binary snapshot to the browser's IndexedDB (`PhotoOrganizerDB` store) on every mutation via `persistDB()`

**Testing**: Vitest (unit + integration) with jsdom environment; coverage thresholds already enforced at 80% lines/functions/branches/statements (`vite.config.js`)

**Target Platform**: Modern evergreen browsers (Chrome/Edge/Firefox/Safari), desktop/tablet/mobile viewports; client-only static build, no server/backend

**Project Type**: Single-page web application, single project (existing `src/` + `tests/` layout — no frontend/backend split)

**Performance Goals**: Interactions (hover, card open, nav switch, favorite toggle) feel instant (<100ms perceived latency); scrolling and hover animations hold 60fps on mid-range mobile hardware; gallery queries stay paginated (existing `limit`/`offset` pattern) so rendering hundreds of photos does not block the main thread

**Constraints**: No horizontal overflow from 320px to 2560px viewport widths; all animation MUST be skippable via `prefers-reduced-motion`; existing IndexedDB-stored databases (already-created by users on the current version) MUST load and gain the new `is_favorite` column without data loss or a "fresh install" reset; no new backend/network dependency is introduced

**Scale/Scope**: Single local user's personal photo library (client-side only), realistically tens to low hundreds of photos across dozens of date-based albums; 5 primary UI sections (Home, My Photos, Albums, Favorites, Settings)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality Standards** — PASS. Work extends the existing module boundaries (`modules/`, `ui/`, `models/`) and existing ESLint/Prettier configuration; no new patterns or architecture styles introduced. `npm run lint` and `npm run format` gate the changes as they already do today.
- **II. Comprehensive Testing** — PASS (planned). New behavior (schema migration, `is_favorite` toggle/persistence, the cross-album "My Photos"/"Favorites" query, date-bucketing helper) gets new unit tests in `tests/unit/`, and a new `tests/integration/favorites-flow.test.js` exercises the end-to-end favorite → reload → still-favorited flow, alongside re-running all existing suites to confirm zero regressions. The existing 80% coverage gate must still pass.
- **III. Performance Requirements** — PASS. No new performance targets beyond what's already implicit (smooth UI, paginated queries); the plan explicitly keeps the existing `limit`/`offset` pagination pattern for the new flat gallery query rather than loading unbounded result sets.
- **IV. User Experience Consistency** — PASS. This feature *is* the UX-consistency effort: a single retinted design-token system (CSS custom properties) drives all views, so cards, buttons, badges, and animations share one visual language across Home/My Photos/Albums/Favorites/Settings.
- **V. Simplicity and Maintainability** — PASS. No new frameworks, state-management libraries, or animation libraries; new UI is built as small vanilla-JS render/attach module pairs matching the existing `album-grid.js` / `album-view.js` convention. Settings is deliberately minimal (info + reused existing data already queried) rather than a speculative new subsystem.

No violations identified. Complexity Tracking table is not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/002-emis-crafthouse-redesign/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── db-module-contract.md
│   └── ui-views-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
index.html                        # updated <title> + meta description → "Emi's Craft House"

src/
├── main.js                       # existing entry point (unchanged)
├── app.js                        # existing view router; extended to route Home/My Photos/Albums/Favorites/Settings
├── modules/
│   ├── db.js                     # existing; add is_favorite migration, getAllPhotos(), getFavoritePhotos(), toggleFavorite()
│   ├── album.js                  # existing (unchanged)
│   ├── photo.js                  # existing upload pipeline (unchanged); consumed by new upload UI as-is
│   ├── exif.js                   # existing (unchanged)
│   ├── storage.js                # existing (unchanged)
│   └── dnd.js                    # existing album-reorder drag/drop (unchanged); new file-drop zone uses its own small handler in ui/upload-zone.js
├── ui/
│   ├── nav.js                    # NEW: top nav bar + mobile menu + active-section pill highlight
│   ├── hero.js                   # NEW: compact hero section (title, tagline, primary/secondary CTAs)
│   ├── album-grid.js             # existing; restyled cards + cover-image thumbnail support
│   ├── album-view.js             # existing; restyled, reuses new shared photo-card renderer
│   ├── photo-card.js             # NEW: shared photo card (thumbnail, date badge, album label, favorite heart, selection checkbox) used by album view, My Photos, Favorites
│   ├── photo-gallery.js          # NEW: flat, date-grouped photo grid (used by "My Photos" and "Favorites" views)
│   ├── upload-zone.js            # NEW: drag-and-drop upload area + pending-thumbnail preview + per-item removal; delegates actual upload to modules/photo.js::uploadPhotos (unchanged)
│   ├── file-upload.js            # existing file-picker dialog (unchanged); reused as the "choose from device" fallback inside upload-zone.js
│   ├── settings-view.js          # NEW: minimal settings page (app info + storage stats reused from existing queries)
│   └── empty-state.js            # NEW: shared empty-state component (icon, heading, message, CTA button)
├── models/
│   ├── Album.js                  # existing (unchanged)
│   └── Photo.js                  # existing; add is_favorite to constructor/toJSON
└── styles/
    ├── main.css                  # existing token file; retint palette, add typography + reduced-motion tokens
    ├── layout.css                 # existing; add hero/nav/mobile-menu/responsive-grid rules
    └── components.css             # existing; add card/button/badge/heart-animation/empty-state styles

tests/
├── unit/
│   ├── db.test.js                # existing; extend with migration + favorite + getAllPhotos coverage
│   ├── exif.test.js              # existing (unchanged)
│   └── dnd.test.js               # existing (unchanged)
└── integration/
    ├── album-reorder.test.js     # existing (unchanged; must still pass)
    ├── album-upload-view.test.js # existing (unchanged; must still pass)
    ├── exif-grouping.test.js     # existing (unchanged; must still pass)
    └── favorites-flow.test.js    # NEW: favorite toggle → Favorites view → reload persistence
```

**Structure Decision**: Single-project structure (Option 1) is retained — this is a client-only Vite app with no backend to split out. All new work lives inside the existing `src/modules/`, `src/ui/`, `src/models/`, and `src/styles/` directories, following the established render-function/attach-events-function pairing already used by `album-grid.js`/`album-view.js`, so the redesign reads as an extension of the current codebase rather than a parallel system.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 (research.md, data-model.md, contracts/, quickstart.md) were produced.*

The design confirms the Phase-0 gate results still hold: the only schema change is one additive, defaulted column (`is_favorite`) with an idempotent migration (no data risk → Testing/Quality gates still PASS); the only new query patterns are single-query, paginated, join-based reads consistent with the existing `getAlbums()` style (Performance gate still PASS); all new UI modules follow the existing `render*`/`attach*Events` pairing with no new frameworks or libraries (Simplicity gate still PASS); and every view shares one retinted token system (UX Consistency gate still PASS). No new violations were introduced during design.

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
