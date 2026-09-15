# Research: Photo Organizer Technical Decisions

**Date**: 2026-09-14

**Purpose**: Document technical research and decisions for implementation approach

## 1. Database: SQLite for Local Storage

**Decision**: Use SQLite (via sql.js or Tauri) for local photo metadata and album management

**Rationale**:
- User requirement: "metadata is stored in a local SQLite database"
- SQLite is lightweight, zero-configuration, and proven for desktop/client-side use
- Supports complex queries and relationships (albums, photos, sort orders)
- Excellent performance for 100-500 photos per user

**Alternatives Considered**:
- IndexedDB: Simpler but less queryable, harder to maintain complex relationships
- LocalStorage: Limited to ~5-10MB, unsuitable for metadata + large binary blobs
- JSON files: Manual serialization, no query language, poor performance

**Implementation Approach**:
- Use `sql.js` (SQLite compiled to WebAssembly) for pure browser solution
- OR use Tauri bindings if targeting desktop variant (can be added post-MVP)
- Database schema: Albums table, Photos table, AlbumOrder table (for custom sort)
- Persist to IndexedDB or browser cache (sql.js does this automatically)

**Dependencies**: sql.js (~500KB gzipped) OR Tauri core library

---

## 2. Photo Storage: Base64 or Blob URLs

**Decision**: Store photos as base64-encoded strings in SQLite or use Blob URLs in browser

**Rationale**:
- User requirement: "Images are not uploaded anywhere"
- Base64 avoids separate file handling complexity
- Browser Blob URLs offer memory efficiency for large collections
- Both support thumbnail generation (canvas-based resize)

**Alternatives Considered**:
- File System Access API: Modern but limited browser support, requires permissions
- Service Workers + Cache API: Adds complexity, trade-off benefits marginal
- Separate indexed photo directory: Requires backend or Tauri, out of scope

**Implementation Approach**:
- Accept image files as input (drag-drop or file picker)
- Convert to base64 or store as Blob with object URL
- Generate thumbnail via Canvas API (resize to 150x150px for grid display)
- Store original + thumbnail metadata in SQLite
- Lazy-load full resolution only on album view

**Dependencies**: None (native browser APIs)

---

## 3. Photo Metadata: EXIF Extraction

**Decision**: Extract photo date from EXIF metadata; fall back to upload date if unavailable

**Rationale**:
- User requirement: Albums grouped by date (from photo metadata)
- Most cameras/phones embed EXIF DateTimeOriginal
- Fallback ensures no data loss for metadata-less images (screenshots, scans)

**Alternatives Considered**:
- Ignore metadata, prompt user for album date: Adds friction, poor UX
- Metadata library (piexifjs): Adds ~15KB, worth it for EXIF parsing

**Implementation Approach**:
- Use `piexifjs` library to extract EXIF data
- Parse DateTimeOriginal field (format: "2026:09:14 10:30:45")
- Extract date component, group albums by YYYY-MM-DD
- Fall back to file.lastModified (browser-captured upload date)
- Store both dates in Photo record for auditability

**Dependencies**: piexifjs (~15KB)

---

## 4. Testing Framework: Vitest

**Decision**: Use Vitest for unit and integration tests, targeting >80% coverage

**Rationale**:
- Vitest integrates seamlessly with Vite (same config, fast HMR)
- Native ESM support, no transpilation overhead
- Jest-compatible API, familiar to most teams
- Excellent snapshot testing for UI state
- Constitution requirement: >80% test coverage mandatory

**Alternatives Considered**:
- Jest: Works but slower, requires babel transpilation, not Vite-native
- Mocha + Chai: Lower-level, more boilerplate for async tests
- Playwright: Overkill for unit tests, better for E2E

**Implementation Approach**:
- Vitest config in vite.config.js
- Unit tests for all modules (db.js, album.js, photo.js, exif.js, dnd.js)
- Integration tests for workflows: upload → album grouping → drag-drop → persist
- Mock IndexedDB/sql.js for tests (vitest supports this natively)
- CI/CD gate: Test coverage <80% blocks merge
- E2E tests: Manual browser testing during development, automated via Playwright post-MVP

**Dependencies**: vitest, @vitest/ui (optional dashboard)

---

## 5. Drag-and-Drop Implementation

**Decision**: Vanilla JavaScript Drag API (no library) with custom visual feedback

**Rationale**:
- User requirement: "drag and drop on the main page" for album reordering
- Native browser Drag API fully sufficient for this use case
- No need for specialized library (react-beautiful-dnd is React-specific anyway)
- Simpler, fewer dependencies, full control over UX

**Alternatives Considered**:
- SortableJS: Feature-rich but adds dependency, unnecessary overhead
- Hand-rolled mouse move tracking: More brittle, doesn't use native events
- Grid CSS reordering: Not reorderable, CSS-only solution insufficient

**Implementation Approach**:
- Use dragstart, dragover, drop, dragend events on album cards
- Visual feedback: opacity change, ghost image during drag
- Drop target validation: ensure drop zone is valid
- Persist new order to SQLite on successful drop
- Keyboard support: Tab to focus album, use arrow keys to move (post-MVP enhancement)

**Dependencies**: None (native API)

---

## 6. Build & Dependency Management

**Decision**: Vite with minimal dependencies (vanilla stack)

**Rationale**:
- User requirement: "Vite with minimal number of libraries, vanilla HTML/CSS/JavaScript"
- Vite is fast, modern, zero-config for simple projects
- Vanilla JS reduces bundle size, improves performance, simplifies debugging

**Approved Production Dependencies**:
- vite: Build tool
- sql.js: SQLite in browser (~500KB)
- piexifjs: EXIF parsing (~15KB)
- Everything else is native browser API

**Dev Dependencies**:
- vitest: Testing
- @vitest/ui: Test dashboard
- eslint, prettier: Code quality

**Build Output**: Single HTML file with inline CSS/JS (or two separate files). Gzip should yield <500KB total (html + css + js + sql.js).

**Dependencies**: Minimal (3 npm packages + dev tools)

---

## 7. Browser Compatibility & Performance

**Decision**: Target modern browsers (last 2 years). Measure performance against <2s load time.

**Rationale**:
- Chrome, Firefox, Safari, Edge all support needed APIs
- Older IE/Safari versions would require polyfills, not worth complexity
- Constitution requirement: Performance targets measured, not assumed

**Performance Targets**:
- Main page load: <2s (including DB initialization, album query)
- Drag-and-drop: <16ms per frame (60fps)
- Tile grid: Responsive at 768px+
- Photo upload: <30s for typical file sizes

**Implementation**:
- Lighthouse audits in CI/CD
- Benchmarking scripts for critical paths
- Bundle size monitoring (SolidJS benchmark: ~15KB core, sql.js adds ~500KB)
- Lazy-load photo thumbnails as album becomes visible (IntersectionObserver)

**Dependencies**: None (native performance APIs)

---

## 8. Accessibility (WCAG 2.1 AA)

**Decision**: Build accessibility into templates and components from the start

**Rationale**:
- Constitution requirement: "User Experience Consistency" including accessibility standards
- Vanilla HTML is more accessible by default than framework wrappers
- Minimal overhead, major UX improvement for users with disabilities

**Implementation**:
- Semantic HTML: <button>, <img alt>, <form>, <label>
- Keyboard navigation: Tab order, focus management, arrow keys for drag-drop (post-MVP)
- ARIA labels where needed: drag-drop status, album counts, loading states
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Testing: axe-core accessibility audit in CI (post-MVP)

**Dependencies**: None (built into HTML/CSS patterns)

---

## Decisions Summary

| Area | Decision | Rationale | Dependencies |
|------|----------|-----------|--------------|
| Database | SQLite (sql.js) | Complex queries, small footprint, user-specified | sql.js |
| Photo Storage | Base64 + Blob URLs | No backend, local persistence | None |
| Metadata | EXIF extraction + fallback | Photo date grouping, automatic | piexifjs |
| Testing | Vitest, >80% coverage | Vite-native, fast, Constitution mandated | vitest |
| Drag-Drop | Native Drag API | Sufficient, minimal complexity | None |
| Build | Vite + vanilla | User-specified, small bundle | vite |
| Browser Support | Modern only (last 2 years) | No polyfill complexity, sufficient market | None |
| Accessibility | WCAG 2.1 AA, semantic HTML | Constitution requirement, native HTML | None |

---

## Next Steps (Phase 1)

- [ ] Finalize database schema (data-model.md)
- [ ] Define API contracts for modules (contracts/)
- [ ] Create quickstart validation guide (quickstart.md)
- [ ] Set up Vite + Vitest project scaffold
- [ ] Begin implementation tasks (/speckit-tasks)
