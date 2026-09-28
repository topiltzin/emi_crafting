# Feature Specification: Photo to 3D Model

**Feature Branch**: `009-photo-to-3d-model`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "I need to add the functionality once the image is uploaded to convert it to a 3D image using the below code. The idea will be to have the option to convert and, once it is able to, save it to the database and render it as a GLB." (Reference snippet: a two-step call to the hosted "microsoft/TRELLIS.2" image-to-3D service — `/image_to_3d` with seed 0, resolution 1024, guidance strength 7.5 and 12 sampling steps per stage, followed by `/extract_glb` with a 100,000-face decimation target and 1024 texture size, producing a `.glb` file.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a Craft Photo into a 3D Model (Priority: P1)

As a crafter, after I upload a photo of something I made, I want to press a "Make it 3D" option on that photo so the app creates a 3D model of my craft and keeps it with the photo.

**Why this priority**: This is the core of the feature. Without the ability to request a conversion and have the result saved, nothing else in this feature has value.

**Independent Test**: Upload a photo of a single craft object, choose "Make it 3D" on it, wait for the process to finish, reload the app, and confirm the photo is marked as having a 3D model that persists across sessions and devices.

**Acceptance Scenarios**:

1. **Given** a photo I own with no 3D model, **When** I open it, **Then** I see a clearly labeled option to convert it to 3D.
2. **Given** I choose to convert a photo, **When** the conversion starts, **Then** I see a progress/"working on it" state that tells me it may take a few minutes and that I can keep using the app.
3. **Given** a conversion is running, **When** it completes successfully, **Then** the 3D model is saved permanently with that photo and the photo shows a visible "3D" marker.
4. **Given** a conversion is running, **When** I navigate away, close the viewer, or reload the page, **Then** the conversion is not lost and its current status is shown when I return to the photo.
5. **Given** a photo is already being converted, **When** I look at it, **Then** the convert option is disabled so I cannot start a duplicate conversion.

---

### User Story 2 - View and Spin the 3D Model (Priority: P1)

As a crafter (or a kid looking at the family's crafts), I want to open the 3D version of a craft and rotate, zoom, and look at it from every side.

**Why this priority**: Saving a model that cannot be seen delivers no value; viewing is the payoff of Story 1. It is independently testable by attaching an existing 3D model file to a photo.

**Independent Test**: With a photo that already has a saved 3D model, open the photo, switch to the 3D view, and verify the model appears and can be rotated by drag/touch and zoomed by scroll/pinch.

**Acceptance Scenarios**:

1. **Given** a photo with a saved 3D model, **When** I open the photo, **Then** I can switch between the original photo and the 3D view.
2. **Given** the 3D view is open, **When** I drag with a mouse or finger, **Then** the model rotates; **When** I scroll or pinch, **Then** it zooms in and out within sensible limits.
3. **Given** the 3D view is open, **When** the model is still downloading, **Then** I see a loading indicator rather than a blank area.
4. **Given** my device cannot display 3D content, **When** I try to open the 3D view, **Then** I see a friendly message and can still see the original photo.
5. **Given** I am on a phone, **When** I open the 3D view, **Then** it fits the screen and touch controls work.

---

### User Story 3 - Handle Failures, Retry, and Remove (Priority: P2)

As a crafter, if a conversion fails or I don't like the result, I want to try again or remove the 3D model, without affecting my original photo.

**Why this priority**: The conversion depends on a shared external service that can be busy or fail, and AI results vary. Recovery keeps the feature usable, but the happy path (Stories 1–2) delivers value first.

**Independent Test**: Simulate an unavailable conversion service, start a conversion, confirm a friendly failure message and a "Try again" option appear; then, on a photo with a saved model, choose "Remove 3D model" and confirm the photo remains intact with no 3D marker.

**Acceptance Scenarios**:

1. **Given** a conversion fails or exceeds the time limit, **When** I view the photo, **Then** I see a plain-language failure message and a "Try again" option, and the original photo is unchanged.
2. **Given** a photo already has a 3D model, **When** I choose "Redo 3D model" and the new conversion succeeds, **Then** the new model replaces the old one; **When** it fails, **Then** the previous model is kept.
3. **Given** a photo has a 3D model, **When** I choose "Remove 3D model" and confirm, **Then** the model is permanently deleted and the photo returns to its "no 3D model" state.
4. **Given** a photo with a 3D model, **When** the photo (or its album) is deleted, **Then** its 3D model is deleted too.

---

### User Story 4 - Download the 3D Model (Priority: P3)

As a crafter, I want to download my craft's 3D model file so I can share it, open it in other 3D apps, or 3D-print it.

**Why this priority**: Nice-to-have extension; the core experience works without it.

**Independent Test**: On a photo with a 3D model, choose "Download 3D model" and confirm a standard 3D model file is saved to the device and opens in a common 3D viewer.

**Acceptance Scenarios**:

1. **Given** a photo with a 3D model, **When** I choose "Download 3D model", **Then** a file named after the photo is saved to my device in the same format the app stores.

---

### Edge Cases

- **Service busy / queued**: The external conversion service is shared and may queue requests. The user sees a "waiting in line" / "still working" state; conversions that do not finish within 10 minutes are marked failed with a "Try again" option.
- **Service quota or rate limit reached**: The user is told the 3D maker is busy right now and to try later; no partial model is saved.
- **Photo is not a good subject** (e.g., busy scene, multiple objects, very dark): The conversion may still produce a result; the convert option shows a short tip ("works best with one object on a plain background"). The app does not block conversion.
- **Very large or unusual photo formats** (e.g., HEIC, very high resolution): The photo is prepared to a supported size/format before being sent; if it cannot be, the user sees a clear message.
- **Result file too large**: If the produced model exceeds the storage size limit, the conversion is marked failed with an explanation.
- **Concurrent conversions**: A user can have at most 3 conversions running at once; further requests show a "please wait for one to finish" message.
- **User signs out mid-conversion**: The conversion continues and the result is saved to the user's account; it is visible on next sign-in.
- **Photo deleted while conversion is running**: The conversion result is discarded and nothing is left behind in storage.
- **Stored model fails to load later** (corrupted/missing file): The 3D view shows a friendly error and offers "Redo 3D model".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer a "convert to 3D" option on every photo the signed-in user owns, available from the photo's detail view.
- **FR-002**: System MUST only start a conversion when the user explicitly chooses it; uploading a photo MUST NOT automatically trigger a conversion.
- **FR-003**: System MUST send the photo to the external image-to-3D service and obtain a single textured 3D model file using a fixed, app-defined set of quality settings (users are not asked to tune generation parameters).
- **FR-004**: System MUST track each conversion's status as one of: queued, processing, completed, or failed, and show that status on the photo.
- **FR-005**: Conversions MUST continue to completion independently of the user's browser session (navigating away, reloading, or closing the tab does not cancel them).
- **FR-006**: System MUST mark a conversion as failed if it does not complete within 10 minutes, or if the external service returns an error, and record a user-friendly failure reason.
- **FR-007**: System MUST permanently store each successful 3D model file in the user's private storage and link it to its source photo in the database.
- **FR-008**: 3D models MUST be private to the owning user, with the same access rules as their photos.
- **FR-009**: System MUST display a visible "3D" marker on photo cards and in the photo detail view for photos that have a completed 3D model.
- **FR-010**: System MUST provide an interactive 3D viewer for a photo's model supporting rotate (drag/touch), zoom (scroll/pinch), and reset view, usable on both desktop and mobile.
- **FR-011**: The 3D viewer MUST show a loading indicator while the model loads and a friendly fallback message (with the original photo still available) if the model cannot be displayed.
- **FR-012**: Users MUST be able to retry a failed conversion and to redo a conversion for a photo that already has a model; a new model replaces the old one only after the new conversion succeeds.
- **FR-013**: Users MUST be able to remove a photo's 3D model after confirming; removal deletes the stored model file and its database record.
- **FR-014**: Deleting a photo or album MUST delete any associated 3D models and cancel/discard any in-progress conversions for those photos.
- **FR-015**: System MUST prevent more than one active conversion per photo and more than 3 active conversions per user at a time.
- **FR-016**: System MUST reject produced models larger than 50 MB, marking the conversion failed with an explanation.
- **FR-017**: Users MUST be able to download a photo's 3D model file to their device.
- **FR-018**: System MUST keep the original photo unchanged by any conversion, retry, redo, or removal.
- **FR-019**: All new controls and messages MUST follow the app's existing visual style, be keyboard accessible, and have accessible labels.

### Key Entities

- **Photo** (existing): A user's uploaded craft photo. Gains a relationship to at most one current 3D model and its latest conversion attempt.
- **3D Model**: The saved, viewable 3D representation of a photo. Attributes: owning user, source photo, stored model file location, file size, creation date, generation settings used.
- **Conversion Job**: One attempt to turn a photo into a 3D model. Attributes: owning user, source photo, status (queued/processing/completed/failed), started time, finished time, failure reason. A photo may have many jobs over time, but at most one active at once.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start a 3D conversion from a photo in 2 clicks/taps or fewer from the photo detail view.
- **SC-002**: When the external service is available, at least 90% of conversions of single-object photos complete successfully within 5 minutes.
- **SC-003**: A saved 3D model opens and is interactive within 3 seconds on a typical broadband connection and within 8 seconds on a typical mobile connection.
- **SC-004**: 100% of completed 3D models remain available after page reload, sign-out/sign-in, and on another device signed into the same account.
- **SC-005**: 100% of failed conversions show a plain-language reason and a retry option, and 0% leave the original photo altered or orphaned files in storage.
- **SC-006**: Rotating and zooming the model feels smooth (no visible stutter) on a mid-range phone from the last 3 years.
- **SC-007**: In informal testing with the family (including a child), at least 4 of 5 testers can find, open, and spin a 3D model without help.

## Assumptions

- The conversion uses the publicly hosted "microsoft/TRELLIS.2" image-to-3D service with the settings from the user's reference snippet (seed 0, 1024 resolution, guidance 7.5, 12 sampling steps per stage, 100,000-face decimation target, 1024 texture size). This is a shared free service: availability, queue times, and usage quotas are outside the app's control, and an access token may be required to get reasonable quotas.
- The service must be called from a trusted server-side component, not directly from the user's browser. This protects the access token and lets conversions continue after the user leaves the page. Because a conversion can take longer than the app's existing backend functions are allowed to run, a small always-on background worker is required (see plan research R2).
- The produced model format is the standard binary 3D format returned by the service (GLB); it is stored and served as-is.
- Only the owner of a photo can convert, view, download, or remove its 3D model; sharing 3D models with other users is out of scope.
- One current 3D model per photo; version history of past models is out of scope.
- Users are not given controls for generation quality settings in this version.
- The background is removed automatically before conversion using the same external service's own preprocessing step. Users don't crop or mask photos themselves.
- Storage cost of models (typically a few MB to tens of MB each) is acceptable for a family-sized account.
- Users are notified of completion in-app only (status on the photo); email or push notifications are out of scope.
