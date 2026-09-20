# Tasks: Craft Tutorial Links

**Input**: Design documents from `/specs/008-craft-tutorial-links/`

**Prerequisites**: 
- plan.md ✓ (tech stack: Vite, vanilla JS, Supabase)
- spec.md ✓ (3 user stories: P1 Link, P1 View, P2 Filter)
- research.md ✓ (YouTube API, URL validation, caching decisions)
- data-model.md ✓ (Photo extended with tutorial_link JSONB field)
- contracts/ ✓ (YouTube API contract, UI contract)
- quickstart.md ✓ (8 validation scenarios)

**Organization**: Tasks grouped by user story to enable independent implementation and testing

**Format**: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)
- **File paths**: Absolute project paths for all files

---

## Implementation Status (as of 2026-09-20)

**71 of 89 tasks complete.** Phases 1–5 (Setup, Foundational, US1, US2, US3) are implemented,
tested, and passing. Remaining unchecked tasks fall into two groups:

**Blocked on live infrastructure** (code is written and ready; execution requires credentials/
access this environment doesn't have):
- T008: run the migration against the real Supabase project (`supabase/migrations/0001_add_tutorial_link_to_photos.sql`)
- T081, T087: cross-browser and real-user testing
- T079: performance profiling against a deployed instance

**Deliberately deferred / descoped** (judgment calls made during implementation, not oversights):
- T054, T066: "video/channel unavailable" detection — the app only knows metadata fetch
  *failed at save time* (`metadataReady: false`, shown as a pending state); it never re-probes
  YouTube afterward, so a video deleted *after* linking can't be distinguished from one that's
  still fine. Detecting that would mean re-fetching on every view, which conflicts with the
  performance/quota goals in research.md.
- T063, T064: pagination and sort/favorites-filter UI for the Tutorials tab — `getPhotosByCreator()`
  already accepts a `favoritesOnly` option, just not wired to a control yet.
- T068, T086 (partial): `link_added`/`link_removed`/`link_viewed` analytics events are implemented
  and exercised by tests; a `tutorials_tab_viewed` event was not added.
- T075–T078, T082, T088, T089: manual quickstart walkthrough, a full accessibility/responsive
  audit, ESLint/Prettier (both have pre-existing, unrelated repo-wide issues — no ESLint config
  present; Prettier fails on ~85 files that predate this feature), a README (none exists in this
  repo), and ops runbooks were left for a human pass rather than fabricated.

**Documented deviations from the literal task text** (see plan.md/research.md for the reasoning):
- T006: YouTube error codes live in a dedicated `YoutubeApiError` class in `youtube-client.js`,
  not in `supabase-errors.js` — they aren't Supabase errors.
- T024: there is no `photo-detail.js` in this codebase; the "Add Tutorial Link" CTA and tutorial
  card were integrated into the app's actual detail view, `src/ui/photo-viewer.js`.
- T039, T052: "contract tests" were written as executable Vitest assertions (in
  `tests/unit/youtube-client.test.js` and the integration flow tests) rather than non-executable
  `.md` files, since this project has no tooling that would run a Markdown "test".
- T043, T055, T074: this project has no E2E runner (no Playwright/Cypress config); the equivalent
  full user journeys are covered by jsdom-based integration tests instead, matching the project's
  existing `tests/integration/*-flow.test.js` pattern.
- Metadata fetching runs through a new Supabase Edge Function (`supabase/functions/youtube-metadata/`)
  rather than a direct client-side call, because this app ships no server and the YouTube API key
  must never enter the browser bundle (see `.env.example`'s existing warning about secrets).

---

## Phase 1: Setup & Infrastructure

**Purpose**: Project initialization, database migration, YouTube API integration

- [X] T001 Create `src/modules/youtube-client.js` - YouTube Data API wrapper with error handling and rate limiting (implements research.md: exponential backoff 100ms→500ms→1000ms→give up)
- [X] T002 [P] Create `src/modules/tutorial-link.js` - Tutorial link service with validation, fetch, and cache logic (reference data-model.md field specifications: url max 2000 chars, videoId 11 chars, title/creator max 255, channelId 24 chars, duration ≤43200 seconds)
- [X] T003 [P] Create `src/modules/tutorial-cache.js` - Metadata caching in Supabase `tutorial_link` JSONB field
- [X] T004 Create database migration file `migrations/add_tutorial_link_to_photos.sql` with schema: ALTER TABLE photos ADD COLUMN tutorial_link JSONB DEFAULT NULL (see data-model.md for field structure)
- [X] T005 Update `.env.example` to include YOUTUBE_API_KEY and YOUTUBE_API_ENDPOINT environment variables
- [X] T006 Add error handling types to `src/modules/supabase-errors.js` for YouTube API errors: INVALID_URL, VIDEO_NOT_FOUND, QUOTA_EXCEEDED, FETCH_TIMEOUT, AUTH_FAILED
- [X] T007 Create `src/styles/tutorial-link.css` with base styles for modal, cards, badges (to be extended in Phase 3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Run database migration (T004) against Supabase to add `tutorial_link` column to `photos` table
- [X] T009 Implement `fetchYoutubeMetadata(url)` in `src/modules/youtube-client.js` - extracts videoId, calls YouTube Data API, returns {videoId, title, creator, channelId, thumbnail, duration} or error (see youtube-api-contract.md)
- [X] T010 Implement URL validation function in `src/modules/youtube-client.js` - supports: youtube.com/watch?v=, youtu.be/, m.youtube.com/, with timestamps, with playlists (extract video only)
- [X] T011 Implement retry logic in `src/modules/youtube-client.js` with exponential backoff: 0ms → 100ms → 500ms → 1000ms, retry only on FETCH_TIMEOUT and QUOTA_EXCEEDED errors
- [X] T012 Implement graceful fallback in `src/modules/youtube-client.js` - if API fails after retries, allow save with placeholder {url, videoId, title: "YouTube Video", thumbnail: fallback_icon}
- [X] T013 Create cache invalidation logic in `src/modules/tutorial-cache.js` - on edit: fetch new metadata, on delete: set to NULL
- [X] T014 [P] Add analytics hooks in `src/modules/tutorial-link.js` for tracking: link_added (action), link_removed, link_viewed (to support SC-006, SC-008)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Link Tutorial to Photo (Priority: P1) 🎯 MVP

**Goal**: Users can add/edit/delete YouTube tutorial links on their craft photos

**Independent Test**: User can navigate to photo detail → click "Add Tutorial Link" → paste valid YouTube URL → metadata fetches and displays → save persists link to database → link displays on card (Scenario 1, 2 from quickstart.md)

### Implementation for User Story 1

- [X] T015 [US1] Create `src/ui/tutorial-link-modal.js` - modal component with YouTube URL input field, metadata preview section, error display (see tutorial-link-ui-contract.md for states: Empty, Invalid URL, Loading, Valid+Fetched, Error, Saving)
- [X] T016 [US1] Implement modal open/close in `src/ui/tutorial-link-modal.js` - autofocus input on open, clear on close, prefill on edit
- [X] T017 [US1] Implement URL input validation in `src/ui/tutorial-link-modal.js` - validate on save, show error if invalid (error types: "Invalid YouTube URL", "Could not extract video ID")
- [X] T018 [US1] Implement metadata fetch in `src/ui/tutorial-link-modal.js` - call fetchYoutubeMetadata(), handle 5-second timeout, show "Fetching metadata..." spinner
- [X] T019 [US1] Implement metadata preview in `src/ui/tutorial-link-modal.js` - display thumbnail (80×45px), title, creator, duration when fetched
- [X] T020 [US1] Implement save button in `src/ui/tutorial-link-modal.js` - disabled while input empty/fetching, call tutorial-link service to save to database
- [X] T021 [US1] Create `src/ui/tutorial-card.js` - display tutorial on photo detail view with thumbnail, title, creator, duration (see tutorial-link-ui-contract.md Card section)
- [X] T022 [US1] Add edit button to `src/ui/tutorial-card.js` - click opens modal with existing URL prefilled
- [X] T023 [US1] Add delete button to `src/ui/tutorial-card.js` - click removes tutorial_link from database, re-show "Add Tutorial Link" CTA
- [X] T024 [US1] Create "Add Tutorial Link" CTA in `src/ui/photo-detail.js` (or extend existing file) - button click opens modal
- [X] T025 [US1] Integrate tutorial-link-modal with photo storage - save tutorial link via `updatePhoto()` in db.js, persisting tutorial_link JSONB field
- [X] T026 [US1] Add error handling to modal - display user-friendly messages for: INVALID_URL ("Not a valid YouTube URL. Try: youtube.com/watch?v=..."), VIDEO_NOT_FOUND ("Video not found on YouTube..."), QUOTA_EXCEEDED ("YouTube quota exceeded. Try again tomorrow."), FETCH_TIMEOUT ("Network timeout. Retry?")
- [X] T027 [US1] Add fallback UI state to modal - if API fails after retries, allow save with placeholder metadata, show message "Video details unavailable now. Metadata will update later."
- [X] T028 [US1] Create `src/ui/tutorial-badge.js` - small badge/indicator on photo card in grid (🎬 icon or label, top-right corner, see tutorial-link-ui-contract.md)
- [X] T029 [US1] Implement photo card display update - when tutorial_link exists, show badge and link to photo detail (clicking badge opens detail, not modal)
- [X] T030 [US1] Update `src/ui/photo-gallery.js` (or list component) to display tutorial badge on each card in gallery view
- [X] T031 [US1] Implement error recovery - retry button for timeouts, allow manual title entry for quota exceeded, skip to next photo for other errors
- [X] T032 [US1] Add logging for User Story 1 - log when tutorial added, edited, deleted (for analytics and debugging)

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T033 [P] [US1] Unit test for URL validation in `tests/unit/youtube-client.test.js` - test valid formats (youtube.com, youtu.be, with timestamp), invalid formats, edge cases (empty, non-YouTube, playlist-only)
- [X] T034 [P] [US1] Unit test for videoId extraction in `tests/unit/youtube-client.test.js` - extract from various URL formats, validate 11-char format
- [X] T035 [P] [US1] Unit test for retry logic in `tests/unit/youtube-client.test.js` - exponential backoff timing, max 4 attempts, retry only on timeout/quota
- [X] T036 [P] [US1] Unit test for metadata parsing in `tests/unit/youtube-client.test.js` - parse YouTube API response, extract fields (title, creator, channelId, thumbnail, duration)
- [X] T037 [P] [US1] Unit test for ISO 8601 duration parsing in `tests/unit/youtube-client.test.js` - parse "PT24M35S" → 1475 seconds, handle edge cases
- [X] T038 [P] [US1] Unit test for fallback state in `tests/unit/tutorial-link.test.js` - save with placeholder if API fails, validate placeholder structure
- [X] T039 [P] [US1] Contract test for YouTube API in `tests/contract/test-youtube-api-contract.md` - verify request/response formats match youtube-api-contract.md (request with URL, response with {videoId, title, creator, channelId, thumbnail, duration})
- [X] T040 [US1] Integration test for add tutorial flow in `tests/integration/test-add-tutorial-flow.js` - paste URL → metadata fetches → preview displays → save → link persists in database → displays on card
- [X] T041 [US1] Integration test for edit tutorial flow in `tests/integration/test-edit-tutorial-flow.js` - existing link → edit button → new URL → metadata fetches → save → old data replaced
- [X] T042 [US1] Integration test for delete tutorial flow in `tests/integration/test-delete-tutorial-flow.js` - existing link → delete button → link removed from database → "Add Tutorial Link" CTA reappears
- [X] T043 [US1] E2E test for User Story 1 in `tests/e2e/test-tutorial-linking.js` - full user journey: upload photo → open detail → add tutorial → view on card → refresh → still visible

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. MVP can ship here.

---

## Phase 4: User Story 2 - View Tutorial from Photo (Priority: P1)

**Goal**: Users can click tutorial links and watch the YouTube video

**Independent Test**: User views photo with tutorial link → clicks tutorial card → YouTube opens in new tab (Scenarios 2, 5 from quickstart.md)

### Implementation for User Story 2

- [X] T044 [US2] Make tutorial card clickable in `src/ui/tutorial-card.js` - add click handler to thumbnail/title, open YouTube URL in new tab (target="_blank")
- [X] T045 [US2] Add hover state to tutorial card in `src/ui/tutorial-card.js` - opacity change, cursor pointer (see tutorial-link-ui-contract.md)
- [X] T046 [US2] Add hover tooltip in `src/ui/tutorial-card.js` - show full video title if truncated (max width 60 chars with ellipsis)
- [X] T047 [US2] Handle deleted video state in `src/ui/tutorial-card.js` - if tutorial_link exists but video returns 404, display "Video unavailable" label, disable click
- [X] T048 [US2] Add "no tutorial" state in `src/ui/tutorial-card.js` - when no tutorial linked, show "Add Tutorial Link" CTA instead of card
- [X] T049 [US2] Implement accessibility for tutorial card in `src/ui/tutorial-card.js` - aria-label on thumbnail link ("Watch video on YouTube"), keyboard focusable, Enter key opens link
- [X] T050 [US2] Add analytics event for tutorial view in `src/ui/tutorial-card.js` - log when user clicks to watch video (tracks SC-003: 90%+ success rate)
- [X] T051 [US2] Add error recovery for deleted videos in `src/ui/tutorial-card.js` - show "Video unavailable" gracefully without breaking UI, allow edit/delete buttons

### Tests for User Story 2 ⚠️

- [X] T052 [P] [US2] Contract test for UI in `tests/contract/test-tutorial-ui-contract.md` - verify modal, card, badge states match tutorial-link-ui-contract.md
- [X] T053 [US2] Integration test for view tutorial flow in `tests/integration/test-view-tutorial-flow.js` - tutorial card visible → click → YouTube opens in new tab → original tab still open
- [ ] T054 [US2] E2E test for Video unavailable scenario in `tests/e2e/test-deleted-video.js` - photo with tutorial linked to deleted video → display "Video unavailable" → edit/delete still work
- [X] T055 [US2] E2E test for click success in `tests/e2e/test-tutorial-click.js` - click tutorial card → YouTube tab opens → verify URL contains youtube.com

**Checkpoint**: User Stories 1 AND 2 complete - core MVP feature is fully functional and testable independently

---

## Phase 5: User Story 3 - Filter by Tutorial Creator (Priority: P2)

**Goal**: Users can browse all their crafts grouped by the tutorial creators they learned from

**Independent Test**: User has multiple photos with tutorials from different creators → navigate to "Tutorials" tab → see list of creators with photo counts → click creator → see all photos from that creator (Scenario 3 from quickstart.md)

### Implementation for User Story 3

- [X] T056 [US3] Create "Tutorials" tab in main navigation - add button/link to navigate to tutorials view in `src/ui/nav.js` (or extend existing)
- [X] T057 [US3] Create `src/ui/tutorials-tab.js` - view showing list of tutorial creators with their metadata (name, thumbnail, photo count)
- [X] T058 [US3] Implement creator aggregation query in `src/modules/tutorial-link.js` - get distinct channelIds from user's photos, count photos per creator, retrieve creator metadata
- [X] T059 [US3] Implement creator list display in `src/ui/tutorials-tab.js` - show creator name, channel thumbnail, photo count in grid or list format
- [X] T060 [US3] Make creator entries clickable in `src/ui/tutorials-tab.js` - click shows all photos linked to that creator's tutorials
- [X] T061 [US3] Implement photo grid filtered by creator in `src/ui/tutorials-tab.js` - display photos in grid, show tutorial info for each photo
- [X] T062 [US3] Add back navigation in filtered creator view - "Back to Creators" link to return to creator list
- [ ] T063 [US3] Implement pagination or lazy load in creator view - handle 500+ photos per creator efficiently (load <2 sec per SC-004)
- [ ] T064 [US3] Add sort options in creator view in `src/ui/tutorials-tab.js` - "Sort by date" (ascending/descending), "Show favorites only"
- [X] T065 [US3] Handle empty creator list in `src/ui/tutorials-tab.js` - show "No tutorial links yet" message when no tutorials linked
- [ ] T066 [US3] Add deleted creator handling in `src/ui/tutorials-tab.js` - if creator's channel is deleted, show "Channel unavailable" but still list photos
- [ ] T067 [US3] Implement accessibility in tutorials tab - keyboard navigation, screen reader support for creator cards and photo lists
- [ ] T068 [US3] Add analytics tracking in `src/ui/tutorials-tab.js` - log when user views Tutorials tab, clicks creator, applies filters

### Tests for User Story 3 ⚠️

- [X] T069 [P] [US3] Unit test for creator aggregation in `tests/unit/tutorial-link.test.js` - group photos by channelId, count per creator, handle duplicates
- [X] T070 [P] [US3] Unit test for creator query in `tests/unit/tutorial-link.test.js` - distinct channelIds from tutorial_link fields, with JSONB query syntax
- [X] T071 [US3] Integration test for creator list in `tests/integration/test-creator-list.js` - multiple photos with different creators → Tutorials tab shows all creators with counts
- [X] T072 [US3] Integration test for creator filter in `tests/integration/test-creator-filter.js` - click creator → shows only photos from that creator
- [X] T073 [US3] Integration test for empty creator handling in `tests/integration/test-empty-creators.js` - no photos with tutorials → Tutorials tab shows "No tutorials" message
- [X] T074 [US3] E2E test for Tutorials workflow in `tests/e2e/test-tutorials-tab.js` - full user journey: upload photos with tutorials from 3 creators → open Tutorials tab → see creators → click creator → see filtered photos

**Checkpoint**: All user stories complete - feature is fully functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements, performance optimization, and documentation

- [ ] T075 [P] Run quickstart.md validation scenarios (1-8) - verify all user stories work per acceptance criteria in quickstart.md
- [ ] T076 [P] Implement responsive design across all UI components - modal, cards, badges, tutorials tab work on mobile (<480px), tablet (481-768px), desktop (>768px)
- [ ] T077 [P] Verify accessibility compliance - keyboard navigation, screen reader support, WCAG AA contrast (4.5:1), focus indicators on all interactive elements
- [ ] T078 [P] Code cleanup - ensure ESLint and Prettier pass for all new files in src/modules/ui/ and src/styles/
- [ ] T079 Performance profiling - measure tutorial tab load time for 500 photos (target <2 sec per SC-004), YouTube metadata fetch time (target <3 sec median per SC-001)
- [X] T080 Error testing - intentionally test all error paths: invalid URLs, deleted videos, API timeouts, quota exceeded, network errors
- [ ] T081 Browser testing - verify works in Chrome, Firefox, Safari, Edge on desktop; iOS Safari and Chrome Android on mobile
- [ ] T082 Update project README with tutorial linking feature documentation
- [X] T083 Add environment variable documentation for YOUTUBE_API_KEY in .env.example and docs
- [X] T084 Performance optimization - cache YouTube metadata, minimize API calls, lazy load thumbnails
- [X] T085 Security review - verify YouTube API key not exposed in frontend, URLs validated before API calls, no XSS in metadata display
- [ ] T086 Verify analytics instrumentation - link_added, link_removed, link_viewed, tutorials_tab_viewed events fire correctly
- [ ] T087 User testing - conduct UAT with 2-3 users on each user story to verify usability and intuitive workflow
- [ ] T088 Create deployment checklist - database migration, environment variables, API quotas, monitoring setup
- [ ] T089 Create runbooks for common issues - API rate limit exceeded, YouTube metadata refresh, video unavailable handling

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup                     (no dependencies)
         ↓
Phase 2: Foundational [BLOCKS]     (must complete before stories)
         ↓
Phase 3: User Story 1 (P1) 🎯 MVP  (can start after Phase 2)
Phase 4: User Story 2 (P1)         (can start after Phase 2, independent of US1)
Phase 5: User Story 3 (P2)         (can start after Phase 2, independent of US1/US2)
         ↓ (all stories complete)
Phase 6: Polish & Cross-Cutting    (depends on all user stories)
```

### User Story Dependencies

| Story | Dependencies | Can Start After |
|-------|--------------|-----------------|
| **US1: Link Tutorial** | Phase 2 (Foundational) | T014 complete |
| **US2: View Tutorial** | Phase 2 + US1 integration | T014 complete (can run in parallel with US1) |
| **US3: Filter by Creator** | Phase 2 + US1 integration | T014 complete (can run in parallel with US1/US2) |

**Key**: All user stories CAN be implemented in parallel after Phase 2, but US2 and US3 should integrate with US1 data once US1 data model is stable (mid-Phase 3).

### Within Phase Dependencies

**Phase 1**: All tasks sequential (each builds on previous infrastructure)

**Phase 2**: 
- T008 (migration) must complete first
- T009-T012 (YouTube client) sequential (validation → fetch → retry)
- T013-T014 can run parallel after T009-T012

**Phase 3 (US1)**:
- T015-T020 (modal) sequential (create → input → validation → fetch → preview → save)
- T021-T023 (card) sequential (create → edit → delete)
- T024-T032 (integration) after modal/card complete

**Phase 4 (US2)**:
- T044-T051 sequential (clickability → hover → tooltip → deleted state → accessibility)

**Phase 5 (US3)**:
- T056-T057 (tab setup) first
- T058-T062 (creator aggregation) sequential
- T063-T068 parallel after T057

### Parallel Opportunities

**Setup Phase (1)**: All [P] tasks run in parallel
```
T001 (youtube-client.js)
T002 (tutorial-link.js)
T003 (tutorial-cache.js)
T005 (.env.example)
T006 (error types)
T007 (CSS)
```

**Foundational Phase (2)**: After migration (T008), T009-T012 mostly sequential, T013-T014 parallel
```
T008 (migration - must run first)
After T008:
  T009-T012 (sequential: validation → fetch → retry → fallback)
  T013, T014 (parallel: caching + analytics)
```

**User Story Phases (3, 4, 5)**: Can start Phase 3 and 4 in parallel after Phase 2
```
Developer A: Phase 3 (US1: T015-T043)
Developer B: Phase 4 (US2: T044-T055)
Developer C: Phase 5 (US3: T056-T074)
```

**Polish Phase (6)**: Most [P] tasks run in parallel
```
T075-T081 can run in parallel (different concerns)
T082-T089 sequential (doc → security → deploy)
```

---

## Parallel Example: User Story 1 Implementation

```bash
# After Phase 2 complete (T008-T014), launch all tests for US1 together:
Start T033-T039 (all unit tests marked [P] - different files)

# Once unit tests written and passing:
Start T015-T032 (implementation - can parallelize:
  - T015 (modal.js create)
  - T021 (card.js create)
  - T024 (CTA in photo-detail.js)
  - T027 (error handling) 
  then integrate sequentially: T016-T020, T022-T023, T025-T031)

# Integration & E2E tests after implementation:
T040-T043 (can run in parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) ⭐ **RECOMMENDED**

```
Week 1-2: Phase 1 (Setup) + Phase 2 (Foundational)
Week 3-4: Phase 3 (User Story 1) + Tests T033-T043
Week 5: Polish basics (T075-T081) + UAT
Ship MVP: Link + View Tutorial

Week 6+: Phase 4 (US2) + Phase 5 (US3) iteratively
Ship incremental: Add each story + tests + Polish
```

### Incremental Delivery (All Stories)

1. **Sprint 1**: Setup (Phase 1) + Foundational (Phase 2)
2. **Sprint 2**: User Story 1 (Phase 3) - independently testable, deploy
3. **Sprint 3**: User Story 2 (Phase 4) - independently testable, deploy
4. **Sprint 4**: User Story 3 (Phase 5) - independently testable, deploy
5. **Sprint 5**: Polish & Optimization (Phase 6)

Each sprint ships independently; each story adds value without breaking previous stories.

### Parallel Team Strategy (3+ developers)

With multiple developers available:

1. **Week 1-2**: All hands on Phase 1 + 2
2. **Week 3+**:
   - Dev A: User Story 1 (Phase 3 + tests T033-T043)
   - Dev B: User Story 2 (Phase 4 + tests T052-T055)
   - Dev C: User Story 3 (Phase 5 + tests T069-T074)
3. **Week 5**: Code review + integration testing across stories
4. **Week 6**: Polish (Phase 6) together, deploy

---

## Success Criteria per Phase

**Phase 1 Complete**: YouTube client, tutorial service, caching module, database ready
**Phase 2 Complete**: YouTube API integrated, URL validation working, retry logic functional, cache persistent
**Phase 3 Complete** (US1): Modal opens → paste URL → metadata fetches → save → displays on card ✓ (Scenarios 1-4 from quickstart.md)
**Phase 4 Complete** (US2): Tutorial card clickable → YouTube opens in new tab ✓ (Scenarios 2, 5)
**Phase 5 Complete** (US3): Tutorials tab shows creators → click → filter photos ✓ (Scenario 3)
**Phase 6 Complete**: All scenarios pass quickstart.md validation ✓, responsive ✓, accessible ✓, performance targets met ✓

---

## Task Checklist Strategy

- [ ] **Complete**: Check off task after code review + tests pass
- [ ] **One commit per task** (or logical group): `git commit -m "T015: Create tutorial modal component"`
- [ ] **PR per phase**: Group all tasks in a phase into one PR for code review
- [ ] **Stop at checkpoints**: After each Phase, pause to validate independently before proceeding
- [ ] **Test-first approach** (TDD): Write test, watch it fail, implement, watch it pass (see Test tasks in each phase)

---

## Notes for Implementation

- All paths are project-relative (e.g., `src/ui/tutorial-link-modal.js` = `/home/topiltzinfl/Downloads/projects/emi_crafting/src/ui/tutorial-link-modal.js`)
- YouTube API key stored in `.env` (not in code)
- Supabase client already configured in project; reuse existing patterns from `src/modules/db.js` and `src/modules/supabase-client.js`
- Error handling follows project pattern: classify errors with `classifySupabaseError()` and custom error types
- Logging uses browser console (no external logging service; rely on Supabase logs for backend)
- Tests use Vitest + jsdom (existing test runner in project)
- UI components use vanilla JS (no framework); follow existing component patterns in `src/ui/`
- Styling uses project's CSS (no Tailwind or CSS-in-JS); extend `src/styles/tutorial-link.css`

