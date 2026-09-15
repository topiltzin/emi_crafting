# Feature Specification: Gallery UX Reliability & Polish Fixes

**Feature Branch**: `003-ux-fixes-polish`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "check the feedback and plan accordingly as new feature" — turning the UI/UX review findings from the current Chrome walkthrough of Emi's Craft House into a plannable feature: an in-app delete confirmation (replacing the native browser confirm), a working Add Photos call-to-action, an in-app Create Album flow, keyboard-dismissible modals, on-brand navigation icons, and a user-facing dark mode toggle.

**Correction note**: An earlier pass of this review assumed deleting a photo or album had *no* confirmation step at all. Re-checking the source (`src/ui/album-grid.js`, `album-view.js`, `photo-gallery.js`) shows every delete action already asks the user to confirm via the browser's native `window.confirm()` before anything is removed — there is no data-loss bug today. The real, still-valid issue is that this confirmation is an unstyled native browser dialog, the same class of problem as the native `Create Album` prompt below — not a missing safety net. User Story 1 below is scoped accordingly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete confirmation matches the app's own look and feel (Priority: P2)

A user taps "Delete" on a photo or an album. Today the app already asks for confirmation before removing anything, but it does so through the browser's own unstyled system dialog, which looks and behaves nothing like the rest of the app and can freeze the surrounding page while it's open. Instead, that confirmation should appear as an in-app dialog naming what will be lost, styled consistently with the rest of the experience.

**Why this priority**: Data safety already exists via the native confirm, so this is a consistency fix rather than a data-loss fix — it follows the P1 fix below, alongside the other native-dialog replacement (Create Album).

**Independent Test**: Can be fully tested by creating a photo and an album, tapping each one's Delete control, and verifying an in-app (not browser-native) confirmation step names the item and blocks removal until explicitly confirmed — with the item removed on confirm and left untouched on cancel, matching today's end result either way.

**Acceptance Scenarios**:

1. **Given** an album containing photos, **When** the user taps "Delete" on the album, **Then** the app shows an in-app confirmation step (not a native browser dialog) naming the album and stating how many photos will be removed with it, and the album is not deleted until the user confirms.
2. **Given** the delete confirmation step is showing, **When** the user cancels or dismisses it, **Then** the photo or album remains exactly as it was, with no data changed — matching today's cancel behavior.
3. **Given** a single photo in "My Photos", **When** the user taps "Delete" and confirms, **Then** the photo is removed, matching today's end result.

---

### User Story 2 - Add Photos button always reflects whether it can act (Priority: P1)

A user opens the "Add Photos" dialog before choosing any files. Today the "Add Photos" confirm button appears fully active and clickable, but clicking it does nothing — no photos are added, and nothing on screen explains why. The button (and the surrounding action controls) should only appear active once the user has actually selected or dropped at least one photo, and should give feedback for a rejected file (wrong type).

**Why this priority**: This is a broken primary call-to-action on the app's main entry flow (adding a photo) — users can be stuck clicking a button that silently does nothing, with no way to know what went wrong. It directly undermines trust in the app's core function.

**Independent Test**: Can be fully tested by opening "Add Photos" with no files chosen and confirming the confirm/cancel controls are not the active, clickable state a user would act on; then choosing a valid photo and confirming the same controls become active and complete the upload as they do today.

**Acceptance Scenarios**:

1. **Given** the Add Photos dialog has just opened with no files chosen, **When** the user looks at or attempts to click the confirm ("Add Photos") button, **Then** it is visibly and functionally inactive — clicking it does not proceed and no silent no-op occurs.
2. **Given** the user selects or drops one or more valid image files, **When** the pending selection updates, **Then** the confirm button becomes active and clicking it adds the selected photos, exactly as it does today.
3. **Given** the user removes all pending files after selecting some, **When** the pending list becomes empty again, **Then** the confirm button returns to its inactive state.
4. **Given** the user attempts to add a file of an unsupported type, **When** the file is rejected, **Then** the user sees a clear message explaining why that file wasn't added.

---

### User Story 3 - Create an album without leaving the app's look and feel (Priority: P2)

A user taps "Create Album" to name and start a new album. Today this pops up the browser's own unstyled system dialog, which looks and behaves nothing like the rest of the app, accepts blank or whitespace-only names with no feedback, and can freeze the surrounding page while it's open. Instead, album creation should happen in an in-app dialog matching the rest of the experience, with clear validation.

**Why this priority**: It's a visible break in the app's identity on a frequently used action, and the lack of name validation lets users create confusing, blank-named albums — the same class of native-dialog problem as User Story 1's delete confirmation, so it follows the sole P1 fix (User Story 2).

**Independent Test**: Can be fully tested by tapping "Create Album" and confirming no browser-native dialog appears; the in-app dialog accepts a valid name and creates the album as today, and rejects a blank/whitespace-only name with a visible message instead of creating it.

**Acceptance Scenarios**:

1. **Given** the user taps "Create Album", **When** the dialog opens, **Then** it is styled consistently with the rest of the app (not a native browser popup) and does not block the rest of the page while open.
2. **Given** the create-album dialog is open, **When** the user enters a valid name and confirms, **Then** a new album with that name is created, matching today's end result.
3. **Given** the create-album dialog is open, **When** the user submits a blank or whitespace-only name, **Then** the album is not created and the user sees a clear message asking for a name.
4. **Given** the create-album dialog is open, **When** the user cancels, **Then** no album is created and the user returns to where they were.

---

### User Story 4 - Every dialog can be closed with Escape or a visible close control (Priority: P2)

A user opens any dialog in the app (Add Photos, Create Album, a delete confirmation). Today the only way to dismiss it is finding and clicking a specific "Cancel" button — pressing Escape does nothing, and there's no visible × to close it. Every dialog should close on Escape and offer a visible close control, matching the behavior users expect from any modal.

**Why this priority**: This is a consistency and keyboard-accessibility gap across every dialog in the app, not a single broken flow, so it's addressed once all the dialogs above exist in their fixed form.

**Independent Test**: Can be fully tested by opening each dialog in the app (Add Photos, Create Album, delete confirmation) and confirming pressing Escape closes it without applying any change, and a visible close control is present and does the same.

**Acceptance Scenarios**:

1. **Given** any dialog is open, **When** the user presses the Escape key, **Then** the dialog closes and no action (delete, create, upload) is applied.
2. **Given** any dialog is open, **When** the user looks at the dialog, **Then** a visible close control is present in addition to any named action buttons like "Cancel".

---

### User Story 5 - Navigation icons match the app's visual identity (Priority: P3)

A user opens the navigation menu and sees generic emoji (🏠📸📂💖⚙️) instead of icons that match the app's pink/purple craft-themed look. Replacing them with a consistent icon set makes the navigation feel like part of one designed product rather than a placeholder, and renders identically across every device instead of varying by OS.

**Why this priority**: Purely visual polish with no functional impact — it improves brand consistency but nothing is broken today.

**Independent Test**: Can be fully tested by opening the navigation menu and confirming every item uses the same consistent icon style (not emoji), rendering identically regardless of operating system.

**Acceptance Scenarios**:

1. **Given** the user opens the navigation menu, **When** they view the menu items, **Then** each item shows a consistent, on-brand icon instead of an emoji.
2. **Given** a screen reader user navigates the menu, **When** they reach each item, **Then** the icon is not announced redundantly alongside its text label.

---

### User Story 6 - Choose light or dark appearance in Settings (Priority: P3)

A user wants the app to always look a certain way regardless of their device's system setting, or wants dark mode without changing their whole device. Today the app only follows the operating system's light/dark preference automatically, with no way to override it inside the app. A toggle in Settings should let the user choose.

**Why this priority**: A nice-to-have convenience feature — the app already looks correct in both modes; this only adds user control over which one is shown.

**Independent Test**: Can be fully tested by opening Settings, switching the appearance toggle, and confirming the app's appearance changes immediately and remains on the chosen setting after closing and reopening the app.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they view the appearance control, **Then** they can choose light, dark, or "match device" appearance.
2. **Given** the user selects a specific appearance, **When** they close and reopen the app, **Then** the app still shows the chosen appearance regardless of the current device setting.

---

### Edge Cases

- What happens if a user rapidly double-taps "Delete confirm" — does it attempt to delete an already-deleted item?
- What happens if a user opens the delete confirmation for an album, then the album's last photo is removed from another open view before they confirm?
- What happens when a user submits the Create Album dialog with a name matching an existing album's name exactly?
- What happens if Escape is pressed while text is focused inside the Create Album name field — does it close the dialog or just clear focus?
- What happens if a user has "match device" appearance selected and their device's setting changes while the app is open?
- How does the app behave if a user drops a mix of valid and invalid files into the Add Photos dialog at once?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST continue to require an explicit confirmation step before deleting a photo, presented as an in-app dialog rather than the browser's native confirm dialog.
- **FR-002**: System MUST continue to require an explicit confirmation step before deleting an album, presented as an in-app dialog rather than the browser's native confirm dialog, and that step MUST state how many photos will be removed along with it.
- **FR-003**: Confirmation steps for destructive actions MUST be presented using the app's own visual style, matching the styling used elsewhere in the app (e.g. the Add Photos dialog).
- **FR-004**: The Add Photos confirm action MUST be inactive (not clickable) whenever there are zero pending photos selected.
- **FR-005**: The Add Photos confirm and cancel controls MUST NOT appear in their active/clickable state before the user has selected or dropped at least one photo.
- **FR-006**: System MUST show a clear, visible message when a selected or dropped file is rejected (e.g., unsupported file type), explaining why it wasn't added.
- **FR-007**: Creating an album MUST use an in-app dialog styled consistently with the rest of the app, not a native browser prompt.
- **FR-008**: System MUST reject blank or whitespace-only album names with a visible inline message, without creating the album.
- **FR-009**: Every modal dialog in the app MUST close when the user presses the Escape key, without applying whatever action the dialog was for.
- **FR-010**: Every modal dialog in the app MUST present a visible close control in addition to any named action buttons.
- **FR-011**: Navigation menu items MUST use a consistent icon system rather than emoji characters, matching the app's existing color palette.
- **FR-012**: Decorative navigation icons MUST be hidden from assistive technology so screen readers announce only the item's text label.
- **FR-013**: Settings MUST provide a control letting the user choose the app's appearance as light, dark, or matching the device setting.
- **FR-014**: The user's chosen appearance preference MUST persist across app sessions on the same device.

### Key Entities

- **Appearance Preference**: The user's chosen light/dark/match-device setting for how the app looks; stored per device and read on app start to decide which appearance to show.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of delete confirmations for a photo or album appear as an in-app dialog, with 0% of them triggering the browser's native confirm dialog; delete continues to require explicit confirmation, unchanged from today.
- **SC-002**: In usability observation, 0% of users click the Add Photos confirm button while it has nothing to add without immediately seeing why nothing happened (it is visibly inactive, not silently unresponsive).
- **SC-003**: Users can create a new album entirely within the app's own visual style, with 0 browser-native dialogs appearing during the flow, and blank names are rejected 100% of the time with a visible message.
- **SC-004**: Users can close any dialog in the app via the Escape key or a visible close control in under 1 second, without needing to locate a specific "Cancel" button.
- **SC-005**: Navigation icons render identically in appearance across at least two different browsers/operating systems, with 0 OS-dependent emoji variation.
- **SC-006**: Users can switch the app's appearance in 2 clicks or fewer from Settings, and the chosen appearance is still in effect on 100% of subsequent app opens until changed again.

## Assumptions

- The existing "Add Photos" dialog's visual style (rounded modal, gradient buttons, centered layout) is the design reference for the new Create Album dialog and for the restyled delete-confirmation step.
- Deleting an album continues to delete the photos it contains, as it does today; this feature changes how that action is confirmed, not what it ultimately does.
- Appearance preference is stored locally per device (no user accounts or cross-device sync exist in this app today).
- Replacing navigation icons is a visual-only change; no navigation items, ordering, or information architecture are added, removed, or renamed.
- This is a single-user local app with no authentication or multi-user permissions, so no access-control questions apply to these fixes.
- "Match device" remains the default appearance for users who have never set a preference, preserving today's behavior for anyone who doesn't touch the new Settings control.
