# Quickstart: Validate Cloud Data Migration

Validates the feature end-to-end against the design in `data-model.md` and `contracts/`. Assumes a Supabase project already exists (per spec Assumptions) — this guide sets up the schema and one owner account against it, then walks through the acceptance scenarios from `spec.md`.

## Prerequisites

- Node.js + this repo's existing `npm install` toolchain.
- A Supabase project (URL + publishable/anon key). **Never** put the secret/service key in `.env` files loaded by the browser build — it is not needed by this feature at all (see research.md §1).
- Supabase CLI installed locally, for the local dev stack used in integration tests (`supabase --version`).

## 1. Configure environment

Create `.env.local` (already git-ignored) with only the browser-safe values:

```
VITE_SUPABASE_URL=<your project URL>
VITE_SUPABASE_ANON_KEY=<your publishable/anon key>
```

## 2. Apply the schema contract

Run `contracts/schema.sql` against the project (Supabase SQL editor, or `supabase db push` if using CLI migrations), and create the Storage bucket as noted in that file's comment (`photos`, private).

## 3. Create the single owner account

Create exactly one Supabase Auth user (e.g. via the dashboard or `supabase auth`) — this is the account the app signs in as. Record its credentials for the app's sign-in step (mechanism is an implementation detail of the auth flow, out of scope for this guide).

## 4. Run the app

```
npm run dev
```

Sign in as the owner account when prompted, then validate each user story below.

## 5. Validate User Story 1 — data survives the browser

1. Create an album, upload 2–3 photos, mark one favorite.
2. Open browser devtools → Application → clear IndexedDB and local storage for the site.
3. Reload the app. **Expected**: the same album/photos/favorite state reappear (SC-001, SC-003) — because they now live in Supabase, not the cleared local storage.
4. Open the app in a second browser (or a private window signed into the same owner account). **Expected**: same data visible with no export/import step (SC-002).
5. With devtools' network conditions set to "Offline," reload the app. **Expected**: a clear "can't reach your photo library" message appears within ~3 seconds (FR-007, SC-005) — not an empty gallery.

## 6. Validate User Story 2 — existing local data migrates

1. On a fresh browser profile, run the app against a build of the **previous** (pre-Supabase) version to populate local IndexedDB with albums/photos (or seed it directly via the old `db.js` API in a scratch script).
2. Switch to the Supabase-backed build and load the app. **Expected**: the migration runs automatically and all previously-local albums/photos appear, unmodified (FR-004, SC-001).
3. Simulate a partial failure: interrupt the migration (e.g. throttle/drop network mid-run via devtools) and reload. **Expected**: no local data was deleted, the app reports the migration is incomplete, and reloading resumes without re-uploading already-migrated photos or creating duplicates (FR-005, FR-006, FR-010).

## 7. Validate User Story 3 — everyday operations are unchanged

Run through the existing manual/regression checklist against the Supabase-backed app: create album, upload photo, toggle favorite, drag-and-drop reorder albums, soft-delete + restore an album and a photo. **Expected**: identical outcomes to the pre-migration app (FR-003).

## 8. Automated checks

```
npm test           # unit + integration suite (Supabase calls mocked at the db.js boundary)
npm run lint
npm run coverage    # must stay ≥80% per the constitution gate
```

For the subset of integration tests that exercise real schema/RLS behavior (per research.md §5):

```
supabase start      # local Postgres + Storage emulator
npm test -- --run tests/integration/supabase-*    # naming convention for the new RLS/schema tests
```

## Success check

All of the above match `spec.md`'s Success Criteria (SC-001 through SC-006) and every acceptance scenario in User Stories 1–3 passes.
