# Implementation Plan: Photo Organizer

**Branch**: `001-photo-organizer` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-photo-organizer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build a local photo organizer web application using Vite with vanilla HTML/CSS/JavaScript that automatically groups photos into date-based albums, displays them in a responsive tile grid, and supports drag-and-drop album reordering. All photos and metadata are stored locally in SQLite database with no external cloud dependencies. Prioritize simplicity, performance (<2s main page load), and comprehensive test coverage (>80%).

## Technical Context

**Language/Version**: JavaScript (ES2020+), HTML5, CSS3

**Primary Dependencies**: Vite 4.x+ (build tool). Minimal additional libraries - vanilla JavaScript only. SQLite for local database (via sql.js for browser or Tauri bindings for desktop if needed).

**Storage**: Local SQLite database. Photos stored as binary blobs or base64 in IndexedDB/SQLite. No cloud synchronization.

**Testing**: Vitest for unit/integration tests (integrates with Vite), manual E2E testing via browser DevTools

**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge from last 2 years)

**Project Type**: Single-page web application (SPA)

**Performance Goals**: Main page loads in <2 seconds with 20+ albums and 100+ photos. Drag-and-drop interactions <16ms (60fps). Tile grid renders responsively on 768px+ screens.

**Constraints**: Offline-capable, no external network dependencies. All data persists locally. Memory footprint optimized for handling 100+ photos without lag.

**Scale/Scope**: Personal photo organizer for handcraft work. Estimated 100-500 photos per user. Single user per browser instance.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principles from Constitution** (My Project v1.0.0):

- ✅ **Code Quality Standards**: Vanilla JS + Vite encourages clean code patterns. Linting (ESLint) and formatting (Prettier) required in build pipeline.
- ✅ **Comprehensive Testing**: Vitest configured for unit/integration tests. Target >80% coverage for business logic (album grouping, drag-drop logic, CRUD operations). E2E tests via browser automation.
- ✅ **Performance Requirements**: <2s page load and 60fps interactions are measurable. SQLite queries optimized. Lazy-load tiles and thumbnails as needed.
- ✅ **User Experience Consistency**: Tile layout and drag-drop patterns are standard web conventions. Accessibility (WCAG 2.1 AA) built in from start.
- ✅ **Simplicity and Maintainability**: Vanilla JS + Vite avoids framework overhead. No unnecessary abstractions. Flat project structure, clear naming, minimal dependencies.

**Gate Status**: ✅ PASS - No violations. All principles supported by tech stack choice.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
photo-organizer/
├── index.html                 # Entry point
├── vite.config.js
├── package.json
├── .eslintrc.cjs
├── .prettierrc
│
├── src/
│   ├── main.js               # App initialization
│   ├── app.js                # Main app controller
│   ├── styles/
│   │   ├── main.css          # Global styles
│   │   ├── layout.css        # Grid/layout utilities
│   │   └── components.css    # Component styles (tiles, albums, drag-drop)
│   │
│   ├── modules/
│   │   ├── db.js             # SQLite database initialization & queries
│   │   ├── storage.js        # Photo file storage/retrieval
│   │   ├── album.js          # Album CRUD operations
│   │   ├── photo.js          # Photo CRUD operations
│   │   ├── exif.js           # Photo metadata extraction
│   │   └── dnd.js            # Drag-and-drop logic
│   │
│   └── ui/
│       ├── album-grid.js     # Main page album display
│       ├── album-view.js     # Individual album viewer with tiles
│       ├── photo-tile.js     # Photo tile component
│       ├── nav.js            # Navigation/header
│       └── modals.js         # Upload & confirmation dialogs
│
├── tests/
│   ├── unit/
│   │   ├── album.test.js
│   │   ├── photo.test.js
│   │   ├── exif.test.js
│   │   └── dnd.test.js
│   │
│   └── integration/
│       ├── album-workflow.test.js
│       └── photo-upload.test.js
│
└── public/
    └── assets/               # Icons, placeholder images
```

**Structure Decision**: Single web application with Vite. No backend/frontend separation—pure client-side with local SQLite. Modular JS structure with clear separation between data (modules/), UI (ui/), and styles. Tests colocated with source but in dedicated tests/ directory. Minimal dependencies keep bundle size small.

