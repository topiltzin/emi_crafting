# Feature Specification: Craft Tutorial Links

**Feature Branch**: `008-craft-tutorial-links`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Connect your craft photos to YouTube videos - Allow users to associate YouTube tutorial links with their craft photos and albums for learning pathways, inspiration tracking, and discoverability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Link Tutorial to Existing Photo (Priority: P1)

As a crafter, I want to link a YouTube tutorial video to my finished craft photo so I can remember which guide I followed to create it.

**Why this priority**: This is the core MVP feature that enables the fundamental value proposition - connecting crafts to their instructional source. Without this, the feature doesn't exist. Users can immediately find and use this feature on every photo.

**Independent Test**: User can navigate to a photo detail view, click "Add Tutorial Link", paste a YouTube URL, and the tutorial information (thumbnail, title, creator) displays on the photo card and detail view. The feature is fully usable with just this story.

**Acceptance Scenarios**:

1. **Given** a user viewing a photo detail, **When** they click "Add Tutorial Link", **Then** a modal opens with a YouTube URL input field
2. **Given** the modal is open, **When** they paste a valid YouTube URL and click save, **Then** the system fetches video metadata (title, thumbnail, creator, duration)
3. **Given** valid video metadata is retrieved, **When** the save completes, **Then** the tutorial link is displayed on both the photo card and detail view
4. **Given** a tutorial link already exists, **When** the user clicks "Edit Tutorial Link", **Then** they can update or remove the link
5. **Given** an invalid YouTube URL, **When** they attempt to save, **Then** the system shows a clear error message and allows retry

**Edge Cases**:
- What happens when a YouTube video is deleted after the link is saved? (System should show "Video unavailable" with graceful fallback)
- What if the YouTube API is temporarily unavailable? (Show user-friendly error, allow manual entry of title)
- What if a user pastes a YouTube URL with invalid format? (Validate and provide clear guidance)
- What happens on network timeout during video metadata fetch? (Retry mechanism with exponential backoff)

---

### User Story 2 - View Tutorial from Photo (Priority: P1)

As a viewer, I want to click on a tutorial link from a craft photo so I can watch how that craft was made.

**Why this priority**: This is equally critical to P1 Story 1 - it represents the "read" half of the feature. Users must be able to discover and access tutorials easily, or the feature provides no value for consumption.

**Independent Test**: User viewing a photo with a tutorial link can click the tutorial card and it opens the YouTube video in a new tab or embedded player. This can be tested independently from Story 1 by manually seeding a photo with tutorial data.

**Acceptance Scenarios**:

1. **Given** a photo with a linked tutorial, **When** viewing the photo detail, **Then** a tutorial card is displayed showing video thumbnail, title, creator name, and duration
2. **Given** the tutorial card is visible, **When** the user clicks on it, **Then** the YouTube video opens in a new browser tab (or embedded player if implemented)
3. **Given** the user hovers over the tutorial card, **When** they hover over the title, **Then** a tooltip appears showing the full video title if truncated
4. **Given** a photo with no tutorial, **When** viewing it, **Then** a disabled state or CTA ("Add Tutorial Link") is shown instead of the tutorial card

**Edge Cases**:
- What if the tutorial video is now private or restricted? (Show "Video unavailable" message)
- What if the video metadata (title, thumbnail) has changed on YouTube? (Fetch fresh metadata on view)
- What if user is on a restricted network without YouTube access? (Still show tutorial info with note "Video unavailable in your region")

---

### User Story 3 - Filter/Browse by Tutorial Creator (Priority: P2)

As a crafter, I want to see all crafts I made following a specific creator's tutorials so I can track my learning from each channel.

**Why this priority**: This is a secondary feature that adds value once users have accumulated tutorial-linked photos. It enables learning pathways and creator exploration but is not essential for MVP. Most users will initially use Stories 1 & 2 before needing this.

**Independent Test**: After seeding multiple photos with tutorials from different creators, user can navigate to "Tutorials" tab and see a list of all creator channels with counts. Clicking a creator shows all photos linked to their videos. This can be tested independently without Stories 1 & 2 implementation.

**Acceptance Scenarios**:

1. **Given** a user with tutorial-linked photos, **When** they navigate to the "Tutorials" tab in main navigation, **Then** they see a list of all unique tutorial creators/channels
2. **Given** the tutorials view, **When** they see creator entries, **Then** each entry shows creator name, channel thumbnail, and count of photos linked to that creator
3. **Given** a creator entry, **When** they click on it, **Then** all photos linked to that creator's tutorials are displayed in a grid view
4. **Given** viewing creator's photos, **When** they sort/filter options, **Then** they can sort by date or mark as favorites

**Edge Cases**:
- What if a user has 100+ tutorial links from many creators? (Implement pagination or infinite scroll)
- What if a creator's channel is deleted? (Show "Channel unavailable" but still list the photos)
- What if two videos are from the same channel but different playlists? (Group by channel, not playlist)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add a YouTube URL to a photo via a modal dialog in the photo detail view
- **FR-002**: System MUST validate YouTube URLs and provide clear error messages for invalid formats
- **FR-003**: System MUST automatically fetch video metadata (title, thumbnail URL, creator name, channel ID, video duration) from YouTube when a valid URL is provided
- **FR-004**: System MUST store the tutorial link and its metadata as part of the photo's data model (persistent storage)
- **FR-005**: System MUST display the tutorial information on photo cards using a consistent visual design (thumbnail, title, creator, duration badge)
- **FR-006**: System MUST display a full tutorial card on the photo detail view with clickable link to open video in new tab or embedded player
- **FR-007**: System MUST allow users to edit or remove a tutorial link after it has been saved
- **FR-008**: System MUST handle deleted or unavailable YouTube videos gracefully (show "Video unavailable" without breaking the UI)
- **FR-009**: System MUST implement graceful fallback if YouTube API is temporarily unavailable (allow manual entry of title, queue for metadata refresh)
- **FR-010**: System MUST support a "Tutorials" navigation tab showing all tutorial-linked photos grouped by creator channel
- **FR-011**: System MUST display creator channel information (name, thumbnail) and count of photos linked to each creator
- **FR-012**: System MUST allow clicking a creator to view all photos linked to that creator's tutorials
- **FR-013**: System MUST cache video metadata to reduce API calls and improve performance (cache invalidation on edit)
- **FR-014**: System MUST handle rate limiting from YouTube API (implement retry logic with exponential backoff)

### Data Model Requirements

- **FR-015**: Photo entity MUST support optional `tutorialLink` object containing: url (string), videoId (string), title (string), creator (string), channelId (string), thumbnail (string/URL), duration (number in seconds)
- **FR-016**: System MUST maintain referential integrity - if a photo is deleted, its tutorial link is also deleted
- **FR-017**: System MUST timestamp when tutorial link was added/modified for audit trails

### Key Entities

- **Photo**: Existing entity extended with `tutorialLink` field (optional). The tutorialLink is always tied to a specific photo and cannot exist independently.
- **TutorialLink**: Represents the connection between a photo and a YouTube video. Contains metadata: url, videoId, title, creator name, channelId, thumbnail URL, duration. Each photo has at most one tutorial link.
- **Creator/Channel**: Aggregated data representing unique YouTube channels linked to the user's photos. Used for filtering and discovery in the Tutorials tab. Derived from unique channelIds in user's tutorial links.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully link a YouTube tutorial to a photo in under 30 seconds (including fetching metadata and saving)
- **SC-002**: At least 40% of photos uploaded in the first month after launch receive tutorial links (engagement metric)
- **SC-003**: Tutorial links on photo cards are clickable and users successfully navigate to YouTube videos with 90%+ success rate
- **SC-004**: Tutorials tab loads and displays creator list in under 2 seconds for users with up to 500 tutorial-linked photos
- **SC-005**: System correctly handles YouTube API failures by falling back to manual entry or retrying without user disruption in 95% of cases
- **SC-006**: Users who add tutorial links report higher app engagement (return rate) compared to control group (measured via analytics)
- **SC-007**: Average time to add a tutorial link shows <5% variance across different user device types (mobile/desktop) and browsers
- **SC-008**: Support tickets related to "how do I remember which tutorial I used?" decrease by 30% post-launch

## Assumptions

- **Existing YouTube API Access**: The project already has or will obtain YouTube Data API v3 credentials and rate limits; API integration is available
- **Photo Detail View Already Exists**: The photo detail/modal view exists and can be extended with tutorial link UI without major refactoring
- **User Authentication in Place**: Users are already authenticated; tutorial links are tied to user accounts for privacy
- **Existing Photo Storage**: Photo metadata is already persisted (Firestore, database, etc.); tutorial link data will be stored in the same system using the same patterns
- **Thumbnails CDN Available**: Video thumbnails will be served via YouTube's CDN; no local caching of images is required for MVP
- **Mobile Support**: Tutorial linking and viewing must work on mobile (iOS/Android) in addition to desktop, but embedded YouTube player is optional for MVP
- **No Real-time Collaboration**: This feature is single-user (not collaborative); no need for conflict resolution if two users edit the same photo's tutorial simultaneously
- **Tutorial Links are Optional**: Adding a tutorial link is always optional; photos without links function normally
- **YouTube API Rate Limits**: Assuming YouTube Data API quotas of 10,000 units/day per project; metadata fetching uses ~3-4 units per video
- **No Complex Video Analytics**: Tracking whether users actually watch linked tutorials is out of scope for MVP; focus is on linking and discovery only
