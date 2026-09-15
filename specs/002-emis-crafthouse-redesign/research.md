# Phase 0 Research: Emi's Craft House Redesign

All items below were "NEEDS CLARIFICATION"-shaped technical unknowns identified while reading the existing codebase (`src/modules/db.js`, `src/modules/album.js`, `src/ui/album-grid.js`, `src/ui/album-view.js`, `src/ui/file-upload.js`, `src/modules/dnd.js`). Each is resolved below with a decision, rationale, and alternatives considered, so Phase 1 design has no open questions.

## 1. Schema migration for the new `is_favorite` column

**Decision**: On `initDB()`, after loading an existing stored database from IndexedDB, run `PRAGMA table_info(Photos)`, check whether a column named `is_favorite` is present, and if not, run `ALTER TABLE Photos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0` followed by `persistDB()`. For a brand-new database, `createSchema()` simply includes `is_favorite INTEGER NOT NULL DEFAULT 0` directly in the `CREATE TABLE Photos` statement, so the migration path only ever runs once per pre-existing user database.

**Rationale**: `createSchema()` only executes for brand-new databases (`if (stored) { db = new SQL.Database(stored) } else { ...createSchema() }`), so any database a user already has stored in IndexedDB would silently lack the new column and every favorite-related query would throw. A guarded `ALTER TABLE ... ADD COLUMN` is the standard, low-risk SQLite migration technique for additive, nullable/defaulted columns and requires no data rewrite. Checking `PRAGMA table_info` first keeps the migration idempotent and safe to run on every app load.

**Alternatives considered**: (a) Bump a stored schema-version number and gate the migration on that — more ceremony than needed for a single additive column, and the codebase has no existing versioning convention to extend. (b) Blow away and recreate the database on version mismatch — explicitly forbidden by the spec's "no data loss" / "preserve database functionality" requirements.

## 2. Building the flat, cross-album "My Photos" / "Favorites" gallery

**Decision**: Add `getAllPhotos({ favoritesOnly = false, offset = 0, limit = 50 } = {})` to `modules/db.js`, implemented as a single SQL query joining `Photos` and `Albums` (`SELECT p.*, a.album_date, a.title AS album_title FROM Photos p JOIN Albums a ON a.id = p.album_id WHERE p.deleted_at IS NULL AND a.deleted_at IS NULL [AND p.is_favorite = 1] ORDER BY p.photo_date DESC, p.upload_date DESC LIMIT ? OFFSET ?`). The "My Photos" and "Favorites" UI views both render through the same new `ui/photo-gallery.js`, passing `favoritesOnly: true` for Favorites.

**Rationale**: The current app has no flat photo view at all — the home page only ever rendered the album grid (`renderAlbumGrid`), and individual photos were only visible inside a single album (`renderAlbumView`). A single joined, paginated query keeps the "no N+1 queries" property already used elsewhere in `db.js` (e.g., `getAlbums()`'s single query with a `LEFT JOIN` to `AlbumOrder`), and reusing one gallery renderer for both "My Photos" and "Favorites" avoids duplicating card markup/logic.

**Alternatives considered**: Fetching all albums then looping `getPhotos(albumId)` per album client-side — rejected as an N+1 query pattern that doesn't scale and complicates pagination/sorting across albums.

## 3. Date-section grouping convention for the new gallery

**Decision**: Group photos by calendar month/year ("September 2026", "August 2026" — reusing the existing `formatAlbumDate`-style formatting already in `album-grid.js`), computed client-side from the already-sorted query result. This matches the grouping granularity the app already uses (one `Album` per calendar date), so it introduces no new date-bucketing semantics.

**Rationale**: The spec explicitly allows either "Month Year" or "Today/Yesterday/This Week/Earlier" style sections. Month/Year is deterministic (no timezone-sensitive "is this today" edge cases), trivial to compute from `photo_date`/`upload_date` already returned by the query, and visually consistent with how albums already group by date. Relative labels ("Today"/"Yesterday") are more delightful but add edge-case complexity (timezone boundaries, "what counts as this week") with no functional requirement forcing that choice.

**Alternatives considered**: "Today/Yesterday/This Week/Earlier" relative buckets — kept as a documented non-goal for this iteration; the visual date-badge styling requested by the spec is fully achievable with Month/Year headers.

## 4. Album cover image

**Decision**: Extend the existing `getAlbums()` query with a correlated subquery/`LEFT JOIN` that pulls the `thumbnail_base64` of the most recently uploaded, non-deleted photo in each album (`ORDER BY upload_date DESC LIMIT 1` per album), returned as `cover_thumbnail_base64`. `createAlbumCard()` in `ui/album-grid.js` renders that thumbnail as the card's cover image, falling back to the existing icon placeholder only when an album has zero photos (should not normally happen, but keeps the empty edge case safe).

**Rationale**: Album cards currently render a static `📁` placeholder (`ui/album-grid.js:36`) with no real cover image. A single query extension avoids N+1 photo lookups per album and keeps `getAlbums()` as the one source of truth for album-list rendering.

**Alternatives considered**: Fetching each album's photos separately to pick a cover — rejected for the same N+1 reason as item 2.

## 5. Drag-and-drop photo upload zone

**Decision**: Build a new `ui/upload-zone.js` using native `dragenter`/`dragover`/`dragleave`/`drop` handlers (same event-handling style already used for album reordering in `modules/dnd.js`) to accept dropped files, plus a "choose photos" button that reuses the existing `showFileUploadDialog()` from `ui/file-upload.js` unchanged. Dropped/selected files are held in local component state, previewed via `URL.createObjectURL(file)` (cheap, no base64/EXIF work yet), individually removable before confirming, and only on confirm are they handed to the existing, untouched `uploadPhotos(files)` pipeline in `modules/photo.js`.

**Rationale**: There is currently no drag-and-drop *upload* surface at all (only a native `<input type="file">` dialog) — the existing `dnd.js` module only handles album-card reordering. Previewing via `createObjectURL` avoids running the expensive base64-encode/EXIF/thumbnail pipeline twice (once for preview, once for real) and keeps the already-working `photo.js`/`storage.js`/`exif.js` upload pipeline completely untouched, satisfying the "do not rewrite working functionality" constraint. `URL.revokeObjectURL` is called on removal/confirm to avoid leaking blob URLs.

**Alternatives considered**: Running full EXIF/thumbnail extraction just for the preview step — rejected as duplicate, unnecessary work that risks touching the fragile EXIF pipeline for a purely cosmetic preview.

## 6. Visual design system implementation (palette, typography, animation)

**Decision**: Retint the existing CSS custom-property token file (`src/styles/main.css`) in place — replace the current blue/gray palette values with the requested pink/purple/lavender/peach palette (`--color-primary: #EC4899`, `--color-secondary: #8B5CF6`, plus new `--color-light-pink: #FCE7F3`, `--color-light-purple: #EDE9FE`, `--color-bg: #FFF7FC`, `--color-text: #3B2850` tokens), and add typography tokens for a friendly rounded heading font ("Baloo 2") paired with a highly readable body font ("Nunito"), loaded via a standard `<link>` to Google Fonts in `index.html` with a system-font fallback stack so the app still renders correctly offline. All new hover/press/heart/drag/fade animations are plain CSS transitions/`@keyframes`, wrapped so they only apply `@media (prefers-reduced-motion: no-preference)`.

**Rationale**: The project already has a working, consistently-used design-token system (`--color-*`, `--spacing-*`, `--shadow-*`, `--transition-*` in `main.css`); retinting it is the smallest, lowest-risk change that guarantees every existing and new component (buttons, cards, alerts) picks up the new look automatically, matching the "only improve/refactor when necessary" and "no unnecessary frameworks" constraints. Gating all animation under `prefers-reduced-motion: no-preference` is the standard progressive-enhancement pattern and satisfies the accessibility requirement without JS-side feature detection.

**Alternatives considered**: Introducing Tailwind or another CSS framework — rejected per the explicit "do not introduce unnecessary frameworks" instruction and Constitution Principle V (Simplicity). Self-hosting font files — deferred as unnecessary complexity; a CDN `<link>` with a system-font fallback is sufficient for a locally-run app and doesn't block first paint on font load (fallback renders immediately).

## 7. Settings section scope

**Decision**: `ui/settings-view.js` renders app info (name "Emi's Craft House", version from `package.json`) plus simple storage stats (total photo count, total album count — both derived from data already fetched via existing `getAlbums()`/count queries, no new backend calls). It does not add authentication, preferences persistence, or a destructive "clear all data" action; existing per-photo/per-album delete controls (already present in My Photos/Albums/Favorites views) remain the only way to remove data, unchanged.

**Rationale**: Nothing in the current codebase or the spec's functional requirements calls for a real preferences/account system, and Constitution Principle V (Simplicity/YAGNI) explicitly discourages building for hypothetical future needs. FR-016 only requires "basic application information and a way to manage stored data... reusing existing application logic," which is satisfied by surfacing existing counts and delete affordances rather than inventing new destructive bulk operations.

**Alternatives considered**: A "delete all data" button — rejected as an unrequested, high-risk destructive action with no corresponding functional requirement; existing per-item delete already covers the "manage stored data" requirement.

## 8. Branding rename scope

**Decision**: Update `index.html` (`<title>`, meta description), the in-app header (`app.js::addHeader`, replaced by the new `ui/hero.js`/`ui/nav.js`), and any other user-visible strings reading "Photo Organizer." `package.json`'s internal `name` field and other non-user-facing identifiers are left as-is unless a task specifically requires changing them for build/tooling reasons.

**Rationale**: Matches the Assumptions already recorded in `spec.md`: "improve the URL and title" was interpreted as the browser tab title and on-page branding, since the project has no live deployment domain today; internal package identifiers carry no user-facing value and changing them is out of scope for a UI redesign.

**Alternatives considered**: Renaming the npm package and repository-level identifiers — rejected as unrelated to user-facing value and outside this feature's scope.
