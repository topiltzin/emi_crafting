# Implementation Plan: Gallery UX Reliability & Polish Fixes

**Branch**: `003-ux-fixes-polish` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ux-fixes-polish/spec.md`

## Summary

Six UX findings from a Chrome walkthrough of the running app, verified against the source: one genuine silent-failure bug (the "Add Photos" button looks active but is a dead click with zero files selected), two native-browser-dialog inconsistencies (`Create Album` uses `window.prompt()`; delete actions already require confirmation, but via `window.confirm()` rather than an in-app dialog — corrected mid-research after an initial, wrong assumption that no delete confirmation existed at all), one accessibility gap shared by every dialog (no Escape-to-close, no visible close control), and two polish items (emoji nav icons, no in-app light/dark toggle). The technical approach introduces one small reusable dialog primitive (`ui/dialog.js`) that gives every modal — the existing Add Photos modal and two new ones — Escape handling and a close control for free, then builds the two replacement flows (in-app confirm-dialog replacing `window.confirm()`, in-app create-album dialog replacing `window.prompt()`) and the file-type-rejected feedback on top of it, fixes a CSS specificity bug that was defeating the upload confirm button's intended disabled state, swaps five emoji for inline SVGs, and adds a small `localStorage`-backed theme module wired into Settings. No database schema changes and no new dependencies.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18+ for tooling

**Primary Dependencies**: None added. Existing: Vite 4 (build), sql.js (SQLite-in-browser persistence, unrelated to this feature), piexifjs (EXIF, unrelated)

**Storage**: Existing SQLite-via-sql.js database (`src/modules/db.js`) is unchanged — this feature adds no persisted columns or tables. The one new piece of state (the user's light/dark/match-device choice) is a device-local UI preference, not gallery data, so it lives in `localStorage`, not the SQLite DB.

**Testing**: Vitest + jsdom + fake-indexeddb (existing `tests/unit/`, `tests/integration/`)

**Target Platform**: Browser (desktop + mobile web), local-first single-page app, no backend/server

**Project Type**: Single-project web application (client-only, Vite-bundled)

**Performance Goals**: No new performance target. Dialogs must open/close with no perceptible delay, consistent with the existing modal's current feel — trivial DOM toggling and `localStorage` reads/writes, no measurable regression risk.

**Constraints**: No new runtime dependencies (icons are inline SVG, not an icon-font/library; theming is CSS custom properties + a `data-theme` attribute, not a state-management library). All existing tests for unchanged behavior (`tests/unit/db.test.js`, `tests/unit/models.test.js`, etc.) MUST continue to pass unmodified.

**Scale/Scope**: 6 user stories from spec.md. Touches 5 existing UI modules (`app.js`, `upload-zone.js`, `nav.js`, `settings-view.js`, `components.css`) and adds 4 small new modules (`ui/dialog.js`, `ui/confirm-dialog.js`, `ui/create-album-dialog.js`, `modules/theme.js`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Code Quality Standards | **PASS.** Follows the codebase's existing `render*()`/`attach*Events()` pairing (see `contracts/ui-modules-contract.md`); no new lint/format exceptions; ESLint + Prettier already configured and unaffected. |
| II. Comprehensive Testing | **PASS (with plan).** Every new module (`dialog.js`, `confirm-dialog.js`, `create-album-dialog.js`, `theme.js`) gets a unit test; every changed module (`upload-zone.js`, `nav.js`, `settings-view.js`, `app.js`'s delete/create handlers) gets updated cases in its existing test file. `npm run coverage` gate applies before merge like any other change. |
| III. Performance Requirements | **PASS / N/A.** No performance-sensitive code path is touched; only trivial DOM and `localStorage` operations are added, with no new dependency weight. |
| IV. User Experience Consistency | **PASS — this is the point of the feature.** It exists specifically to fix UX-consistency violations a review surfaced: a native OS dialog breaking the app's visual identity, a primary CTA that silently does nothing, and inconsistent modal-dismissal behavior. The new `ui/dialog.js` primitive is what makes "consistent" enforceable going forward instead of three separately-coded modals drifting apart. |
| V. Simplicity and Maintainability | **PASS.** One shared dialog helper reused three ways beats three bespoke modal implementations. Icons are inline SVG (no icon library). Theme state is plain `localStorage` + a CSS attribute selector, mirroring the pattern the codebase already uses for `prefers-color-scheme` — no new abstraction layer, no state-management dependency. |

All gates pass. No entries required in Complexity Tracking.

**Post-Phase-1 re-check**: Design artifacts (`research.md`, `data-model.md`, `contracts/`) confirm no schema changes, no new dependencies, and — per `research.md` item 6 — that the theme work turned out to be *smaller* than initially scoped (half the CSS mechanism already existed and only needed a JS module to drive it). The mid-research correction to User Story 1 (native `confirm()` already existed; this is a like-for-like dialog replacement, not new safety-net logic) also reduces net-new logic versus the original plan. Gates re-evaluated against the actual design: all still PASS, nothing escalated.

## Project Structure

### Documentation (this feature)

```text
specs/003-ux-fixes-polish/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ui-modules-contract.md
│   └── theme-module-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app.js                        # CHANGED: handleCreateAlbum() calls the new
│                                  #   create-album-dialog instead of window.prompt();
│                                  #   openUploadModal() refactored onto ui/dialog.js.
│                                  #   handleDeletePhoto/handleDeleteAlbum themselves are
│                                  #   UNCHANGED — the confirm() call they're gated behind
│                                  #   lives one layer up, in the UI modules below
├── models/
│   ├── Album.js                  # unchanged
│   └── Photo.js                  # unchanged
├── modules/
│   ├── album.js                  # unchanged
│   ├── db.js                     # unchanged — deletePhoto/deleteAlbum already soft-delete
│   │                              #   and getAlbum() already returns photo_count, so the
│   │                              #   confirm dialog needs no new query
│   ├── dnd.js                    # unchanged
│   ├── exif.js                   # unchanged
│   ├── photo.js                  # unchanged
│   ├── storage.js                # unchanged
│   └── theme.js                  # NEW: get/set/apply light|dark|system appearance preference
├── ui/
│   ├── album-grid.js              # CHANGED: Delete click now opens confirm-dialog first
│   ├── album-view.js              # CHANGED: same, for the single-photo delete control
│   ├── confirm-dialog.js         # NEW: generic destructive-action confirmation, built on dialog.js
│   ├── create-album-dialog.js    # NEW: in-app album-name entry, built on dialog.js
│   ├── dialog.js                 # NEW: shared modal shell — Escape-to-close, visible close
│   │                              #   control, focus handling; existing Add Photos modal in
│   │                              #   app.js is refactored to use it instead of its own backdrop/
│   │                              #   modal markup
│   ├── empty-state.js            # unchanged
│   ├── file-upload.js            # unchanged
│   ├── hero.js                   # unchanged
│   ├── nav.js                    # CHANGED: SECTIONS icons become inline SVG, not emoji
│   ├── photo-card.js             # unchanged
│   ├── photo-gallery.js          # CHANGED: same delete-confirmation wiring as album-grid.js
│   ├── settings-view.js          # CHANGED: new "Appearance" card with light/dark/system control
│   └── upload-zone.js            # CHANGED: renderPendingList() runs once at init so the confirm
│                                  #   button starts correctly disabled; addFiles() reports
│                                  #   non-image files it filtered out instead of dropping them
│                                  #   silently
└── styles/
    ├── components.css            # CHANGED: .upload-zone-actions / .upload-pending-list scoped
    │                              #   to :not([hidden]) so the `hidden` attribute isn't defeated;
    │                              #   new .dialog-close-btn and .settings-appearance-toggle rules
    └── main.css                  # CHANGED: dark palette also gated by [data-theme="dark"], not
                                   #   only prefers-color-scheme

tests/
├── unit/
│   ├── dialog.test.js            # NEW
│   ├── confirm-dialog.test.js    # NEW
│   ├── create-album-dialog.test.js # NEW
│   ├── theme.test.js             # NEW
│   ├── upload-zone.test.js       # CHANGED: initial-disabled-state + rejected-file cases added
│   ├── nav.test.js               # CHANGED: icon markup assertions updated (SVG, not emoji text)
│   └── settings-view.test.js     # CHANGED: appearance control cases added
└── integration/
    ├── delete-confirmation-flow.test.js  # NEW: photo + album delete require confirm, cancel is a no-op
    ├── create-album-flow.test.js         # NEW: no window.prompt, blank-name rejected
    └── app.test.js                       # CHANGED: Escape-closes-dialog case added
```

**Structure Decision**: Single-project client-only web app (existing layout under `src/` and `tests/`, no backend/frontend split — this is the same structure the `002-emis-crafthouse-redesign` feature used). All new files are small, single-purpose UI/module additions following the codebase's existing `render*()` / `attach*Events()` convention documented in `contracts/ui-modules-contract.md`; no new top-level directories.

## Complexity Tracking

*No entries — Constitution Check passed without exceptions.*
