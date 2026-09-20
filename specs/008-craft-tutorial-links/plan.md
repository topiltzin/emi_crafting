# Implementation Plan: Craft Tutorial Links

**Branch**: `008-craft-tutorial-links` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Connect craft photos to YouTube videos - Allow users to associate YouTube tutorial links with their craft photos and albums for learning pathways, inspiration tracking, and discoverability.

## Summary

Extend the photo metadata model to support optional YouTube tutorial links. Users can add/edit/view YouTube video links associated with their craft photos via a modal dialog. The system automatically fetches video metadata (title, thumbnail, creator, duration) from YouTube API. Tutorial links display on photo cards and detail views with graceful error handling for deleted videos and API failures. Phase 1 delivers stories 1 & 2 (link and view); Phase 2 adds story 3 (creator filtering).

## Technical Context

**Language/Version**: JavaScript (ES6+, Node.js compatible)

**Primary Dependencies**: 
- Frontend: Vite 4.5, vanilla JS (no framework)
- Backend: Supabase (PostgreSQL, auth, storage)
- External API: YouTube Data API v3
- Testing: Vitest 1.0+

**Storage**: PostgreSQL (Supabase) - extend existing `photos` table with `tutorial_link` JSONB field

**Testing**: Vitest with jsdom for unit and integration tests

**Target Platform**: Web (desktop and mobile browsers via Vite)

**Project Type**: Web application (single-page app with Vite, Supabase backend)

**Performance Goals**: 
- Photo detail view loads in <2 sec including tutorial metadata
- YouTube metadata fetch completes in <5 sec (user-facing timeout)
- Tutorial tab with 500+ photos loads in <2 sec (SC-004)
- Link creation completes in <30 sec from paste to display (SC-001)

**Constraints**: 
- YouTube API rate limits: ~10k units/day, 3-4 units per video fetch
- No local video caching; use YouTube CDN for thumbnails
- Graceful degradation if YouTube API unavailable
- Mobile-responsive (work on iOS/Android browsers)

**Scale/Scope**: Single-user feature; ~50 new code files (UI, module, tests); integrates with existing photo/album/storage systems

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Code Quality Standards ✅
- **Requirement**: All code must adhere to consistent formatting, type safety, and architectural patterns
- **Plan**: Enforce ESLint rules, Prettier formatting. Each module documented with clear contracts. Validation before every API call.
- **Status**: PASS - Feature adheres to existing project patterns (modular structure, Supabase integration, error classification)

### Comprehensive Testing ✅
- **Requirement**: >80% test coverage, tests before/alongside implementation, test failures block deployment
- **Plan**: Unit tests for YouTube URL validation, metadata fetching, error handling. Integration tests for photo + tutorial link flow. E2E tests for modal/card interaction.
- **Target Coverage**: >85% for tutorial-link-specific code
- **Status**: PASS - Feature spec includes clear acceptance scenarios that map to testable cases

### Performance Requirements ✅
- **Requirement**: Response times, throughput, memory documented and measured
- **Plan**: Monitor YouTube API fetch time (<5 sec timeout). Measure tutorial tab load (target <2 sec for 500 photos). Cache metadata to reduce API calls. Browser DevTools performance profiling in CI.
- **Regressions**: >10% degradation in photo detail load time triggers investigation
- **Status**: PASS - Success criteria (SC-001, SC-004, SC-007) define measurable performance targets

### User Experience Consistency ✅
- **Requirement**: Consistent interaction patterns, visual design, accessibility across app
- **Plan**: Tutorial link UI extends existing photo card/detail patterns. Reuses modal dialogs, buttons, error styles. Accessible error messages with proper ARIA labels.
- **Status**: PASS - Feature integrates seamlessly into existing photo UX; follows established patterns

### Simplicity and Maintainability ✅
- **Requirement**: Clear, straightforward solutions over clever abstractions. YAGNI principle.
- **Plan**: Single-user feature (no real-time sync). YouTube metadata cached in Supabase table (no separate cache layer). Modal-based UI (no new navigation patterns). Error handling reuses existing Supabase error system.
- **Status**: PASS - Design is minimal and reuses existing patterns

**Overall Constitution Status**: ✅ **PASSES - Ready for Phase 0**

---

## Project Structure

### Documentation (this feature)

```text
specs/008-craft-tutorial-links/
├── spec.md                      # Feature specification
├── plan.md                       # This file (implementation plan)
├── research.md                   # Phase 0 output (research findings)
├── data-model.md                 # Phase 1 output (entity schema)
├── quickstart.md                 # Phase 1 output (validation guide)
├── contracts/                    # Phase 1 output
│   ├── youtube-api-contract.md
│   ├── tutorial-link-ui-contract.md
│   └── photo-metadata-contract.md
├── checklists/
│   └── requirements.md           # Specification QA checklist
└── tasks.md                      # Phase 2 output (task breakdown)
```

### Source Code Structure

```text
src/
├── modules/
│   ├── tutorial-link.js          # Tutorial link service (validation, fetching, caching)
│   ├── youtube-client.js         # YouTube API wrapper (with error handling & retry)
│   └── tutorial-cache.js         # Metadata caching strategy
│
├── ui/
│   ├── tutorial-link-modal.js    # Modal for adding/editing tutorial links
│   ├── tutorial-card.js          # Tutorial display card component
│   ├── tutorial-badge.js         # Badge overlay on photo cards
│   ├── tutorials-tab.js          # Tutorials navigation view (Phase 2)
│   └── tutorial-styles.css       # Shared styles for tutorial components
│
└── styles/
    └── tutorial-link.css         # Tutorial-specific CSS

tests/
├── unit/
│   ├── tutorial-link.test.js     # URL validation, metadata parsing
│   ├── youtube-client.test.js    # API mocking, error scenarios
│   └── tutorial-cache.test.js    # Cache behavior
│
├── integration/
│   ├── photo-tutorial-flow.test.js  # Add link → Display → Edit flow
│   └── tutorial-tab.test.js       # Creator filtering (Phase 2)
│
└── e2e/
    └── tutorial-linking.test.js   # Full user journey (modal → display)
```

**Structure Decision**: Web application with vanilla JS modules. Tutorial linking is a cross-cutting concern that extends the photo entity, not a separate feature. Modules organized by responsibility (service layer, UI layer, styles), tests mirror source structure with unit/integration/e2e separation.

---

## Phase 0: Research

### Research Objectives

1. **YouTube API Integration Patterns**
   - Best practices for client-side video ID extraction
   - Error handling patterns for rate limiting and API failures
   - Metadata caching strategies for web apps

2. **URL Validation**
   - Robust YouTube URL formats (youtube.com, youtu.be, with/without timestamps)
   - Regular expression patterns vs. URL parsing APIs
   - Edge cases (playlists, shorts, live streams)

3. **Metadata Fetching Strategy**
   - Should metadata fetch happen client-side or server-side?
   - Security implications of exposing YouTube API key
   - Timeout and retry strategies for poor network conditions

4. **Caching & Storage**
   - Where to cache: Browser localStorage, Supabase, both?
   - Cache invalidation strategy (TTL, on-edit, on-view)
   - Storage quota considerations

5. **Error Handling**
   - Graceful fallback when YouTube API is unavailable
   - Handling deleted/private videos post-link
   - Network timeout recovery

### Research Output

Results consolidated in `research.md` covering:
- Decision on client-side vs server-side API calls
- YouTube URL validation patterns (with test cases)
- Caching strategy (where, how long, invalidation)
- Error handling decision tree
- Rate limiting mitigation approach

---

## Phase 1: Design & Contracts

### 1. Data Model

**Output**: `data-model.md`

Entities:
- **Photo** (extended): Add `tutorial_link` JSONB field (nullable)
- **TutorialLink**: Embedded object within Photo
  - Fields: url (string), videoId (string), title (string), creator (string), channelId (string), thumbnail (URL), duration (seconds), addedAt (ISO timestamp)
  - Validation: videoId must be 11 alphanumeric chars, duration must be positive integer
  - Indexes: None (embedded field, accessed via photo queries)

State Transitions:
- Photo with no tutorial → Add link modal → Fetch metadata → Display on card
- Linked tutorial → Edit link → New video metadata → Update display
- Linked tutorial → Delete link → Remove from display

Relationships:
- Photo 1:1 TutorialLink (optional)
- TutorialLink uniquely tied to single Photo
- When Photo deleted, TutorialLink also deleted (cascade)

---

### 2. Interface Contracts

**Output**: `contracts/` directory

**youtube-api-contract.md**: 
- Input: YouTube URL string
- Process: Extract videoId, fetch metadata via YouTube Data API
- Output: `{videoId, title, creator, channelId, thumbnail, duration}` or error
- Error cases: Invalid URL, API rate limit, video not found, API unavailable
- Retry logic: Exponential backoff (100ms → 500ms → 1000ms), max 3 attempts

**tutorial-link-ui-contract.md**:
- Modal input: YouTube URL text field
- Modal output: Save successful → photo updated with tutorial data
- Card display: Thumbnail, title, creator, duration as readonly
- Interactions: Click → Open YouTube in new tab, Edit → Modal with prefilled URL, Delete → Remove link
- Error display: Toast/inline message near input, user-friendly language

**photo-metadata-contract.md**:
- Supabase `photos` table: Add `tutorial_link` JSONB column (nullable)
- Schema: `{url, videoId, title, creator, channelId, thumbnail, duration, addedAt}`
- Validation rules: videoId length, URL format, duration > 0
- Backward compatibility: Column optional; old photos have NULL value

---

### 3. Quickstart Validation

**Output**: `quickstart.md`

Validation scenarios proving feature works end-to-end:

**Scenario 1: Add Tutorial Link**
```
Setup: User viewing photo detail view
Action: Click "Add Tutorial Link" button
Verify: Modal appears with YouTube URL input field
Action: Paste valid YouTube URL (e.g., https://youtube.com/watch?v=dQw4w9WgXcQ)
Verify: System fetches metadata (title, thumbnail, creator)
Verify: Preview shows in modal before save
Action: Click Save
Verify: Tutorial link appears on photo card
Verify: Tutorial card shows on detail view with clickable link
```

**Scenario 2: View Tutorial Link**
```
Setup: Photo with tutorial link already added
Action: Click tutorial card thumbnail/title
Verify: YouTube video opens in new browser tab
Verify: No errors in browser console
```

**Scenario 3: Edit Tutorial Link**
```
Setup: Photo with tutorial link already added
Action: Click "Edit" on tutorial card
Verify: Modal opens with previous URL prefilled
Action: Paste different YouTube URL
Verify: New metadata fetches and previews
Action: Click Save
Verify: Tutorial link updated on card
Verify: Old thumbnail/title replaced with new video info
```

**Scenario 4: Delete Tutorial Link**
```
Setup: Photo with tutorial link
Action: Click "Delete" on tutorial card
Verify: Tutorial card disappears
Verify: "Add Tutorial Link" CTA appears
Verify: No errors or orphaned data
```

**Scenario 5: Handle Deleted Video**
```
Setup: Photo with tutorial link to a deleted YouTube video
Action: View photo detail
Verify: Tutorial card shows "Video unavailable"
Verify: Link is not clickable
Verify: User can still edit or delete the link
```

---

## Phase 1 Design Decisions

### Decision 1: Client-side vs Server-side YouTube API Call
- **Choice**: Server-side (via Supabase edge functions or backend endpoint)
- **Rationale**: Protects YouTube API key from exposure, handles rate limiting centrally, consistent error handling
- **Alternative**: Client-side fetch (simpler, but requires exposing API key)

### Decision 2: Where to Cache Metadata
- **Choice**: Supabase `tutorial_link` field in `photos` table
- **Rationale**: Persistent cache, no extra storage layer, survives client refresh, survives YouTube API outages
- **Alternative**: Browser localStorage (loses cache on logout, limited size)

### Decision 3: Error Handling Fallback
- **Choice**: If YouTube API fails, allow manual entry of title; queue metadata refresh for later
- **Rationale**: Feature still usable, better UX than blocking
- **Alternative**: Require API availability (worse UX during outages)

### Decision 4: Embedded vs Separate UI
- **Choice**: Embed tutorial card in existing photo detail view (no new page/route)
- **Rationale**: Simpler, consistent with current photo UX, faster to implement
- **Alternative**: Separate tutorials gallery page (Phase 2 scope)

---

## Complexity Tracking

No constitution violations requiring justification. Feature design follows project patterns for modularity, error handling, and testing. No new architectural layers needed.

---

## Next Steps

1. **Phase 0 Complete**: Research findings documented in `research.md`
2. **Phase 1 Complete**: Generate data-model.md, contracts/, quickstart.md
3. **Phase 2 (Next)**: Run `/speckit-tasks` to break down into actionable development tasks
4. **Implementation**: Begin development following task prioritization (P1 stories first)

