# Phase 0 Research: Cloud Data Migration (Supabase)

## 1. Access control for a single-owner client-only app

**Decision**: Use Supabase Auth (email + password, one user) to establish an authenticated session in the browser, paired with Postgres Row Level Security (RLS) policies on `albums` and `photos` that only allow reads/writes where `owner_id = auth.uid()`. The publishable (anon) key is the only Supabase key shipped to the browser.

**Rationale**: FR-009 requires access restricted to a single personal account, not a shared passcode or multi-user system. Supabase Auth + RLS gives that with no project-owned backend: the anon key alone can't read/write anything once RLS is enabled, so possession of the public URL/key does not expose the photos. This satisfies the "single personal account" answer from spec clarification without adding a second service.

**Alternatives considered**:
- *Shared anon key with open table access (no RLS)*: rejected — this is the "shared passcode" model the user explicitly declined, and would expose all photos to anyone with the anon key (which is not secret).
- *Route all data access through a server using the secret key*: rejected — would require standing up and hosting a backend service the app doesn't otherwise need, violating the Simplicity gate for a single-user app Supabase already secures via RLS.

## 2. Where photo binaries live

**Decision**: Store original photo files and thumbnails as objects in a private Supabase Storage bucket (e.g. `photos`), with `photos.storage_path` / `photos.thumbnail_storage_path` columns in Postgres pointing to them. The client fetches images via Supabase's authenticated Storage download (or short-lived signed URLs), scoped by the same RLS-equivalent Storage policies (owner-only access).

**Rationale**: The current implementation stores full photos as base64 text in the SQL database, which the spec's Assumptions section explicitly leaves open to change ("stored in a way appropriate for binary image data"). Object storage is the standard fit for binary assets, avoids bloating Postgres row/page sizes, and keeps upload/download performance in line with SC-004.

**Alternatives considered**:
- *Keep base64 in a Postgres column (`photo_data_base64`), same as today*: rejected as the long-term design — carries forward a known anti-pattern (33% size inflation, slow row scans) into the new system for no benefit, though the migration step (§3) still reads the old base64 format from local IndexedDB as its input.

## 3. Migrating existing local data without loss or duplication

**Decision**: On app start, before rendering the gallery, check for a local "migration complete" flag. If absent and a local sql.js/IndexedDB database exists, run a migration routine that: (a) opens the existing local database read-only, (b) walks Albums → Photos, (c) for each photo not yet present in a local "already-migrated" ledger (keyed by a stable identifier derived from the local row, e.g. `local:<album_date>:<filename>:<upload_date>`), uploads its binary data to Storage and inserts/updates the corresponding Postgres rows, recording success in the ledger immediately after each photo. Local data is left untouched until the entire pass completes successfully, at which point the "migration complete" flag is set; local data is never deleted by this feature. If the pass is interrupted, re-running it resumes using the ledger, skipping already-migrated photos (no duplicates) and retrying the rest.

**Rationale**: Directly implements FR-004/005/006/010 and the corresponding edge cases (partial failure, retry duplication, large libraries). Per-photo ledger entries make progress resumable and let the UI show incremental progress rather than an all-or-nothing operation, addressing the "large collection" edge case.

**Alternatives considered**:
- *Single all-or-nothing transaction for the whole migration*: rejected — a failure on photo 900 of 1000 would force re-uploading all 1000 on retry, and provides no progress feedback for large libraries.
- *Manual export/import file the user re-imports*: rejected — FR-004 requires this to happen without the user manually re-uploading anything.

## 4. Surfacing connectivity/auth failures

**Decision**: Wrap Supabase calls in the data-access module with error handling that distinguishes network/timeout errors from auth/permission errors, and re-use the app's existing `showError()` alert-banner pattern (`src/app.js`) to display a clear, specific message (e.g. "Can't reach your photo library — check your connection and try again"). No new UI component is introduced.

**Rationale**: FR-007 and SC-005 require a clear, fast (<3s) message instead of a silent or generic failure. The app already has a working error-banner convention used consistently across album/photo/upload flows, so reusing it satisfies the User Experience Consistency gate.

**Alternatives considered**:
- *New toast/notification component*: rejected — no functional gap justifies it; would be scope beyond what the feature needs (Simplicity gate).

## 5. Testing strategy against a managed external service

**Decision**: Keep all Supabase calls behind the `db.js` data-access module (same exported function names/signatures as today). Existing unit/integration tests continue to mock this module exactly as they mock today's sql.js-backed version. Add a small number of new integration tests that run against Supabase's local development stack (`supabase start`, documented in quickstart.md) to verify real schema constraints and RLS behavior end-to-end; these are not run against the hosted project or with production credentials.

**Rationale**: Preserves the existing test suite's structure and the 80% coverage gate without any test needing live network access to the hosted Supabase project (avoiding flakiness/cost/secret exposure in CI), while still getting real verification of RLS and schema constraints locally.

**Alternatives considered**:
- *Mock the `@supabase/supabase-js` client at the network layer in every test*: rejected as the sole strategy — it would never catch real RLS/schema mistakes, which is exactly the class of bug most likely with this migration.
- *Run all tests against the live hosted project*: rejected — slow, costly, and requires distributing credentials to CI.

## Outcome

All unknowns from the Technical Context are resolved; no `NEEDS CLARIFICATION` markers remain.
