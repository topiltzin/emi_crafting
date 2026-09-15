# Phase 1 Data Model: Gallery UX Reliability & Polish Fixes

This feature makes **no changes to the persisted SQLite schema** (`Albums`, `Photos`, `AlbumOrder` in `src/modules/db.js` are all unchanged — confirmed no `Settings`-style table exists today, and none is added). Everything below is either a UI-only transient concept or a single new device-local preference stored outside the database.

## Appearance Preference (new, `localStorage`-backed — not in SQLite)

Represents the user's chosen light/dark/system appearance for the app on this device.

| Field | Type | Notes |
|---|---|---|
| `theme` | `'light' \| 'dark' \| 'system'` | Stored under a single `localStorage` key (e.g. `emi-craft-theme`). Default `'system'` when the key is absent, which reproduces today's behavior (follow OS `prefers-color-scheme`) exactly — no existing user's appearance changes until they explicitly pick something in Settings. |

**Validation rules**: Only the three literal values above are valid; any other/unreadable stored value (corrupted storage, manual edit) is treated as `'system'`.

**State transitions**: `system → light`, `system → dark`, `light ↔ dark`, and back to `system`, all via the new Settings control (US6). No transition is destructive — switching appearance never touches gallery data (`Photo`/`Album`), and can be changed again at any time.

**Relationship to existing entities**: None. This is a device/UI-level setting, deliberately kept out of the SQLite database (see `research.md` item 6) — it has no foreign key or association to `Photo` or `Album`, and is not included in any future export/import of gallery data.

## Pending Upload Selection (UI-only, transient, not persisted)

Represents the in-progress set of files a user has selected/dropped in the Add Photos dialog before confirming. Already exists today as local state inside `attachUploadZoneEvents()` (`pendingFiles` / `pendingUrls` arrays); this feature does not change its shape, only when its derived UI state (confirm button disabled, actions hidden) is first computed.

| Field | Type | Notes |
|---|---|---|
| `pendingFiles` | `File[]` | Unchanged shape. |
| `pendingUrls` | `string[]` (object URLs) | Unchanged shape, one per pending file, for thumbnail preview. |
| `rejectedFileNames` | `string[]` | **NEW**, transient, cleared on next add/cancel. Populated by `addFiles()` with the names of any files filtered out for not being an image type, so the dialog can render "X wasn't added — only photo files are supported" instead of silently dropping them. |

**Validation rules**: A file is accepted into `pendingFiles` iff `file.type.startsWith('image/')` (unchanged filter, see `research.md` item 4); otherwise its name is appended to `rejectedFileNames`.

**Derived UI state** (this is the actual bug being fixed): confirm-button `disabled` and the visibility of the confirm/cancel action row and pending-thumbnail grid are both derived from `pendingFiles.length === 0`, and — as of this feature — that derivation runs once at dialog-open time in addition to on every add/remove, so the dialog never renders in a state where the derived value hasn't been computed yet.

## Delete Confirmation Request (UI-only, transient, not persisted)

Represents the pending "are you sure" state between a user clicking Delete and either confirming or cancelling. Exists only in memory for the lifetime of the confirmation dialog. **This state already exists today** as the argument to the three `window.confirm(...)` call sites in `album-grid.js`/`album-view.js`/`photo-gallery.js` (see `research.md` item 3's correction) — this feature replaces that native call with an in-app dialog carrying the same information, not introduces confirmation for the first time.

| Field | Type | Notes |
|---|---|---|
| `targetType` | `'photo' \| 'album'` | Which delete flow triggered the dialog. |
| `targetId` | `number` | The `Photo.id` or `Album.id` to be deleted, unchanged shape from the existing entities. |
| `targetLabel` | `string` | Photo filename, or album title/date, read from the already-fetched `Photo`/`Album` object the Delete button was rendered from — no new query. |
| `photoCount` | `number \| null` | Only set for `targetType: 'album'`; read directly from the existing `Album.photo_count` field (`research.md` item 3) to render "this will also remove N photos." `null`/omitted for a single-photo delete. |

**Validation rules**: None beyond what the existing `deletePhoto(photoId)` / `deleteAlbum(albumId)` functions already validate (they throw `'Photo not found'` / `'Album not found'` if the id doesn't resolve — unchanged).

**State transitions**: `shown → confirmed` (calls the existing, unchanged `deletePhoto`/`deleteAlbum` with `hard = false`, i.e. soft-delete via `deleted_at`, exactly as today) or `shown → cancelled` (dialog closes, no database call is made, no state changes) — both transitions are unchanged from today's `window.confirm()`-gated behavior. This feature replaces the *presentation* of that already-existing gate with an in-app dialog; it does not change what deletion itself does, nor add a gate that wasn't there.

## Navigation Icon (UI-only, static — not persisted, not user-configurable)

Represents the association between a nav section and its icon glyph, already modeled as the `icon` field on each entry in the `SECTIONS` array in `src/ui/nav.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | `'home' \| 'photos' \| 'albums' \| 'favorites' \| 'settings'` | Unchanged. |
| `label` | `string` | Unchanged. |
| `icon` | `string` (emoji today) → inline SVG markup string | **Changed type**, same field. Still rendered inside the existing `<span aria-hidden="true">` wrapper (already present and correct — see `research.md` item 5), so no accessibility-tree change, only a visual/markup one. |
