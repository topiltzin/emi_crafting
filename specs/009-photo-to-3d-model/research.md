# Research: Photo to 3D Model

**Feature**: 009-photo-to-3d-model | **Date**: 2026-09-27

All findings below were checked against the live TRELLIS.2 Space (`https://microsoft-trellis-2.hf.space/gradio_api/info`, Gradio 6.1.0, `sse_v3`) and its `app.py` at commit `ebf60b2`, plus the Supabase Edge Function limits page.

---

## R1. What the TRELLIS.2 API actually requires

**Finding**: The live API differs from the snippet in the feature request in two ways that matter:

1. **`state` is not an API parameter.** `/image_to_3d` returns only an `Html` preview, and `/extract_glb` takes only `decimation_target` and `texture_size`. The latents live in a server-side `gr.State` (`output_buf`) keyed by the Gradio **session hash**. The two calls therefore **must use the same client/session**, and they must run in order. A `state=` argument like the one in the snippet would be rejected by current `gradio_client`.
2. **Background removal is not done by `/image_to_3d`.** The Space calls `pipeline.run(..., preprocess_image=False)`. Background removal and cropping (`preprocess_image`, which uses BRIA-RMBG-2.0) only run on the UI's `image.upload` event. That event is exposed as the API endpoint **`/preprocess_image`**. API callers must call it first, or the model is built from the whole photo, background included.

**Additional facts**:
- `image_to_3d` and `extract_glb` are each `@spaces.GPU(duration=120)` (ZeroGPU). Each call reserves up to 120 s of GPU time, and there is queue wait on top of that.
- `extract_glb` writes the GLB to `tmp/<session_hash>/sample_<ts>.glb`. With `gr.Blocks(delete_cache=(600, 600))`, that file can be deleted after about 10 minutes, so the result must be downloaded right away in the same job.
- The GLB is exported with `extension_webp=True`, which means textures use `EXT_texture_webp`.
- Valid ranges: `resolution ∈ {"512","1024","1536"}`; `decimation_target ∈ [100000, 500000]`; `texture_size ∈ [1024, 4096]` in steps of 1024.

**Decision**: The call sequence per job, on a single `Client` instance, is `/preprocess_image` → `/image_to_3d` → `/extract_glb`. Then the returned GLB is downloaded immediately. This is documented in [contracts/trellis-service.md](./contracts/trellis-service.md).

**Spec impact**: The spec's Assumption "the service performs its own subject handling" was wrong. It has been corrected to "background removal is run as a separate preprocessing step of the same service".

---

## R2. Where the conversion job runs

**Constraint**: A conversion takes roughly 3–10 minutes: queue wait, a short background-removal step, and two GPU steps of up to 120 s each. Supabase Edge Functions are capped at **150 s wall-clock on Free** and 400 s on Pro. This project is on **Free**. The job must also keep running after the browser tab closes (FR-005).

**Decision**: Use a **small standalone Python worker** (`worker/`). It polls a `model_conversions` job table, claims one job at a time, runs the TRELLIS sequence with `gradio_client` (the library from the user's snippet), uploads the GLB to Supabase Storage, and updates the database. It authenticates to Supabase with the **service-role key**, which exists only in the worker's environment and never in the browser bundle or the repo.

**Rationale**: Nothing else on the current stack can do this: the static SPA can't run jobs and edge functions time out. The worker has no time limit, uses the officially supported Python client, and is about 200 lines. It can run on any always-on host: a free container host, a home machine, or a small VM.

**Alternatives considered** (these were offered to the user, who chose the worker):
- *Supabase Edge Function background task*: Rejected. With a 150 s cap on Free, almost every conversion would time out.
- *Browser-driven conversion*: Rejected. Closing the tab would cancel the job, which violates FR-005, and a Hugging Face token can't be kept secret in the browser.
- *Chained edge-function invocations reusing a persisted Gradio session hash over the raw `sse_v3` protocol*: Rejected. It depends on undocumented Gradio behavior (whether queued events survive a closed stream), and each GPU step plus its queue wait can still exceed 150 s.

---

## R3. Hugging Face ZeroGPU quota

**Finding**: ZeroGPU Spaces enforce a daily GPU-time quota per caller. Anonymous callers get the smallest allowance, logged-in free accounts get more, and PRO accounts get considerably more. A request is refused when the remaining quota is below the function's declared `duration`. Here that means 120 s is needed for each GPU step. When the quota runs out, the client raises an error whose message contains "exceeded your GPU quota" (or a similar ZeroGPU quota message).

**Decision**:
- The worker authenticates with an `HF_TOKEN` secret (`Client("microsoft/TRELLIS.2", token=HF_TOKEN)`).
- A quota error is mapped to `error_code = 'SERVICE_QUOTA'`. The user sees "The 3D maker is out of energy for today — try again later." (spec edge case: quota or rate limit reached).
- Risk: with a free HF account, only a few conversions per day may succeed. A PRO token is recommended if conversions are used heavily. This is recorded in quickstart.md.

**Alternatives considered**: Duplicating the Space onto paid dedicated GPU hardware. Rejected for now because of cost, but it only needs a config change: the worker reads the Space id from `TRELLIS_SPACE`.

---

## R4. Generation settings and seeds

**Finding**: The snippet's values (for example `ss_guidance_rescale=0.0`, `ss_rescale_t=1.0`, `tex_slat_guidance_strength=7.5`) differ from the Space's current UI defaults (`0.7`, `5.0`, `1.0`). The snippet's values are all within the valid ranges.

**Decision**:
- Keep the **user-specified values** as the app's fixed settings (FR-003). They live in one constant in `worker/trellis_worker/settings.py`, and a copy is stored on each job row (`settings` jsonb) so results can be traced back to their settings.
- **Seed**: the first conversion of a photo uses seed `0`, as in the snippet. **Redo** uses a random seed. With the same image and the same seed, a redo would produce an identical model, which would make "Redo 3D model" (FR-012) pointless.
- Output settings are kept: `resolution="1024"`, `decimation_target=100000`, `texture_size=1024`. They keep files small (a few MB), well under the 50 MB cap (FR-016), and quick to load on phones (SC-003, SC-006).

**Alternatives considered**: Switching to the Space's UI defaults. That is deferred to tuning after launch, and it only means editing one constant.

---

## R5. Rendering the GLB in the browser

**Decision**: Use Google's **`<model-viewer>`** web component (npm `@google/model-viewer`), **lazy-loaded** with a dynamic `import()` only when a 3D view is first opened.

**Rationale**:
- Rotate, zoom, pinch, keyboard control, reset (via `camera-orbit` reset), a loading poster, and error events are all built in. That covers FR-010 and FR-011 with almost no custom code.
- It is a plain custom element, which fits this framework-less vanilla-JS app.
- It is built on three.js's GLTFLoader, which supports `EXT_texture_webp` (R1).
- Lazy loading keeps the main bundle unchanged for users who never open a 3D view (constitution III).

**Alternatives considered**: Raw three.js with GLTFLoader and OrbitControls. It is more code to write and test for the same result. Rejected under constitution V.

**WebGL-unavailable fallback**: Check `document.createElement('canvas').getContext('webgl2') || getContext('webgl')` before loading. If it fails, show the fallback message and keep the photo visible (spec US2 scenario 4).

---

## R6. Storing models and access control

**Decision**:
- Store GLBs in the existing **private `photos` bucket** at `<owner_id>/<photo_id>/model-<job_id>.glb`. The existing owner-folder Storage RLS policies cover reads and deletes (FR-008) without any change. Including the job id in the name means a redo never overwrites the live model until the database pointer switches over (FR-012).
- Put the current-model pointer on `photos`: `model_storage_path`, `model_file_size`, `model_generated_at`, `model_job_id`. This follows the existing pattern of `storage_path`/`thumbnail_storage_path`, and it lets the gallery show the "3D" marker without a join (FR-009).
- Keep job history in a new `model_conversions` table (see [data-model.md](./data-model.md)).
- Size cap of **50 MB**: the worker checks it before upload. It is also the Supabase Free per-file upload limit.
- The browser gets GLB URLs through `createSignedUrl` (1 h TTL), the same way as photos. Downloads use `createSignedUrl(path, ttl, { download: '<photo-name>.glb' })` (FR-017).

---

## R7. Job queueing, limits, and timeouts

**Decision**:
- **Enqueue** goes through a `SECURITY DEFINER` RPC `request_model_conversion(photo_id)`. It checks ownership, takes a per-owner advisory lock, enforces **≤ 1 active job per photo** and **≤ 3 active jobs per owner** (FR-015), and inserts the job. The browser has no direct INSERT or UPDATE access on `model_conversions`.
- **Claim**: a `claim_model_conversion(worker_id)` RPC (granted to `service_role` only) uses `FOR UPDATE SKIP LOCKED`, so more than one worker can run safely in the future.
- **Timeout**: the worker enforces a 10-minute overall deadline per job (FR-006). The `fail_stale_model_conversions()` RPC, which the worker calls on every poll cycle, also marks any `queued` or `processing` job older than 10 minutes, measured from `requested_at`, as `failed/TIMEOUT`. This covers a crashed worker. The browser treats an active job older than 10 minutes as failed for display, which covers a worker that is down entirely.
- **Status updates to the UI**: poll the latest job row every **5 s**, but only while the photo viewer for a photo with an active job is open. The gallery marker is refreshed on normal reloads. Supabase Realtime was considered and rejected (constitution V): it needs a publication and channel setup for a single-user app where polling costs almost nothing.

---

## R8. Deletion semantics (FR-014)

**Finding**: `db.js` supports soft delete (`deleted_at`) and hard delete. Hard delete removes Storage objects, then the rows.

**Decision**:
- **Hard delete** of a photo or album also removes `model_storage_path` objects. It also removes any orphaned `model-*.glb` left by jobs in flight, by listing `<owner>/<photo>/` for `model-` prefixes. Job rows are deleted by `ON DELETE CASCADE` from `photos`.
- **Soft delete** leaves the model with the photo, just as it leaves the original image, because the photo is recoverable. Active jobs for a soft-deleted photo are finished by the worker, which then sees `deleted_at` set and **discards** the result: it deletes the uploaded file and marks the job `canceled`.
- A worker that finishes after a hard delete finds the photo row missing. It removes its uploaded file and stops (the job row is already gone by cascade).

---

## R9. Worker image preprocessing

**Decision**: Before `/preprocess_image`, the worker downloads the original. The allowed MIME types are jpeg, png, and webp, so HEIC never reaches Storage (schema check). It applies the EXIF orientation, downsizes to a longest side of 1024 px with Pillow, and saves a temporary PNG. This keeps uploads to the Space small and matches the Space's own 1024 px cap. If decoding fails, the job fails with `INVALID_IMAGE`.

---

## R10. Testing approach

**Decision**:
- **Frontend (Vitest + jsdom, existing)**: unit tests for `model-conversion.js`, the 3D panel UI, and the photo-card badge. An integration test covers request → poll → completed → view → remove through `tests/helpers/fake-supabase.js`, which needs `rpc()` support and Storage `list()` added. `<model-viewer>` is stubbed as an undefined custom element in jsdom, since WebGL isn't available there.
- **Worker (pytest)**: unit tests with `gradio_client.Client` and the Supabase client mocked. They cover the call order, error mapping, size cap, deadline, and the discard-if-deleted path. Target is ≥ 80% coverage (constitution II). `ruff` handles lint and format, and `mypy --strict` handles types (constitution: type safety).
- **Database**: RPC behavior (limits, ownership, claim skip-locked) is checked with SQL scenarios listed in quickstart.md against a local `supabase start`.
- **Manual end-to-end**: in quickstart.md, since it depends on the live external Space.
