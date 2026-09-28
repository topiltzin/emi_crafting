# Contract: Browser Module and UI

**Feature**: 009-photo-to-3d-model

## `src/modules/model-conversion.js`

All functions throw errors that are classified the same way as the rest of the app (`supabase-errors.js`: `code: 'network' | 'auth' | 'validation' | ...`). RPC business errors come back as `validation` errors whose `.reason` is the RPC code (`CONVERSION_LIMIT`, and so on).

| Function | Returns | Notes |
|---|---|---|
| `requestConversion(photoId)` | `Promise<ConversionJob>` | Calls the `request_model_conversion` RPC. |
| `getLatestConversion(photoId)` | `Promise<ConversionJob \| null>` | See database.md, "Latest job for a photo". |
| `getDisplayStatus(photo, job, now = Date.now())` | `'none' \| 'queued' \| 'processing' \| 'ready' \| 'failed'` | A pure function. It returns `failed` for an active job older than 10 minutes (research R7), and `ready` when `photo.model_storage_path` is set and there is no newer active or failed job. |
| `watchConversion(photoId, onUpdate, { intervalMs = 5000 })` | `() => void` (stop) | Polls `getLatestConversion` and calls `onUpdate(job)` whenever the status changes. It stops by itself once the job reaches a terminal status. The caller **must** call the returned stop function when the viewer closes. |
| `getModelUrl(photo)` | `Promise<string>` | Signed URL (1 h) for `photo.model_storage_path`. |
| `getModelDownloadUrl(photo)` | `Promise<string>` | Signed URL with `download: '<photo filename without extension>-3d.glb'` (FR-017). |
| `removeModel(photo)` | `Promise<Photo>` | Deletes the Storage object first, then nulls the columns. Returns the updated photo (FR-013). |
| `describeConversionError(job)` | `string` | Returns the job's `error_message`, or generic text if there is none. |

`ConversionJob` is a row of `model_conversions` (data-model.md).

## `src/modules/db.js` changes

- `deletePhoto(id, hard=true)` and `deleteAlbum(id, hard=true)`: add `model_storage_path` to the paths removed. Also list `<owner>/<photo>/` in Storage and remove any `model-*.glb` left by in-flight jobs (research R8).
- No other query changes are needed, because photo reads already use `select('*')`.

## UI

### Photo card (`src/ui/photo-card.js`, new `src/ui/model-badge.js`)
- When `photo.model_storage_path` is set, render a sticker-style **"3D"** badge in `.photo-card-media`, next to the tutorial badge. It has `aria-label="Has a 3D model"` (FR-009).

### Photo viewer (`src/ui/photo-viewer.js`, new `src/ui/model-3d-panel.js`)

`createModel3dPanel(photo, { onPhotoChange })` returns `{ element, destroy }`. The viewer mounts it below the image and calls `destroy()` when the dialog closes.

| Display status | What renders |
|---|---|
| `none` | Button **"Make it 3D ✨"**, plus the tip "Works best with one object on a plain background." (spec edge case). One click starts the conversion (SC-001: 2 clicks in total, counting opening the photo). |
| `queued` / `processing` | Disabled button, a spinner, and the text "Making your 3D model… this can take a few minutes. You can keep using the app." (`role="status"`, `aria-live="polite"`) (US1-2, US1-5). |
| `failed` | `describeConversionError(job)` (`role="alert"`) and a **"Try again"** button (US3-1). If an older model exists, it stays viewable. |
| `ready` | A **Photo / 3D** segmented toggle (both are buttons with `aria-pressed`). There is also a **"⋯"** menu with *Redo 3D model*, *Download 3D model*, and *Remove 3D model* (confirmation via the existing `showConfirmDialog`). |

**3D view** (when the toggle is set to 3D):
1. If WebGL is unavailable, show "Your device can't show 3D models, but here's the photo!" and keep the photo visible (US2-4).
2. Otherwise, `await import('@google/model-viewer')` (lazy loaded, research R5) and render `<model-viewer src=signedUrl camera-controls touch-action="pan-y" auto-rotate interaction-prompt="auto" alt="3D model of <filename>">` with a spinner slot until the `load` event fires (US2-3).
3. **"Reset view"** button: `viewer.cameraOrbit = 'auto auto auto'; viewer.fieldOfView = 'auto'; viewer.jumpCameraToGoal()`.
4. On the `error` event, show "This 3D model couldn't be loaded." with a **Redo 3D model** button (spec edge case: stored model fails to load).
5. The viewer must fit the dialog on phones: `width: 100%; aspect-ratio: 1; max-height: 70vh`.

**Styling**: reuse the existing sticker-scrapbook tokens and button classes (constitution IV, FR-019). Every control is a real `<button>` with keyboard focus styles.
