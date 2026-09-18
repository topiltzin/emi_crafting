# Feature Specification: Permanent Album Deletion

**Feature Branch**: `[007-album-hard-delete]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "When an album is deleted, do it for the phots and the album including Database.. do it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deleting an album actually removes it (Priority: P1)

As a user, when I delete an album and confirm it, I want that album, its photos, and their image files to be genuinely gone — not just hidden from view — so my library and my storage usage truly reflect what I've deleted.

**Why this priority**: This is the entire feature. Today, confirming an album's deletion tells the user "this can't be undone," but the album and its photos are only hidden, not removed — they remain in storage indefinitely with no way for the user to ever see or recover them. The app's own warning already promises permanence; this story makes the behavior match that promise.

**Independent Test**: Create an album with at least one photo, delete it through the existing delete-confirmation flow, and confirm the album and its photo no longer appear anywhere in the app and cannot be brought back through any action in the app.

**Acceptance Scenarios**:

1. **Given** an album containing photos, **When** the user confirms deleting that album, **Then** the album and every photo that belonged to it are removed such that neither can be recovered through the app.
2. **Given** an album's photos have image and thumbnail files, **When** the album is deleted, **Then** those image files are also removed, not just their records.
3. **Given** the delete-confirmation dialog is open, **When** the user cancels instead of confirming, **Then** nothing about the album or its photos changes.
4. **Given** a deletion has just completed, **When** the user is returned to the albums list, **Then** the deleted album is not present, and it does not reappear in any photo view (Home, My Photos, Favorites) either.

---

### Edge Cases

- What happens if the deletion fails partway through (e.g., the image files are removed but a connectivity problem interrupts the rest)? The album and its photos must not be left in a broken, half-deleted state — either the deletion completes fully or the album/photos remain fully intact, and the user is told it didn't complete.
- What happens to a photo that was marked as a favorite when its album is deleted? It is removed along with everything else in that album — no special exception.
- What happens if the user retries deleting the same album after a failed attempt? The retry must be safe — it must not error out because some parts were already removed, and must still end with everything either fully gone or fully intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a user confirms deleting an album, the system MUST permanently remove that album and every photo belonging to it, including each photo's stored image and thumbnail files, not just their database records.
- **FR-002**: Once a confirmed album deletion completes, the system MUST NOT offer any way, anywhere in the app, to view or recover that album or its photos.
- **FR-003**: The system MUST NOT delete or alter anything about the album or its photos when the user cancels the deletion confirmation.
- **FR-004**: If an album deletion fails partway through, the system MUST leave the album and its photos in a consistent state (either fully removed or fully intact, never partially) and MUST tell the user the deletion did not complete.
- **FR-005**: The deletion-confirmation message shown before an album is deleted MUST continue to clearly state that the action is permanent and cannot be undone.
- **FR-006**: Immediately after a successful deletion, the system MUST stop showing the deleted album and its photos on every screen that previously listed them (Albums, Home, My Photos, Favorites).
- **FR-007**: Retrying the deletion of an album that previously failed partway through MUST complete safely without erroring on parts already removed.

### Key Entities

- **Album**: When deleted, this feature removes the album's record entirely rather than marking it hidden.
- **Photo**: Every photo belonging to a deleted album is removed the same way — record and image/thumbnail files — as part of that album's deletion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of confirmed album deletions result in the album and all its photos being unrecoverable through the app afterward.
- **SC-002**: 100% of confirmed album deletions also remove the associated image and thumbnail files, not just their records.
- **SC-003**: Cancelling a deletion confirmation leaves 100% of the album's data unchanged, verified immediately after cancelling.
- **SC-004**: A deletion that fails partway (e.g., due to a connectivity problem) leaves the album and its photos fully intact in 100% of observed cases, with a clear failure message shown to the user.
- **SC-005**: Within 1 second of a successful deletion completing, the deleted album and its photos no longer appear on any screen that previously showed them.

## Assumptions

- This feature makes album deletion (and, by extension, the deletion of its photos) permanent rather than recoverable. It does not add a trash/recently-deleted view or a restore feature — the app currently has no screen to view or recover a hidden item, so a delete that only hides data provided no real benefit while still consuming storage indefinitely. This matches the user's explicit request that deletion happen "including Database."
- Deleting a single photo on its own (without deleting its entire album) is unchanged by this feature; only the "delete an album" action is affected. The identical gap exists for standalone photo deletion but is out of scope here since the request specifically describes album deletion.
- The existing delete-confirmation dialog and its "can't be undone" warning are already appropriate for this behavior and are not being redesigned — only the actual deletion behavior changes to match what that warning already promises.
- Any counts or totals shown elsewhere in the app (e.g., library/album counts) reflect the removal as soon as the deletion completes, consistent with how the rest of the app already stays in sync after a change.
