# Feature Specification: Full-Resolution Photo Viewer

**Feature Branch**: `[006-photo-zoom-view]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "When user click on the photo, do a zoom on the image, like the open in high resolution and not the small low quality."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a photo at full resolution (Priority: P1)

As a user browsing my craft photos, I want to click or tap any photo thumbnail and see the original, full-resolution image — not the small, compressed version used in the grid — so I can actually see the detail in my work.

**Why this priority**: This is the entire feature. Every gallery view (Home, My Photos, Favorites, Album detail) currently only ever shows a small compressed thumbnail with no way to see the photo any larger — this story delivers the core value on its own.

**Independent Test**: From any screen that shows photo thumbnails (Home, My Photos, Favorites, an open album), click a photo and confirm a larger view opens showing the original image quality, clearly sharper/bigger than the grid thumbnail.

**Acceptance Scenarios**:

1. **Given** a photo thumbnail is visible in any gallery grid, **When** the user clicks or taps it, **Then** a full-resolution view of that photo opens.
2. **Given** the full-resolution view is open, **When** the user compares it to the grid thumbnail, **Then** the opened image is the original photo quality, not an upscaled or equally-compressed copy of the thumbnail.
3. **Given** a photo whose thumbnail failed to generate but whose original file uploaded successfully, **When** the user clicks it, **Then** the full-resolution view still opens and shows the original image.

---

### User Story 2 - Dismiss the full-resolution view (Priority: P2)

As a user viewing a photo at full resolution, I want an obvious, reliable way to close that view and return to exactly where I was, so viewing a photo never feels like a dead end.

**Why this priority**: A full-resolution view that can't be easily closed would make Story 1 actively harmful to the experience. This is the second half of a usable viewer.

**Independent Test**: Open the full-resolution view for a photo from partway down a long gallery, close it three different ways (close control, clicking outside the image, Escape key), and confirm each returns to the same gallery at the same scroll position.

**Acceptance Scenarios**:

1. **Given** the full-resolution view is open, **When** the user activates a visible close control, **Then** the view closes and the underlying gallery is shown again, scrolled to where it was.
2. **Given** the full-resolution view is open, **When** the user clicks/taps outside the image itself, **Then** the view closes the same way.
3. **Given** the full-resolution view is open, **When** the user presses Escape on a keyboard, **Then** the view closes the same way.
4. **Given** the full-resolution view is open, **When** the user closes it, **Then** the photo's data, favorite status, and album membership are unchanged.

---

### Edge Cases

- What happens when the user clicks a photo card's existing "favorite" or "delete" control? Only that control's own action fires — the full-resolution view must not also open.
- What happens while the full-resolution image is still loading (e.g., a slow connection)? The viewer must show a loading indication rather than a blank or frozen screen.
- What happens if the full-resolution image fails to load (e.g., a connectivity problem, or the original file is missing while its thumbnail still exists)? The viewer must show a clear error message rather than a blank or broken image.
- What happens on a small/mobile screen? The full-resolution image must scale to fit the screen without requiring horizontal scrolling, and the close control must remain reachable.
- What happens when a keyboard-only user reaches a photo thumbnail via Tab? Pressing Enter or Space must open the full-resolution view the same as a click, matching how other interactive cards in the app already behave.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user open a full-resolution view of a photo by clicking or tapping its thumbnail, on every screen where photo thumbnails are shown (Home, My Photos, Favorites, and an open album's detail view).
- **FR-002**: The full-resolution view MUST display the original, full-quality photo image, distinct from and higher quality than the compressed thumbnail used in gallery grids.
- **FR-003**: The system MUST let the user dismiss the full-resolution view via a visible close control, by clicking/tapping outside the image, and via the Escape key, in every case returning to the exact gallery screen and scroll position the user came from.
- **FR-004**: The system MUST show a loading indication in the full-resolution view while the original image is being retrieved.
- **FR-005**: The system MUST show a clear, user-readable error message in the full-resolution view if the original image cannot be retrieved, rather than a blank or broken image.
- **FR-006**: The full-resolution view MUST remain fully usable on both desktop and mobile screen widths, scaling the image to fit without horizontal scrolling.
- **FR-007**: Opening or closing the full-resolution view MUST NOT change the photo's stored data, favorite status, or album membership.
- **FR-008**: The system MUST let a keyboard-only user open the full-resolution view for a focused photo thumbnail (via Enter or Space) and close it (via Escape), without requiring a mouse.
- **FR-009**: Activating a photo card's existing controls (favorite, delete) MUST perform only that control's own action and MUST NOT also open the full-resolution view.

### Key Entities

- **Photo**: Existing entity. This feature relies on the photo's original, full-resolution image being retrievable in addition to the compressed thumbnail already used in gallery grids — a capability the photo entity does not currently expose to the interface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a full-resolution view from 100% of the screens that show photo thumbnails (Home, My Photos, Favorites, Album detail).
- **SC-002**: Users can close the full-resolution view and return to their exact prior scroll position in under 1 second of activating any of the three close methods.
- **SC-003**: The image shown in the full-resolution view is verifiably the originally uploaded photo (not a resized or re-compressed copy of the thumbnail), across every photo file type/size already supported by the app.
- **SC-004**: 100% of interactions with a photo card's existing favorite/delete controls continue to work exactly as before, with zero unintended full-resolution view openings.
- **SC-005**: A keyboard-only user can open and close the full-resolution view for any photo without touching a mouse.

## Assumptions

- The full-resolution view shows the image scaled to fit the viewport (no horizontal/vertical scrolling needed); pinch-to-zoom or pan controls beyond fitting the image to the screen are out of scope for this feature.
- Browsing to the next/previous photo from within the open full-resolution view (a "lightbox carousel") is out of scope for this feature — closing and reopening on a different thumbnail is the only way to view another photo, for now.
- No download/save-to-device control is added to the full-resolution view in this feature; it is a view-only experience, consistent with what was requested.
- The full-resolution view's dismissal behavior (close control, outside click, Escape) follows the same interaction conventions already used by other overlays in the app, for consistency.
- This feature does not change how photos are uploaded, stored, or thumbnailed — it only adds a way to view the already-stored original image at full size.
