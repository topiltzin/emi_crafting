# Quickstart: Validating Album Reliability & Usability Fixes

## Prerequisites

- `npm install` (no new dependencies added by this feature, but ensures a clean state).
- `npm run dev` — the app running at `http://localhost:5173/`, signed in as the single owner account (see `specs/004-supabase-data-migration/quickstart.md` for the sign-in setup this feature's Story 5 restyles but does not change the mechanics of).
- At least one existing album with photos, so User Story 4 (reorder) has enough cards to drag between (create a few via "+ Add Photos" on different dates, or manually via "+ Create Album" before today's first album exists).

## Automated checks (run first)

```bash
npm test -- tests/unit/db.test.js tests/unit/album-module.test.js tests/unit/dnd.test.js tests/unit/create-album-dialog.test.js tests/unit/auth-view.test.js
npm test -- tests/integration/album-redesign.test.js tests/integration/album-reorder.test.js tests/integration/create-album-flow.test.js
npm run coverage   # confirm the 80% threshold in vite.config.js still passes (Constitution II)
```

## Manual validation — one pass per user story

### §1 Story 1 (P1) — Create Album never silently fails

1. Ensure today already has an album (create one via "+ Create Album" if needed).
2. Click "+ Create Album" again, type a distinct name, submit.
3. **Expect**: a dialog names the existing today's album and offers to rename it or cancel — never a silent close with no visible change (FR-001, FR-002; SC-001).
4. Choose "Rename", submit a new name.
5. **Expect**: the existing album's name updates everywhere it's shown; no duplicate album appears (Acceptance Scenario 3).

### §2 Story 2 (P2) — Full-card click + keyboard

1. On the Albums screen, click the thumbnail or title area of a card (not the "View" button).
2. **Expect**: the album opens (FR-005; SC-002).
3. Tab (keyboard only) until an album card is focused (visible focus ring), press Enter, then repeat and press Space on another card.
4. **Expect**: both open the album (FR-006; SC-003).
5. Click directly on a card's "Delete" button.
6. **Expect**: only the delete-confirmation dialog appears — the album does not also navigate open (FR-007, Acceptance Scenario 4).

### §3 Story 3 (P3) — Rename an album

1. From the album list, use the new "Edit" action on a card; submit a new name.
2. **Expect**: the album list reflects the new name immediately (Acceptance Scenario 1; SC-004).
3. Open that album's detail view, use its header "Edit" action, submit another new name.
4. **Expect**: the detail header updates, and the change persists after reloading the page.
5. Repeat, submitting an empty name.
6. **Expect**: rejected with a clear message; previous name remains (Acceptance Scenario 3).

### §4 Story 4 (P4) — Drag-reorder precision

1. With 4+ albums in view, drag the first card and drop it exactly on the third card.
2. **Expect**: the dragged album lands in that exact slot (third), with albums that were 2nd/3rd shifting back by one — not one slot off (FR-008; SC-005).
3. Reload the page.
4. **Expect**: the new order persists exactly as dropped (Acceptance Scenario 3).
5. Repeat dragging an album backward (from a later position to an earlier one) and confirm the same precision.

### §5 Story 5 (P5) — Sign-in screen styling

1. Sign out (or open the app in a fresh/incognito session) and load `http://localhost:5173/`.
2. **Expect**: a centered, styled card (not a top-left unstyled form) — matching the app's existing color/typography/spacing (FR-009; SC-006).
3. Resize the window to a mobile width (≤480px) and reload.
4. **Expect**: the card remains fully usable, no horizontal scroll or overflow (Acceptance Scenario 2).
5. Submit an intentionally wrong password.
6. **Expect**: a visibly styled error message, not plain unstyled text (FR-010, Acceptance Scenario 3).

## Sign-off

All five sections above pass **and** the automated checks pass with coverage ≥80% ⇒ feature is ready to ship, consistent with `spec.md`'s Success Criteria SC-001–SC-006.
