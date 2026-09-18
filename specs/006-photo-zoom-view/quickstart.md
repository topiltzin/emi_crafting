# Quickstart: Validating the Full-Resolution Photo Viewer

## Prerequisites

- `npm install` (no new dependencies added by this feature, but ensures a clean state).
- `npm run dev` — the app running at `http://localhost:5173/`, signed in as the single owner account.
- At least one photo uploaded (any screen: Home, an album, etc.) so there's a thumbnail to click.

## Automated checks (run first)

```bash
npm test -- tests/unit/db.test.js tests/unit/photo-gallery.test.js tests/unit/dialog.test.js tests/unit/photo-viewer.test.js
npm test -- tests/integration
npm run coverage   # confirm the 80% threshold in vite.config.js still passes (Constitution II)
```

## Manual validation — one pass per user story

### §1 Story 1 (P1) — View a photo at full resolution

1. On Home (or My Photos, or Favorites, or inside an opened album), click a photo thumbnail.
2. **Expect**: a full-resolution view opens showing the original image — visibly sharper/larger than the small grid thumbnail (FR-001, FR-002; SC-001, SC-003).
3. Repeat from each of the other three screens (My Photos, Favorites, an open album's detail view).
4. **Expect**: the same behavior on all four (SC-001).
5. If a photo exists whose thumbnail looks low quality or failed to generate, click it.
6. **Expect**: the full-resolution view still opens and shows the original image (Acceptance Scenario 3).

### §2 Story 2 (P2) — Dismiss the full-resolution view

1. Scroll partway down a gallery with several photos, open the viewer for one, then close it via the visible close control.
2. **Expect**: returns to the gallery at the same scroll position (FR-003; SC-002).
3. Reopen, close by clicking outside the image.
4. **Expect**: same result.
5. Reopen, close by pressing Escape.
6. **Expect**: same result.
7. **Expect** throughout: the photo's favorite status and album membership are unchanged after opening/closing (FR-007, Acceptance Scenario 4).

### Edge cases to spot-check

1. Click a photo card's favorite (heart) control, then its delete control.
2. **Expect**: only that control's own action happens — the viewer does not also open (FR-009; SC-004).
3. Throttle the network (browser devtools) and open the viewer for a photo.
4. **Expect**: a loading indication appears while the original image loads, not a blank/frozen screen (FR-004).
5. Tab (keyboard only) to a photo card, press Enter, then repeat and press Space on another card.
6. **Expect**: both open the viewer; Escape closes it (FR-008; SC-005).
7. Resize the window to a mobile width (≤480px) and open the viewer.
8. **Expect**: the image scales to fit with no horizontal scrolling, and the close control remains reachable (FR-006).

## Sign-off

All sections above pass **and** the automated checks pass with coverage ≥80% ⇒ feature is ready to ship, consistent with `spec.md`'s Success Criteria SC-001–SC-005.
