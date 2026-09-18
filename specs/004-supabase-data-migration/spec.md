# Feature Specification: Cloud Data Migration (Supabase)

**Feature Branch**: `[004-supabase-data-migration]`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Now we need to migrate the data instead of keep data locally use Supabase to: SUPABASE_URL=https://lrhvutyuikgvwuzaduil.supabase.co SUPABASE_PUBLISHABLE_KEY= SUPABASE_SECRET_KEY=-RmUlx"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Photos and albums survive the browser (Priority: P1)

As a user of the photo organizer, I want my albums and photos stored somewhere other than this one browser's local storage, so that clearing my browser data, switching browsers, or getting a new device doesn't wipe out my photo collection.

**Why this priority**: This is the core motivation for the migration — today all data lives only in one browser's IndexedDB. Losing that store means losing everything permanently. This is the minimum change that delivers real value.

**Independent Test**: Create an album with photos, clear the browser's local site data (or open the app in a different browser), and confirm the same albums and photos are still visible.

**Acceptance Scenarios**:

1. **Given** a user has created albums and uploaded photos, **When** the browser's local storage/IndexedDB is cleared, **Then** the albums and photos are still retrievable by the app.
2. **Given** a user has created albums and uploaded photos, **When** the app is opened in a different browser or device, **Then** the same albums and photos are visible there.
3. **Given** the cloud data store is temporarily unreachable, **When** the user opens the app, **Then** the app tells the user their data can't be reached right now instead of showing an empty/broken gallery.

---

### User Story 2 - Existing local data is not lost during the switch (Priority: P2)

As an existing user with albums and photos already stored locally, I want that existing data carried over to the new cloud storage, so that the switch doesn't erase the collection I've already built.

**Why this priority**: Without this, every current user loses everything the first time they open the app after the change ships. It's the second most critical piece because it protects existing value, but the app is still usable (for new data) without it.

**Independent Test**: On a browser that already has locally-stored albums/photos from before the change, load the updated app and confirm those albums/photos appear without the user re-uploading anything.

**Acceptance Scenarios**:

1. **Given** a browser has existing local albums and photos, **When** the user opens the updated app for the first time, **Then** all existing albums and photos appear as before, now backed by cloud storage.
2. **Given** the transfer of existing local data to cloud storage fails partway through, **When** this happens, **Then** no local data is deleted and the user is told the transfer didn't complete.
3. **Given** a browser has no existing local data (a new user), **When** they open the app, **Then** they see the normal empty state and can start creating albums directly in cloud storage.

---

### User Story 3 - Everyday album and photo management keeps working (Priority: P3)

As a user, I want to keep creating albums, uploading photos, marking favorites, reordering albums, and deleting/restoring items exactly as I do today, so the switch to cloud storage is invisible in how I use the app day to day.

**Why this priority**: This confirms the migration didn't regress existing functionality. It's lower priority than the two above because it's about parity, not new capability — but it must hold for the migration to be considered safe to ship.

**Independent Test**: Perform each existing action (create album, upload photo, toggle favorite, reorder albums, delete/restore an album or photo) against the cloud-backed app and confirm identical behavior to today's local-storage version.

**Acceptance Scenarios**:

1. **Given** a user creates a new album, **When** they upload a photo into it, **Then** the photo appears in the album with its thumbnail, capture date, and file details, same as today.
2. **Given** a user marks a photo as a favorite, **When** they view the favorites list, **Then** the photo appears there and remains marked after reloading the app.
3. **Given** a user reorders albums via drag-and-drop, **When** they reload the app, **Then** the custom order is preserved.
4. **Given** a user deletes an album or photo, **When** they undo/restore it before it's permanently removed, **Then** it reappears with its original data intact.

---

### Edge Cases

- What happens when a photo upload is interrupted mid-transfer (e.g., network drops while uploading a large photo)? The photo must not appear as successfully added, and the user must be able to retry.
- How does the system handle two devices editing the same album/photo at nearly the same time (e.g., reordering albums on one device while deleting one on another)?
- What happens if a user has an unusually large local collection (e.g., thousands of photos) — does the initial transfer to cloud storage complete reliably, and does the user get progress feedback rather than an unresponsive app?
- How does the app behave when the user has no internet connection at all — can they still view previously-loaded photos, or is the app fully blocked?
- What happens if the same album date already exists in cloud storage from a prior partial migration attempt (avoiding duplicate albums on retry)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store all album and photo data (including photo images, thumbnails, capture metadata, favorite status, and custom album ordering) in a cloud-hosted data store rather than only in the local browser.
- **FR-002**: The system MUST make a user's albums and photos retrievable from any browser or device, not just the one where the data was created.
- **FR-003**: The system MUST continue to support all existing album and photo operations — create album, upload photo, view album/photo, toggle favorite, reorder albums, soft-delete and restore, and permanently delete — with the same outcomes users see today.
- **FR-004**: On first use after this change, the system MUST detect any albums/photos already stored locally in a user's browser and transfer them to cloud storage without requiring the user to manually re-upload photos.
- **FR-005**: The system MUST NOT delete or discard local data until its transfer to cloud storage has been confirmed successful.
- **FR-006**: If the transfer of existing local data fails partway through, the system MUST leave local data intact and clearly inform the user that the transfer is incomplete.
- **FR-007**: The system MUST inform the user when cloud storage is unreachable rather than silently showing an empty gallery or a generic error.
- **FR-008**: The system MUST prevent a photo upload or edit from being reported as successful unless it has actually been saved to cloud storage.
- **FR-009**: The system MUST restrict access to the albums and photos to a single personal account (the app's owner); it is not required to support multiple independent user accounts or a shared multi-person passcode.
- **FR-010**: When a user retries a previously-failed data transfer, the system MUST avoid creating duplicate albums or photos from data that already transferred successfully.

### Key Entities

- **Album**: A dated collection of photos, identified by a unique date, with an optional title, a photo count, a custom display position, and soft-delete/restore state. Represents how photos are grouped for browsing.
- **Photo**: An individual image belonging to one album, with its file data, a thumbnail, capture metadata (e.g., date taken, camera/EXIF details), a favorite flag, and soft-delete/restore state.
- **Album Order**: The user's custom, manually-arranged display order for albums, independent of album dates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of albums and photos that existed locally before the migration are still present and viewable after a user's first post-migration visit.
- **SC-002**: A user can open the app on a second, previously-unused browser or device and see their complete, unaltered photo collection without any manual export/import step.
- **SC-003**: Clearing a browser's local site data no longer results in any loss of albums or photos, verified across all supported browsers.
- **SC-004**: Uploading a typical photo and having it appear in its album completes in under 5 seconds on a standard broadband connection.
- **SC-005**: The app clearly communicates a connectivity problem to the user within 3 seconds of a failed data operation, with zero silent failures.
- **SC-006**: Zero reported incidents of permanent data loss attributable to the migration in the first 3 months after launch.

## Assumptions

- A cloud project (Supabase) to host the data has already been provisioned and is available for this feature to use; provisioning/configuring that project is a setup dependency, not a user-facing requirement of this spec.
- The app serves a single owner/account rather than multiple independent users; no sign-up, multi-account management, or per-user data isolation is required.
- Photo files and thumbnails will be stored in a way appropriate for binary image data in the cloud (rather than dictating a specific encoding here); this spec only requires that the outcome — retrievable, unmodified images — is preserved.
- The app requires an internet connection to load and save data going forward; fully offline use is out of scope for this migration unless clarified otherwise.
- This migration covers data storage only; it does not introduce new album/photo features beyond what exists today.
- Existing soft-delete/restore and favorite behaviors keep their current retention rules (no change to how long deleted items remain recoverable).
