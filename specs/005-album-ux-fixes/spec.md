# Feature Specification: Album Reliability & Usability Fixes

**Feature Branch**: `[005-album-ux-fixes]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Check the feedback of UX expert and make the adjustment and the improvements as Feature" — a UX/functional audit of the Albums area identifying a silent album-creation failure, a non-clickable/non-keyboard-operable album card, a mis-landing drag-to-reorder, an unstyled sign-in screen, and a missing album-rename capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Creating a new album always works (Priority: P1)

As a user organizing craft photos into albums, I want every "Create Album" action to either create a new album with the name I typed or clearly tell me why it didn't, so that I never lose the name I entered or wonder whether the app is broken.

**Why this priority**: This is the most severe and most frequently hit problem — because the app already auto-creates one album per calendar date, any manual "Create Album" attempt after the first one on a given day currently does nothing at all, silently discarding the typed name with no error. This is very likely the exact behavior behind "Albums doesn't work properly." Fixing it restores trust that the core feature works.

**Independent Test**: On a day where an album already exists (e.g., created earlier that day, or via a photo upload that auto-created one), open "Create Album," type a distinct new name, and submit. Confirm the app either creates a distinguishable new album reflecting that name, or presents a clear, actionable message explaining that today's album already exists and offering a next step — never a silent no-op.

**Acceptance Scenarios**:

1. **Given** no album exists yet for today, **When** the user creates an album with a name, **Then** a new album is created with that name and appears in the album list.
2. **Given** an album already exists for today (from a prior manual creation or an auto-created upload album), **When** the user tries to create another album, **Then** the user is clearly told an album for today already exists (naming it) and is offered a next step — such as renaming the existing album or continuing to add photos to it — instead of the dialog silently closing with no change.
3. **Given** the user is shown the "album already exists for today" message, **When** they choose to rename the existing album, **Then** the album's name updates to what they type and no duplicate or orphaned album is created.

---

### User Story 2 - Album cards behave the way they look (Priority: P2)

As a user browsing my albums, I want clicking or tapping anywhere on an album's card — not just a small button — to open that album, and I want the same to work from the keyboard, so the interface behaves the way it visually promises.

**Why this priority**: Album cards currently look and feel interactive (pointer cursor, hover lift, focusable outline) everywhere on the card, but only a small "View" button actually responds. This mismatch between appearance and behavior reads as broken, and keyboard-only users currently cannot open an album at all from a focused card — a functional dead end, not just a polish issue.

**Independent Test**: With the album list showing at least one card, click on the thumbnail image or title text (not the "View" button) and confirm the album opens. Separately, using only the keyboard, tab to a card and press Enter or Space and confirm the album opens the same way.

**Acceptance Scenarios**:

1. **Given** an album card is visible, **When** the user clicks anywhere on the card outside of the "Delete" control, **Then** the album detail view opens.
2. **Given** an album card has keyboard focus, **When** the user presses Enter or Space, **Then** the album detail view opens.
3. **Given** an album card has keyboard focus, **When** the user tabs onward, **Then** focus moves predictably to the card's own controls (e.g., Delete) or the next card, without getting trapped or duplicated.
4. **Given** a user clicks the "Delete" control on a card, **When** the click is processed, **Then** only the delete confirmation happens — the card's "open album" behavior does not also fire.

---

### User Story 3 - Renaming an album (Priority: P3)

As a user, I want to rename an album after creating it, so that I can fix a typo, give a same-day album a more descriptive name, or reorganize my naming later without recreating everything.

**Why this priority**: This directly closes the gap exposed by Story 1 — once users can be told "today's album already exists," they need a real way to rename it. It also fixes a standing gap where no album, ever, can be renamed after creation.

**Independent Test**: Open an existing album (from the album list or from its detail view), choose to edit its name, submit a new name, and confirm the album now shows the new name everywhere it's displayed (album list, album detail, and anywhere photos reference their album).

**Acceptance Scenarios**:

1. **Given** an existing album, **When** the user edits its name from the album list, **Then** the updated name is saved and reflected immediately in the album list.
2. **Given** an existing album, **When** the user edits its name from inside the album's detail view, **Then** the updated name is saved and reflected in the detail view's header.
3. **Given** the user opens the rename control, **When** they submit an empty name, **Then** the app rejects it with a clear message and keeps the previous name unchanged.
4. **Given** the user opens the rename control, **When** they cancel without submitting, **Then** the album's name is unchanged.

---

### User Story 4 - Dragging an album to reorder lands where expected (Priority: P4)

As a user who manually orders my albums, I want dropping an album on a new spot to place it exactly where the drop indicator showed, so reordering is predictable instead of one position off.

**Why this priority**: Reordering already works end to end and survives reloads, but the album can land one slot away from where it was visually dropped when dragged forward past other albums. This is a real but lower-impact accuracy bug compared to the create/click issues above.

**Independent Test**: With at least four albums in a custom order, drag the first album and drop it directly onto the third album's position; confirm the dragged album ends up in that exact slot (not one slot before or after it). Repeat dragging an album backward toward the start of the list and confirm the same precision.

**Acceptance Scenarios**:

1. **Given** four or more albums in a list, **When** the user drags an album forward and drops it on a later album, **Then** the dragged album lands in the exact slot indicated by the drop target, and the previously-later albums shift back by one.
2. **Given** four or more albums in a list, **When** the user drags an album backward and drops it on an earlier album, **Then** the dragged album lands in the exact slot indicated by the drop target, and the previously-earlier albums shift forward by one.
3. **Given** a reorder just completed, **When** the page is reloaded, **Then** the new order persists exactly as dropped.

---

### User Story 5 - Sign-in screen looks like part of the app (Priority: P5)

As a user opening the app, I want the sign-in screen to look intentionally designed — matching the rest of the app's visual style — so that my first impression is confidence, not a suspicion that the app is broken or unfinished.

**Why this priority**: The sign-in screen is the very first thing every visitor sees, and it currently renders as an unstyled, top-left-aligned form while every other dialog in the app is fully styled. It's lower priority than the functional bugs above because it doesn't block any task, but it's a strong negative first impression.

**Independent Test**: Load the app in a signed-out state and confirm the sign-in form appears as a centered, styled card consistent with the app's existing visual language (colors, typography, spacing, rounded inputs/buttons), on both desktop and mobile widths.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor loads the app, **When** the sign-in screen renders, **Then** it appears as a centered card with styled inputs and a styled submit button, visually consistent with the rest of the app.
2. **Given** the sign-in screen on a narrow (mobile-width) viewport, **When** it renders, **Then** the form remains fully usable and readable without horizontal scrolling or overflow.
3. **Given** an invalid sign-in attempt, **When** the error message appears, **Then** it is visually styled and clearly noticeable, not plain unstyled text.

---

### Edge Cases

- What happens when a user tries to create a second album on a day that already has one, cancels out of the "album already exists" prompt without renaming? The existing album must remain unchanged and no duplicate or partial album is created.
- What happens when a user attempts to rename an album to a name that is empty, whitespace-only, or longer than the app's existing title length limit? The rename must be rejected with a clear message and the prior name must remain in effect.
- What happens when a user drags an album and drops it back onto its own original position? The order must remain unchanged and no update should be triggered.
- What happens when a keyboard user is focused on an album card and presses Enter/Space while the card's Delete control is what most recently had focus, versus the card itself? Only one action must fire per keypress — the card's "open" behavior and a nested control's own action must never both trigger from the same interaction.
- What happens when a user is on the sign-in screen using a screen reader or keyboard only? All fields, labels, and the submit control must remain independently reachable and readable, matching the styled version's structure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to successfully create a new, distinctly named album at any time, or MUST clearly explain to the user why a new album could not be created — the system MUST NOT silently discard a submitted album name without creating an album or showing an explanation.
- **FR-002**: When a user attempts to create an album for a day that already has one, the system MUST inform the user that an album for that day already exists (naming it) and MUST offer the user a way to either rename that existing album or continue without creating a duplicate.
- **FR-003**: The system MUST let a user rename any existing album, from both the album list and the album's detail view.
- **FR-004**: The system MUST reject an attempted album rename that is empty/blank or exceeds the album title's existing maximum length, and MUST leave the album's current name unchanged when rejecting.
- **FR-005**: The system MUST let a user open an album by clicking or tapping anywhere on that album's card, not only on a small embedded control.
- **FR-006**: The system MUST let a user open an album using only the keyboard, when that album's card has keyboard focus.
- **FR-007**: The system MUST ensure that activating a control nested inside an album card (such as Delete) performs only that control's action, and does not also trigger the card's "open album" behavior in the same interaction.
- **FR-008**: When a user drags an album card and drops it onto another album's position, the system MUST place the dragged album into exactly that resulting position, shifting the other albums accordingly, matching what the drop indicator showed during the drag.
- **FR-009**: The system MUST present the sign-in screen as a styled, centered element consistent with the rest of the application's established visual design (colors, typography, spacing, input and button styling), on both desktop and mobile screen widths.
- **FR-010**: The system MUST visually style sign-in error messages so they are clearly distinguishable, consistent with how errors are presented elsewhere in the app.

### Key Entities

- **Album**: A dated collection of photos with a name/title, a photo count, and a custom display position. This feature adds the ability to change an album's title after creation and clarifies what happens when a new album is requested for a date that already has one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of "Create Album" attempts either result in a new, correctly named album or a clear explanatory message — zero silent no-ops.
- **SC-002**: Users can open any album by clicking anywhere on its card, with a 100% success rate across all album cards shown in the app.
- **SC-003**: Keyboard-only users can open any album and reach every actionable control on an album card without using a mouse, verified across the full album list.
- **SC-004**: Renaming an album completes and is visible everywhere the album's name is shown within 2 seconds of submission, with zero cases of the old name persisting after a successful rename.
- **SC-005**: Dragging an album and dropping it on a target results in the exact expected final order in 100% of test reorders (forward and backward drags), with zero off-by-one placement errors.
- **SC-006**: On first load in a signed-out state, 100% of users see a centered, fully styled sign-in card rather than an unstyled form, on both desktop and mobile widths.

## Assumptions

- The existing one-album-per-calendar-date rule stays in place; this feature changes how the app communicates and recovers when that rule blocks a new album, rather than removing the rule itself.
- Album titles keep their existing maximum-length rule; renaming enforces the same limit already used when an album is first created.
- The album card's "open on click/tap anywhere" behavior extends the card's already-present hover and focus styling; it does not change what information is shown on the card.
- Drag-and-drop reordering keeps its current interaction model (drag a card, drop it on another card's position); this feature corrects the resulting order's accuracy, not the interaction style itself.
- The sign-in screen's restyle reuses the app's existing visual design language (colors, type, spacing, and the same card/modal conventions already used elsewhere) rather than introducing a new visual style.
- This feature is scoped to the Albums area and the sign-in screen; it does not change album creation triggered automatically by photo uploads (grouping by capture date) beyond how the "album already exists" case is communicated.
