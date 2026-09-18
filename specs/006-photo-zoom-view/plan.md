# Implementation Plan: Full-Resolution Photo Viewer

**Branch**: `006-photo-zoom-view` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-photo-zoom-view/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a full-resolution photo viewer: clicking/tapping (or keyboard-activating) any photo thumbnail on Home, My Photos, Favorites, or an open album opens an overlay showing the original uploaded image, dismissible via a close control, outside click, or Escape. No schema change is needed — every photo row already carries `storage_path` (the original file's Storage object path); the app just never resolves it to a displayable URL today (`db.js`'s `toPhoto()` only ever resolves `thumbnail_storage_path`). This plan adds one on-demand URL resolver, one small new UI module that reuses the existing `openDialog` overlay primitive, and wires a click/keyboard "open" affordance into the one function that already centralizes photo-card interactivity across all four screens (`attachPhotoGalleryEvents`).

## Technical Context

**Language/Version**: JavaScript (ES modules), browser runtime, built with Vite 4 — unchanged.

**Primary Dependencies**: None added. Reuses the existing Supabase Storage signed-URL helper (`src/modules/photo-url.js`'s `resolvePhotoUrl`, already used for thumbnails) and the existing overlay primitive (`src/ui/dialog.js`'s `openDialog`, already used by every other dialog in the app).

**Storage**: No schema change. `photos.storage_path` (the original image's Storage object path, set at upload time per `specs/004-supabase-data-migration/contracts/schema.sql`) already exists on every photo row returned by `db.js` — it is simply never resolved to a signed URL today. This feature adds that resolution, on demand, not a new column.

**Testing**: Vitest (existing suite) — extends `tests/unit/db.test.js`, `tests/unit/photo-gallery.test.js`, `tests/unit/dialog.test.js`, and adds `tests/unit/photo-viewer.test.js` plus an integration test covering the open/close flow from at least one gallery context and the album-detail context.

**Target Platform**: Client-only single-page web app — unchanged.

**Project Type**: Single frontend project (Option 1) — unchanged.

**Performance Goals**: SC-002 ("close and return to prior scroll position in under 1s") is met by construction — the viewer is a pure overlay on top of the existing gallery DOM, so closing it never re-fetches or re-renders the underlying list. The original image's own load time depends on file size/connection and is covered by FR-004's loading state, not a hard latency target.

**Constraints**: The full-resolution URL MUST be resolved on demand (only when a user opens the viewer for a specific photo), not eagerly for every photo in a list response — `getPhotos`/`getAllPhotos` already resolve one signed URL per photo (the thumbnail) for every gallery/album load; eagerly resolving a second signed URL per photo for images most users will never open at full size would double that cost for no benefit. Every existing `db.js` export keeps its current shape (Constitution: UX Consistency, Simplicity) — this feature adds one new export rather than changing any existing signature.

**Scale/Scope**: Same single-owner library scale as the rest of the app; a viewer open/close is a single-photo operation regardless of library size.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality Standards**: The new `db.js` URL resolver mirrors the exact validate-free, `throwClassified`-on-error shape already used for `thumbnail_url` resolution in the same file. The new `photo-viewer.js` module follows the same "build content, call `openDialog`, wire close" structure already used by `create-album-dialog.js`/`confirm-dialog.js`. **Pass.**
- **Comprehensive Testing**: Every touched file has a corresponding test extension/addition (listed in Technical Context → Testing); the 80% coverage threshold (`vite.config.js`) is maintained by testing the new resolver, the new viewer's loading/success/error states, and the new click/keyboard wiring directly. **Pass.**
- **Performance Requirements**: The on-demand (not eager) resolution design in Constraints above explicitly avoids the doubled-Storage-call regression a naive implementation would introduce; SC-002 is met by the overlay-not-navigation design. **Pass.**
- **User Experience Consistency**: Reuses `openDialog`'s existing Escape/backdrop-click/close-button/focus-trap behavior (already used everywhere else in the app) and extends the exact full-card-click-plus-keyboard pattern established for album cards in `specs/005-album-ux-fixes` — this feature follows established conventions rather than inventing new ones. **Pass.**
- **Simplicity and Maintainability**: No new dependency. `openDialog` gains one optional, backward-compatible parameter rather than a second overlay implementation; the "open on click" behavior is wired once (in `attachPhotoGalleryEvents`, already shared by all four screens) rather than duplicated per screen. **Pass.**

No violations requiring justification — Complexity Tracking table is not needed.

**Post-Phase 1 re-check**: data-model.md confirms zero schema/entity changes (the full-resolution URL is a runtime-only field, exactly like `thumbnail_url` already is); contracts/photo-viewer.md's new `db.js` export matches the existing error-code contract from `specs/004-supabase-data-migration/contracts/data-access.md` exactly (Code Quality, UX Consistency); quickstart.md's validation steps map 1:1 to spec.md's Independent Tests (Testing gate satisfied). All gates still **Pass** after design.

## Project Structure

### Documentation (this feature)

```text
specs/006-photo-zoom-view/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── photo-viewer.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Single project (existing structure, unchanged shape)
src/
├── modules/
│   └── db.js                 # + on-demand original-image URL resolver; no existing export's shape changes
├── ui/
│   ├── dialog.js              # openDialog() gains an optional `className` param (backward compatible)
│   ├── photo-viewer.js        # NEW: loading/success/error states, built on openDialog
│   ├── photo-card.js          # card gains tabindex="0" + aria-label (mirrors album-card; CSS for
│   │                           #   .photo-card:focus-visible already exists but is currently unreachable)
│   └── photo-gallery.js       # attachPhotoGalleryEvents gains an onOpenPhoto callback + keydown handling,
│                               #   shared by Home/My Photos/Favorites/Album-detail (all four already flow
│                               #   through this one function)
├── app.js                     # wires the new onOpenPhoto callback at all four render call sites
└── styles/
    └── components.css         # + .photo-card { cursor: pointer }, + viewer sizing/loading/error styles

tests/
├── unit/          # extends db.test.js, photo-gallery.test.js, dialog.test.js; adds photo-viewer.test.js
└── integration/   # extends or adds a photo-viewer open/close flow test across gallery + album-detail
```

**Structure Decision**: Keep the existing single-project layout. This feature adds exactly one new UI module and one new data-access export; every other touched file already exists and keeps its current public shape apart from the additive, backward-compatible parameters noted above.

## Complexity Tracking

*No Constitution Check violations — table not needed.*
