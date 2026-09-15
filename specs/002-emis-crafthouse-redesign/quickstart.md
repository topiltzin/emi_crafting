# Quickstart: Validating the Emi's Craft House Redesign

## Prerequisites

- Node.js + npm installed (versions already pinned by this project's `package.json`/lockfile)
- Repository dependencies installed: `npm install`

## Run the app

```bash
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) in a browser.

## Validation scenarios

Run these in order against a fresh browser profile (or clear IndexedDB for the site first) to exercise both the "new install" and "existing data" paths described in `data-model.md` / `research.md`.

### 1. Branding

- Browser tab title reads **"Emi's Craft House"** (not "Photo Organizer"). See `contracts/ui-views-contract.md` (`index.html` change) and `research.md` item 8.

### 2. Empty state (new install)

- With no photos yet, the Home/My Photos view shows the "No creations yet!" empty state with an **"Add My First Photo"** button (`ui/empty-state.js`, spec Edge Cases).
- Albums view shows its own empty-state invite to create the first album.

### 3. Upload via drag-and-drop

- Drag 2–3 image files onto the upload zone; confirm the zone visually responds while dragging over it.
- Confirm thumbnails of the dropped files appear before committing, and that removing one from the pending list works.
- Confirm the upload, and verify the photos appear correctly grouped by date afterward — this proves the existing EXIF/date/storage pipeline (`modules/photo.js`, `modules/exif.js`, `modules/storage.js`) is untouched (`contracts/db-module-contract.md`, `research.md` item 5).

### 4. Gallery & date grouping

- Open "My Photos": photos render as rounded cards under month/year date-section headers (`research.md` item 3).
- Resize the window across ~320px, ~768px, and ~1440px+ widths: confirm the grid column count adapts and nothing scrolls horizontally (spec SC-003).

### 5. Albums

- Open "Albums": each album card shows a real cover-image thumbnail (not the old folder icon placeholder), title, photo count, and date (`research.md` item 4).
- Drag-reorder two album cards and confirm the new order persists after a page reload (existing `modules/dnd.js` behavior, unchanged).
- Delete an album and confirm its photos are removed from "My Photos" too.

### 6. Favorites (new feature)

- From any photo card, click the heart icon; confirm a small animation plays and the heart shows as favorited.
- Open "Favorites": confirm only that photo appears, using the same card design as My Photos.
- Reload the page: confirm the photo is still marked favorite and still appears in Favorites (`contracts/db-module-contract.md::toggleFavorite`, persistence guarantee).
- Unfavorite it from the Favorites view and confirm it disappears from that view immediately.

### 7. Existing-database migration (upgrade path)

- Using a browser profile that already has photos/albums saved from **before** this feature (i.e., an IndexedDB database without the `is_favorite` column), load the app.
- Confirm the app loads normally (no error), all existing photos/albums are intact, and favoriting a photo works — proving the migration in `research.md` item 1 ran successfully with no data loss.

### 8. Accessibility

- Using keyboard only (Tab/Shift+Tab/Enter/Space), navigate the nav bar, open a photo's favorite toggle, and open the upload zone's file picker — confirm every control is reachable with a visible focus indicator (spec FR-013).
- In OS accessibility settings, enable "reduce motion," reload the app, and confirm hover/heart/drag/fade animations no longer play while all functionality still works (spec FR-018, `research.md` item 6).

### 9. Regression safety net

```bash
npm run lint
npm test
```

- `npm run lint` must pass with zero errors (existing ESLint config, unchanged).
- `npm test` must pass with all existing suites green (`tests/unit/*.test.js`, `tests/integration/*.test.js`) plus the new favorite/migration/gallery tests, and coverage must stay at or above the existing 80% thresholds (`vite.config.js`).
