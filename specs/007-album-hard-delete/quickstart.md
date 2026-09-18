# Quickstart: Validating Permanent Album Deletion

## Prerequisites

- `npm install` (no new dependencies added by this feature).
- `npm run dev` — the app running at `http://localhost:5173/`, signed in as the single owner account.
- At least one album with a photo, so there's something to delete.

## Automated checks (run first)

```bash
npm test -- tests/unit/db.test.js tests/integration/app.test.js
npm run coverage   # confirm the 80% threshold in vite.config.js still passes (Constitution II)
```

## Manual validation

### §1 Deleting an album actually removes it (P1)

1. Create an album with at least one photo.
2. Note the album's photo appears on Home/My Photos as well as inside the album.
3. Click "Delete" on the album, read the confirmation ("This can't be undone"), and confirm.
4. **Expect**: returned to the Albums list; the deleted album is not present (FR-006; SC-005).
5. Navigate to Home, My Photos, and Favorites.
6. **Expect**: the deleted album's photo appears nowhere (FR-006).
7. If you have access to the Supabase dashboard: confirm the album's row, its photo's row, and its Storage objects (original + thumbnail) are actually gone — not just hidden (FR-001, FR-002; SC-001, SC-002).

### §2 Cancelling changes nothing

1. Click "Delete" on an album, then click Cancel in the confirmation dialog.
2. **Expect**: the album and its photo(s) are completely unaffected — still visible everywhere, still openable (FR-003; SC-003).

### Edge case: retry after a failure

Covered by the automated suite (`tests/unit/db.test.js`'s new hard-delete cases using `_failNextStorageRemoves`/`_failNextTableDeletes`) rather than manually, since it requires injecting a failure at a specific step — not practical to simulate by hand against a live Supabase project. Confirm those tests pass as part of the automated checks above.

## Sign-off

Both sections above pass **and** the automated checks pass with coverage ≥80% ⇒ feature is ready to ship, consistent with `spec.md`'s Success Criteria SC-001–SC-005.
