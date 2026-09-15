# Quickstart: Validating the Gallery UX Reliability & Polish Fixes

Prerequisites: `npm install` already run once in the repo root.

## Run the app

```bash
npm run dev
```

Open the printed `http://localhost:5173/` URL.

## Automated checks

```bash
npm run test        # vitest — run once after each user story lands
npm run coverage     # coverage gate, per Constitution Principle II
npm run lint
```

Relevant existing/new spec files to run targeted while iterating on a single story:

```bash
npx vitest run tests/unit/upload-zone.test.js          # US2 (Add Photos button)
npx vitest run tests/unit/confirm-dialog.test.js tests/integration/delete-confirmation-flow.test.js   # US1
npx vitest run tests/unit/create-album-dialog.test.js tests/integration/create-album-flow.test.js      # US3
npx vitest run tests/unit/dialog.test.js tests/integration/app.test.js                                  # US4
npx vitest run tests/unit/nav.test.js                    # US5
npx vitest run tests/unit/theme.test.js tests/unit/settings-view.test.js                                # US6
```

## Manual validation per user story

Each scenario below mirrors an Acceptance Scenario in `spec.md` and can be run standalone against `npm run dev` once its story is implemented — no seed data beyond what the empty-state "Add My First Photo" flow already creates.

### US1 — Delete confirmation matches the app (P2)

1. Add a photo (see US2 flow below), then go to My Photos and click its Delete control.
2. **Expect**: an in-app dialog appears (not a browser popup), naming the photo. Confirm with the browser DevTools open and check no `beforeunload`/native-dialog warning appears in the console.
3. Click the dialog's Cancel — **expect** the photo is still listed.
4. Click Delete again, confirm — **expect** the photo is gone.
5. Repeat for an album via Create Album (US3) with at least one photo in it; the dialog **must** state the photo count that will be removed.

### US2 — Add Photos button reflects state (P1)

1. Click "+ Add Photos" with no prior selection.
2. **Expect**: the "Add Photos" confirm button is visibly inactive (dimmed) — not the same bright gradient as when active — and clicking it does nothing.
3. Choose one valid image via "Choose Photos". **Expect**: the confirm button becomes active; click it and confirm the photo is added, matching today's working end state.
4. Drag in a `.txt` file (or any non-image) alongside a valid image. **Expect**: a message names the rejected file; the valid image still appears in the pending list and can be added.

### US3 — Create Album in-app (P2)

1. Click "Create Album". **Expect**: no browser-native popup — an in-app dialog matching the Add Photos dialog's style.
2. Submit with the name field empty. **Expect**: inline validation message, no album created.
3. Enter a valid name and submit. **Expect**: album appears in Albums, matching today's working end state.

### US4 — Escape / visible close on every dialog (P2)

For each of: Add Photos, Create Album, Delete confirmation —
1. Open the dialog, press `Escape`. **Expect**: dialog closes, no action taken.
2. Reopen, click the visible close control (not the named Cancel/Confirm button). **Expect**: same result.

### US5 — On-brand nav icons (P3)

1. Open the navigation menu (hamburger on narrow viewport, full bar on wide).
2. **Expect**: every item shows a crisp icon matching the pink/purple palette, not an emoji — compare against a Windows and a macOS/Linux browser if available, appearance should be identical (this was the actual defect: emoji vary by OS).
3. With a screen reader (or the browser's accessibility tree inspector), confirm each nav item is announced once, by its label only.

### US6 — Light/Dark/System toggle (P3)

1. Open Settings, find the new "Appearance" card.
2. Select "Dark" while the OS is in light mode. **Expect**: app immediately switches to the dark palette.
3. Reload the page (or reopen `npm run dev`'s tab). **Expect**: still dark.
4. Select "System", then toggle the OS-level appearance. **Expect**: app follows the OS again, exactly like before this feature existed.

## Regression check

```bash
npx vitest run tests/unit/db.test.js tests/unit/models.test.js tests/unit/album-module.test.js tests/unit/photo-module.test.js
```

These exercise the persistence layer this feature does not touch (see `data-model.md` — no schema changes) and must pass unmodified.
