---

description: "Task list for 009-photo-to-3d-model"
---

# Tasks: Photo to 3D Model

**Input**: Design documents from `/specs/009-photo-to-3d-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (database.md, trellis-service.md, client-module.md), quickstart.md

**Tests**: INCLUDED. The project constitution (Principle II) requires tests written first or alongside the code, >80% coverage, and integration tests for critical paths. Browser tests use Vitest + jsdom (`npm test`). Worker tests use pytest (`cd worker && pytest`).

**Organization**: Tasks are grouped by user story (spec.md: US1 Convert P1, US2 View P1, US3 Failures/Retry/Remove P2, US4 Download P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)

## Path Conventions

- Browser SPA: `src/`, `tests/` at the repo root (vanilla JS ES modules, Vite 4)
- Database: `supabase/migrations/`, `supabase/schema.sql`
- Worker: `worker/` (Python 3.12 package `trellis_worker`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and the worker package skeleton

- [X] T001 Add `@google/model-viewer` (latest 4.x) to `dependencies` in package.json and run `npm install` to update package-lock.json. Import it **only** through dynamic `import()` (research R5); do not add it to any static import.
- [X] T002 [P] Create worker/pyproject.toml. Package `trellis_worker`, `requires-python = ">=3.12"`. Dependencies: `gradio_client`, `supabase`, `Pillow`, `python-dotenv`. Optional `[dev]`: `pytest`, `pytest-cov`, `ruff`, `mypy`, `types-Pillow`. `[tool.ruff]` line-length 100. `[tool.mypy] strict = true`. `[tool.pytest.ini_options] testpaths = ["tests"]`. `[tool.coverage.report] fail_under = 80`.
- [X] T003 [P] Create worker/.env.example with commented placeholders: `SUPABASE_URL=`, `SUPABASE_SERVICE_ROLE_KEY=` (comment: "server-only; never put in the repo or the browser .env.local"), `HF_TOKEN=` (comment: "Hugging Face read token; PRO recommended for ZeroGPU quota — research R3"), `TRELLIS_SPACE=microsoft/TRELLIS.2`, `POLL_SECONDS=10`. Add `worker/.env` and `worker/**/__pycache__/`, `worker/.venv/` to the root .gitignore.
- [X] T004 [P] Create worker/Dockerfile: `python:3.12-slim`, copy `pyproject.toml` + `trellis_worker/`, `pip install .`, run as a non-root user, `CMD ["python", "-m", "trellis_worker"]`.
- [X] T005 [P] Create empty package files worker/trellis_worker/__init__.py and worker/tests/__init__.py, plus worker/tests/conftest.py with shared fixtures: a `fake_supabase` MagicMock exposing `.rpc(name, params).execute()`, `.storage.from_(bucket).upload/download/remove/list`, and `.table(name)`; and a `job_row()` factory returning a dict shaped like a `model_conversions` row (fields in data-model.md) with `status='processing'`, `seed=0`, and the default settings from contracts/trellis-service.md.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and RPCs, test helpers, and worker core modules. Every story depends on these.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T006 Create supabase/migrations/0002_add_photo_3d_models.sql. It must be idempotent (`if not exists` / `drop constraint if exists`), with header comments in the style of 0001. It adds to `public.photos` the columns `model_storage_path text`, `model_file_size bigint`, `model_generated_at timestamptz`, `model_job_id uuid` (all nullable, no FK on `model_job_id`), and these constraints:
  - `photos_model_all_or_nothing`: `(model_storage_path is null) = (model_file_size is null) and (model_storage_path is null) = (model_generated_at is null)`
  - `photos_model_file_size_range`: `model_file_size is null or (model_file_size > 0 and model_file_size <= 52428800)`
  - `photos_model_path_prefix`: `model_storage_path is null or model_storage_path like owner_id::text || '/' || id::text || '/model-%.glb'`
- [X] T007 In the same file supabase/migrations/0002_add_photo_3d_models.sql, create table `public.model_conversions` exactly as specified in data-model.md:
  - Columns: `id uuid pk default gen_random_uuid()`; `owner_id uuid not null references auth.users(id)`; `photo_id uuid not null references public.photos(id) on delete cascade`; `status text not null`; `is_redo boolean not null default false`; `seed integer not null`; `settings jsonb not null`; `error_code text`; `error_message text` (check `char_length(error_message) <= 500`); `result_storage_path text`; `result_file_size bigint`; `worker_id text`; `requested_at timestamptz not null default now()`; `started_at timestamptz`; `finished_at timestamptz`.
  - Checks: `status in ('queued','processing','completed','failed','canceled')`; `(status = 'failed') = (error_code is not null)`; `(status = 'completed') = (result_storage_path is not null)`; `status in ('queued') or started_at is not null`; `error_code is null or error_code in ('TIMEOUT','SERVICE_BUSY','SERVICE_QUOTA','INVALID_IMAGE','RESULT_TOO_LARGE','INTERNAL')`.
  - Indexes: unique `uniq_model_conversions_active_photo on (photo_id) where status in ('queued','processing')`; `idx_model_conversions_claim on (status, requested_at) where status = 'queued'`; `idx_model_conversions_photo_recent on (photo_id, requested_at desc)`.
  - RLS: `enable row level security`; policy `model_conversions_owner_select` `for select using (owner_id = auth.uid())`; **no** insert, update, or delete policies.
- [X] T008 In supabase/migrations/0002_add_photo_3d_models.sql, add `create or replace function public.model_conversion_default_settings() returns jsonb language sql immutable`. It returns `{"resolution":"1024","ss_guidance_strength":7.5,"ss_guidance_rescale":0.0,"ss_sampling_steps":12,"ss_rescale_t":1.0,"shape_slat_guidance_strength":7.5,"shape_slat_guidance_rescale":0.0,"shape_slat_sampling_steps":12,"shape_slat_rescale_t":1.0,"tex_slat_guidance_strength":7.5,"tex_slat_guidance_rescale":0.0,"tex_slat_sampling_steps":12,"tex_slat_rescale_t":1.0,"decimation_target":100000,"texture_size":1024}`. Add a comment that this is the single source of truth for generation parameters (contracts/database.md).
- [X] T009 In supabase/migrations/0002_add_photo_3d_models.sql, add the worker-only RPCs from contracts/database.md. All are `security definer`, `set search_path = public`, with `revoke execute ... from public, anon, authenticated` and `grant execute ... to service_role`:
  - `claim_model_conversion(p_worker_id text) returns public.model_conversions`: the `update ... where id = (select id ... where status='queued' order by requested_at for update skip locked limit 1) returning *` query.
  - `complete_model_conversion(p_job_id uuid, p_path text, p_size bigint) returns table(discard boolean, old_path text)`. Lock the job and photo `for update`. If the job status is not `processing`, return `(true, null)`. If the photo is missing or `deleted_at is not null`, set the job `status='canceled', finished_at=now()` and return `(true, null)`. Otherwise capture the old `model_storage_path`, set the photo's `model_storage_path=p_path, model_file_size=p_size, model_generated_at=now(), model_job_id=p_job_id, updated_at=now()`, set the job `status='completed', result_storage_path=p_path, result_file_size=p_size, finished_at=now()`, and return `(false, old_path)`. The function must not write `storage_path`, `thumbnail_storage_path`, or any other original-photo column (FR-018).
  - `fail_model_conversion(p_job_id uuid, p_code text, p_message text) returns void`: sets `status='failed', error_code=p_code, error_message=left(p_message,500), finished_at=now()` `where id=p_job_id and status='processing'`.
  - `fail_stale_model_conversions() returns integer`: sets `status='failed', error_code='TIMEOUT', error_message='This one took too long. Want to try again?', started_at=coalesce(started_at, now()), finished_at=now()` `where status in ('queued','processing') and requested_at < now() - interval '10 minutes'` and returns the row count.
- [X] T010 In supabase/migrations/0002_add_photo_3d_models.sql, add the browser RPC `request_model_conversion(p_photo_id uuid) returns public.model_conversions` (`security definer`, `set search_path = public`, `grant execute ... to authenticated`), implementing the 6 steps in contracts/database.md exactly:
  1. Raise `NOT_AUTHENTICATED` if `auth.uid()` is null.
  2. `perform pg_advisory_xact_lock(hashtext('model_conv:' || auth.uid()::text))`.
  3. Load the photo (owned by the caller, not deleted), or raise `PHOTO_NOT_FOUND`.
  4. Time out stale active jobs for this photo; raise `ALREADY_CONVERTING` if a fresh active job exists.
  5. Raise `CONVERSION_LIMIT` if the owner has ≥ 3 fresh active jobs.
  6. Insert with `is_redo = (photo.model_storage_path is not null)`, `seed = case when is_redo then floor(random()*2147483647)::int else 0 end`, `settings = model_conversion_default_settings()`.

  All raises use `using errcode = 'P0001', message = '<CODE>'`.
- [X] T011 Mirror T006–T010 into supabase/schema.sql. Append the new columns to the `photos` table definition, and add the `model_conversions` table, indexes, RLS, functions, and grants after the existing photos section, with a `-- spec 009-photo-to-3d-model` comment.
- [X] T012 [P] Extend tests/helpers/fake-supabase.js:
  - (a) Add `model_storage_path: null, model_file_size: null, model_generated_at: null, model_job_id: null` to the `photos` defaults, and a `model_conversions` table with `defaultsFor` returning `{ status: 'queued', is_redo: false, seed: 0, settings: {}, error_code: null, error_message: null, result_storage_path: null, result_file_size: null, worker_id: null, started_at: null, finished_at: null, requested_at: nowIso() }`.
  - (b) Add `client.rpc(name, params)` backed by a registry, `registerRpc(name, fn)` exposed on the fake. Provide a default `request_model_conversion` that enforces `ALREADY_CONVERTING`/`CONVERSION_LIMIT`/`PHOTO_NOT_FOUND` against the in-memory tables and returns `{ data: row, error: null }` or `{ data: null, error: { message: '<CODE>', code: 'P0001' } }`.
  - (c) Add `storage.from(bucket).list(prefix)` returning `{ data: [{ name }], error: null }` for objects under `prefix/`.
  - (d) Support `.limit(n)` and `.order(col, { ascending })` on `model_conversions` if not already generic.
- [X] T013 [P] Create worker/trellis_worker/config.py. A frozen dataclass `Config` with `supabase_url`, `service_role_key`, `hf_token`, `trellis_space` (default `"microsoft/TRELLIS.2"`), `poll_seconds` (default 10), `worker_id` (default `f"{socket.gethostname()}-{os.getpid()}"`), and `load_config()` that reads env (after `dotenv.load_dotenv()`) and raises `ValueError` naming any missing required variable. Test in worker/tests/test_config.py (missing vars → error; defaults applied).
- [X] T014 [P] Create worker/trellis_worker/errors.py. `class ConversionError(Exception)` with attributes `code: str` and `user_message: str`, and a `USER_MESSAGES` dict with exactly the messages from the data-model.md "Error codes" table (`TIMEOUT` → "This one took too long. Want to try again?", `SERVICE_BUSY` → "The 3D maker is busy right now. Try again in a little while.", `SERVICE_QUOTA` → "The 3D maker is out of energy for today — try again later.", `INVALID_IMAGE` → "We couldn't read this photo. Try a clearer photo of one object.", `RESULT_TOO_LARGE` → "The 3D model came out too big to save. Try again.", `INTERNAL` → "Something went wrong making the 3D model. Try again."). Also `classify(exc: BaseException) -> ConversionError`, implementing the contracts/trellis-service.md "Error mapping" table (quota regex `/GPU quota|ZeroGPU.*quota|exceeded your/i` → `SERVICE_QUOTA`; `httpx.ConnectError`/`ConnectionError`/HTTP 5xx/"queue is full"/"sleeping" → `SERVICE_BUSY`; an existing `ConversionError` passes through; everything else → `INTERNAL`). Test every row in worker/tests/test_errors.py.
- [X] T015 [P] Create worker/trellis_worker/settings.py. `ALLOWED_RANGES` from contracts/trellis-service.md (`resolution ∈ {"512","1024","1536"}`, `decimation_target` 100000–500000, `texture_size ∈ {1024,2048,3072,4096}`, and all 12 `ss_*`/`shape_slat_*`/`tex_slat_*` keys required and numeric), plus `validate_settings(settings: dict[str, object]) -> dict[str, object]`, which raises `ConversionError("INTERNAL", ...)` on an unknown, missing, or out-of-range key. Test in worker/tests/test_settings.py using the T008 defaults (valid) and bad values (invalid).

**Checkpoint**: Migration applies cleanly (`supabase db push`). `npm test` still passes with the extended fake. `cd worker && pytest` passes for config, errors, and settings.

---

## Phase 3: User Story 1 - Turn a Craft Photo into a 3D Model (Priority: P1) 🎯 MVP

**Goal**: The owner taps "Make it 3D ✨" on a photo. A job is queued, the worker produces a GLB and saves it to Storage and the database, and the photo shows a "3D" badge. The conversion survives the tab closing.

**Independent Test**: quickstart.md E1 + E2. Upload a photo, open it, tap **Make it 3D ✨**, close the tab, wait, reopen. The card shows a **3D** badge, the job is `completed`, and `photos.model_*` is set.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T016 [P] [US1] worker/tests/test_trellis.py: with `gradio_client.Client` patched, assert that `generate_glb(...)` (T020):
  - constructs exactly **one** `Client(space, token=hf_token)`;
  - calls `/preprocess_image` → `/image_to_3d` → `/extract_glb` in that order on that same instance;
  - passes `seed=job.seed` and every settings key to `/image_to_3d`, and only `decimation_target` and `texture_size` to `/extract_glb`;
  - never passes a `state` keyword;
  - returns the GLB bytes read from the first element of the `/extract_glb` result;
  - raises `ConversionError('TIMEOUT')` when a `job.result(timeout=...)` raises `TimeoutError`, and calls `job.cancel()`.
- [X] T017 [P] [US1] worker/tests/test_image_prep.py: `prepare_image(raw_bytes) -> pathlib.Path` applies the EXIF orientation, downsizes so the longest side is ≤ 1024 px (keeping the aspect ratio), writes a PNG, never upscales small images, and raises `ConversionError('INVALID_IMAGE')` for undecodable bytes.
- [X] T018 [P] [US1] worker/tests/test_job_runner.py:
  - Happy path: download the original from `photos/<storage_path>`, prepare, generate, upload to `photos/<owner>/<photo>/model-<job_id>.glb` with `content-type: model/gltf-binary`, call `complete_model_conversion`, and delete `old_path` if it was returned.
  - `discard=True` → the uploaded file is removed.
  - Any exception → `fail_model_conversion(job_id, code, user_message)`, with no upload left behind and the traceback logged but never sent in the message.
  - GLB > 52428800 bytes → `RESULT_TOO_LARGE` with no upload.
  - Deadline = `requested_at + 10 min` passed into `generate_glb`.
- [X] T019 [P] [US1] tests/unit/model-conversion.test.js (using tests/helpers/fake-supabase.js):
  - `requestConversion` returns a queued job; RPC errors `CONVERSION_LIMIT` / `ALREADY_CONVERTING` / `PHOTO_NOT_FOUND` surface as `DataAccessError` with `code:'validation'` and `.reason` set to the RPC code.
  - `getLatestConversion` returns the newest row or null.
  - `getDisplayStatus` returns `'none' | 'queued' | 'processing' | 'ready' | 'failed'` per contracts/client-module.md, including an active job older than 10 min → `'failed'`.
  - `watchConversion` calls `onUpdate` only on status change, stops by itself on a terminal status, and stops when the returned function is called (use `vi.useFakeTimers()`).

### Implementation for User Story 1

- [X] T020 [P] [US1] Create worker/trellis_worker/trellis.py with `generate_glb(image_path: Path, seed: int, settings: dict[str, object], *, space: str, hf_token: str, deadline: float) -> bytes`, following contracts/trellis-service.md exactly:
  - Use one `Client(space, token=hf_token)`, retrying the constructor once after 5 s on a 503/connection error.
  - Run each step via `client.submit(..., api_name=...)` + `.result(timeout=max(1, deadline - time.monotonic()))`, cancelling and raising `ConversionError("TIMEOUT", USER_MESSAGES["TIMEOUT"])` when the deadline is exceeded.
  - Wrap `/preprocess_image` failures as `INVALID_IMAGE`.
  - Read the GLB bytes immediately from `result[0]`.
  - Also add `check_api(space, hf_token) -> None`, which calls `client.view_api(return_format="dict")` and raises `RuntimeError` listing missing endpoints if any of `/preprocess_image`, `/image_to_3d`, `/extract_glb` is absent (plan Risk 2).
- [X] T021 [P] [US1] Create worker/trellis_worker/image_prep.py with `prepare_image(raw: bytes, workdir: Path) -> Path` (Pillow: `ImageOps.exif_transpose`, `thumbnail((1024, 1024), LANCZOS)`, convert to RGB/RGBA, save `input.png`). Decode errors → `ConversionError("INVALID_IMAGE", USER_MESSAGES["INVALID_IMAGE"])`.
- [X] T022 [P] [US1] Create worker/trellis_worker/storage.py with `download_original(sb, storage_path) -> bytes`, `upload_model(sb, path, data: bytes) -> None` (bucket `photos`, `file_options={"content-type": "model/gltf-binary", "upsert": "false"}`), and `remove_paths(sb, paths: list[str]) -> None` (ignores empty lists, logs but does not raise on failure). Add `model_path(owner_id, photo_id, job_id) -> str` returning `f"{owner_id}/{photo_id}/model-{job_id}.glb"`.
- [X] T023 [US1] Create worker/trellis_worker/job_runner.py with `run_job(sb, cfg, job: dict) -> None`, orchestrating the happy path and error paths tested in T018:
  - Look up the photo's `storage_path` via `sb.table("photos").select("storage_path").eq("id", job["photo_id"]).maybe_single()`. If the photo row is missing, it was hard-deleted and the job row is already gone by cascade, so log "discarded" and return without calling any RPC.
  - `validate_settings`, `prepare_image` in a `tempfile.TemporaryDirectory()`, `generate_glb`.
  - Size check `len(glb) > 52_428_800` → `RESULT_TOO_LARGE`.
  - `upload_model`, then RPC `complete_model_conversion(p_job_id, p_path, p_size)`. On `discard` → `remove_paths([path])` and log "discarded"; else if `old_path` → `remove_paths([old_path])`.
  - On any exception: `err = classify(exc)`, `remove_paths` for anything uploaded, RPC `fail_model_conversion(job_id, err.code, err.user_message)`, and `logging.exception` for the traceback.
  - The deadline is computed from `job["requested_at"]` + 600 s, converted to a monotonic time.
- [X] T024 [US1] Create worker/trellis_worker/__main__.py:
  - `main()`: `load_config()`, `create_client(url, service_role_key)`, `check_api(...)` at startup (exit non-zero with a clear log on failure).
  - Loop forever: `rpc("fail_stale_model_conversions")`, then `rpc("claim_model_conversion", {"p_worker_id": cfg.worker_id})`. If a job is returned, `run_job`, then immediately try claiming again; otherwise sleep `cfg.poll_seconds`.
  - Catch and log per-cycle exceptions so one bad cycle never kills the loop. Handle SIGTERM gracefully by finishing the current job, then exiting.
  - Log "worker <id> polling every <n>s" on start.
  - Add worker/tests/test_main.py covering one claim → run cycle and one empty cycle with the loop bounded by a flag.
- [X] T025 [P] [US1] Create src/modules/model-conversion.js with `requestConversion`, `getLatestConversion`, `getDisplayStatus`, `watchConversion`, `describeConversionError`, and constants `ACTIVE_JOB_TIMEOUT_MS = 10 * 60 * 1000` and `POLL_INTERVAL_MS = 5000`, per contracts/client-module.md. Use `getSupabaseClient()` from src/modules/supabase-client.js and `classifySupabaseError` from src/modules/supabase-errors.js. For RPC errors whose `message` is one of `NOT_AUTHENTICATED|PHOTO_NOT_FOUND|ALREADY_CONVERTING|CONVERSION_LIMIT`, return a `DataAccessError` with `code:'validation'` and `.reason = message`. Map `CONVERSION_LIMIT` to "You already have 3 models cooking — please wait for one to finish." and `PHOTO_NOT_FOUND` to "This photo isn't available anymore." in a exported `describeRequestError(error)`. Make T019 pass.
- [X] T026 [P] [US1] Create src/ui/model-badge.js with `createModelBadge()`, mirroring src/ui/tutorial-badge.js: a `span.model-badge` with `aria-label="Has a 3D model"`, `title="Has a 3D model"`, and inner `<span aria-hidden="true">3D</span>`. Test in tests/unit/model-badge.test.js.
- [X] T027 [US1] Update src/ui/photo-card.js: after the tutorial badge block (around line 50), `if (photo.model_storage_path) media.appendChild(createModelBadge());`. Extend tests/unit/photo-gallery.test.js (or the existing card test) to assert the badge appears only when `model_storage_path` is set (FR-009).
- [X] T028 [US1] Create src/ui/model-3d-panel.js with `createModel3dPanel(photo, { onPhotoChange } = {}) -> { element, destroy }`. For US1, implement the `none`, `queued`, and `processing` states from contracts/client-module.md:
  - `none`: button `data-action="model-convert"` with text "Make it 3D ✨", and the tip "Works best with one object on a plain background."
  - `queued`/`processing`: disabled button, `.spinner`, and the status text "Making your 3D model… this can take a few minutes. You can keep using the app." in an element with `role="status"` and `aria-live="polite"`.

  Behavior:
  - On mount, `getLatestConversion(photo.id)`. If the job is active, start `watchConversion`.
  - On click: `requestConversion`, then render `queued` and start watching. On a request error, show `describeRequestError` in a `role="alert"` element.
  - On a `completed` update, re-fetch the photo via `getPhoto(photo.id)` from src/modules/db.js, call `onPhotoChange(updatedPhoto)`, and render a placeholder `ready` state (just the text "Your 3D model is ready!"). US2 replaces this.
  - `destroy()` stops the watcher.
- [X] T029 [US1] Update src/ui/photo-viewer.js: create the panel with `createModel3dPanel(currentPhoto, { onPhotoChange: (p) => { currentPhoto = p; } })`, append `panel.element` to `content` before `tutorialWrap`, and pass `onClose: () => panel.destroy()` to `openDialog`. Extend tests/unit/photo-viewer.test.js to assert the panel mounts and the watcher is stopped on close.
- [X] T030 [P] [US1] Add styles in a new src/styles/model-3d.css (imported wherever src/styles/tutorial-link.css is imported). `.model-badge` should look like `.tutorial-badge` but be offset so the two don't overlap. Also style `.model-3d-panel`, `.model-3d-status`, `.model-3d-tip`, and `.model-3d-error`, using the existing sticker-scrapbook CSS custom properties from src/styles/main.css (no new hard-coded colors), with visible `:focus-visible` outlines on buttons (FR-019).
- [X] T031 [US1] Integration test tests/integration/photo-to-3d-flow.test.js (US1 part), using the fake Supabase:
  - Open the viewer for a photo, click "Make it 3D ✨", and assert the queued status text plus the disabled button (US1-2, US1-5).
  - Simulate the worker by updating the fake job to `processing`, then to `completed` while setting the `photos.model_*` columns; advance timers by 5 s.
  - Assert the ready text appears and a re-rendered card shows the 3D badge (US1-3).
  - Close and reopen the viewer mid-processing and assert the status resumes (US1-4).

**Checkpoint**: US1 is fully functional. With the worker running, quickstart E1 and E2 pass.

---

## Phase 4: User Story 2 - View and Spin the 3D Model (Priority: P1)

**Goal**: A photo with a saved model can switch between Photo and 3D, with the model rotated, zoomed, and reset in a lazy-loaded `<model-viewer>`, and with a fallback when WebGL is missing.

**Independent Test**: quickstart.md E3–E5. Manually set `model_*` on a photo (upload any sample `.glb` to `<owner>/<photo>/model-test.glb`), open the photo, toggle **3D**, and rotate, zoom, and reset. This works without US1's worker.

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] tests/unit/model-3d-panel.test.js (US2 part). With `photo.model_storage_path` set:
  - A Photo/3D toggle renders as two buttons with `aria-pressed`.
  - Selecting 3D calls a mocked `loadModelViewer()` and renders a `model-viewer` element with `src` = the signed URL, and the attributes `camera-controls`, `touch-action="pan-y"`, `auto-rotate`, and `alt="3D model of <filename>"`.
  - A spinner shows until a dispatched `load` event.
  - A dispatched `error` event shows "This 3D model couldn't be loaded."
  - With WebGL unavailable (a mocked `isWebGLAvailable()` returning false), the text "Your device can't show 3D models, but here's the photo!" shows and `loadModelViewer` is never called.
  - "Reset view" sets `cameraOrbit = 'auto auto auto'` and `fieldOfView = 'auto'`, and calls `jumpCameraToGoal()`.

### Implementation for User Story 2

- [X] T033 [P] [US2] Add `getModelUrl(photo)` to src/modules/model-conversion.js. It returns `resolvePhotoUrl(photo.model_storage_path)` from src/modules/photo-url.js and throws `validationError('No 3D model')` when the path is null. Add a unit test in tests/unit/model-conversion.test.js.
- [X] T034 [P] [US2] Create src/modules/model-viewer-loader.js exporting `isWebGLAvailable()` (tries `canvas.getContext('webgl2') || canvas.getContext('webgl')`, catching errors → false) and `loadModelViewer()` (a memoized `import('@google/model-viewer')`, so Vite code-splits it; research R5).
- [X] T035 [US2] Extend src/ui/model-3d-panel.js with the `ready` state from contracts/client-module.md:
  - A Photo/3D segmented toggle (`button[aria-pressed]`). Selecting 3D hides the viewer's `.photo-viewer-image`, passed in as an option `getPhotoImage: () => HTMLElement | null`, and mounts a `.model-3d-stage` with a spinner, then `<model-viewer>` per T032. Selecting Photo restores the image.
  - A "Reset view" button.
  - The `error` fallback and the WebGL fallback text.

  Replace the US1 placeholder "ready" text. Update src/ui/photo-viewer.js to pass `getPhotoImage`.
- [X] T036 [US2] Add `.model-3d-toggle` and `.model-3d-stage model-viewer { width: 100%; aspect-ratio: 1; max-height: 70vh; }` styles, along with spinner overlay styles, to src/styles/model-3d.css. Verify there is no horizontal scroll at 390 px width (US2-5).
- [X] T037 [US2] Extend tests/integration/photo-to-3d-flow.test.js: open a photo seeded with `model_*`, toggle 3D, assert that `model-viewer` is present with the signed URL, then toggle back and assert the photo image is visible again.

**Checkpoint**: US1 and US2 both work. quickstart E3–E5 pass.

---

## Phase 5: User Story 3 - Handle Failures, Retry, and Remove (Priority: P2)

**Goal**: Failed jobs show a friendly reason with **Try again**. **Redo** keeps the old model until the new one succeeds. **Remove** deletes the model. Deleting a photo or album deletes its models.

**Independent Test**: quickstart.md E6–E10.

### Tests for User Story 3 ⚠️

- [X] T038 [P] [US3] tests/unit/model-3d-panel.test.js (US3 part):
  - `failed` job → the `job.error_message` text shows in `role="alert"`, and "Try again" calls `requestConversion` (US3-1).
  - `failed` job while `model_storage_path` is set → the error shows **and** the Photo/3D toggle is still available.
  - The `⋯` menu (button `aria-haspopup="menu"`) has *Redo 3D model*, *Download 3D model*, and *Remove 3D model*. Redo calls `requestConversion` while the old toggle stays usable during processing (US3-2).
  - Remove opens `showConfirmDialog` (mocked). On confirm it calls `removeModel` then `onPhotoChange`, and the panel renders `none` (US3-3). On cancel nothing changes.
- [X] T039 [P] [US3] tests/unit/db.test.js: `deletePhoto(id, true)` removes `storage_path`, `thumbnail_storage_path`, `model_storage_path`, and every `model-*.glb` returned by `storage.list('<owner>/<photo>')`. `deleteAlbum(id, true)` does the same for every photo in the album. Soft delete removes no model files (research R8).
- [X] T040 [P] [US3] worker/tests/test_job_runner.py additions: `complete_model_conversion` returning `discard=True` (photo soft-deleted or hard-deleted, or job already timed out) → the uploaded GLB is removed and no `old_path` is deleted. A redo success returning `old_path` → the old path is removed after completion.

### Implementation for User Story 3

- [X] T041 [US3] Add `removeModel(photo)` to src/modules/model-conversion.js: `storage.from(PHOTOS_BUCKET).remove([photo.model_storage_path])`, then `from('photos').update({ model_storage_path: null, model_file_size: null, model_generated_at: null, model_job_id: null }).eq('id', photo.id).select('*').single()`, returning the updated photo row. Errors go through `throwClassified`. Add unit tests in tests/unit/model-conversion.test.js (FR-013).
- [X] T042 [US3] Extend src/ui/model-3d-panel.js with:
  - The `failed` state (message from `describeConversionError(job)` + "Try again").
  - The `⋯` menu in the `ready` state (Redo / Download placeholder hidden until US4 / Remove with `showConfirmDialog({ title: 'Remove 3D model?', message: 'This only removes the 3D model — the photo itself is not affected.', confirmLabel: 'Remove' })`).
  - Redo while `ready` → show the processing status **alongside** the still-usable toggle.
  - Handling of the `model-viewer` `error` event with a "Redo 3D model" button.
- [X] T043 [US3] Update src/modules/db.js `deletePhoto` (hard branch) and `deleteAlbum` (hard branch):
  - Select `model_storage_path` along with the existing paths.
  - For each photo, `client.storage.from(PHOTOS_BUCKET).list(`${ownerId}/${photoId}`)` and add every entry whose `name` starts with `model-` and ends with `.glb` (orphans from in-flight jobs, research R8).
  - Include `model_storage_path` in `paths`, de-duplicated with `new Set`, before the existing `remove(paths)` call.

  Do not change the soft-delete branches.
- [X] T044 [US3] Extend tests/integration/photo-to-3d-flow.test.js:
  - Failed job → Try again → queued.
  - Redo on a photo with a model → the old model stays viewable while processing → on completion `model_storage_path` changes.
  - Remove → the badge is gone and the storage object is deleted.
  - Hard-delete a photo with a model → no `model-*.glb` is left in the fake storage.

**Checkpoint**: US1–US3 work. quickstart E6–E10 pass.

---

## Phase 6: User Story 4 - Download the 3D Model (Priority: P3)

**Goal**: Save the photo's model as `<name>-3d.glb` (FR-017).

**Independent Test**: quickstart.md E11. On a photo with a model, choose **Download 3D model**; the file saves and opens in a glTF viewer.

- [X] T045 [P] [US4] Add `getModelDownloadUrl(photo)` to src/modules/model-conversion.js: `storage.from(PHOTOS_BUCKET).createSignedUrl(photo.model_storage_path, 3600, { download: `${baseName}-3d.glb` })`, where `baseName` is `photo.filename` without its extension (fallback `craft`). Add a unit test in tests/unit/model-conversion.test.js asserting the filename. Add `download` option support to `createSignedUrl` in tests/helpers/fake-supabase.js if needed.
- [X] T046 [US4] Show the *Download 3D model* item in the `⋯` menu in src/ui/model-3d-panel.js. On click, `getModelDownloadUrl`, then create a temporary `<a href download>`, click it, and remove it. Errors show in the panel's `role="alert"` element. Extend tests/unit/model-3d-panel.test.js.

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T047 [P] Create worker/README.md covering what the worker does, the env vars (from worker/.env.example), running locally (`pip install -e ".[dev]" && python -m trellis_worker`), Docker, hosting guidance (any always-on host; one instance is enough), the ZeroGPU quota note (research R3), and log messages to expect.
- [X] T048 [P] Update DEPLOYMENT.md with a "🧊 3D models (spec 009)" section: apply migration 0002, deploy and run the worker, and set `SUPABASE_SERVICE_ROLE_KEY`/`HF_TOKEN` **only** in the worker environment. Update the root .env.example with a comment block (like the YouTube one) explaining that 3D conversion secrets live in `worker/.env`, not here.
- [X] T049 [P] Add a privacy line to the panel tip in src/ui/model-3d-panel.js: "Your photo is sent to an external 3D service only when you tap Make it 3D." (contracts/trellis-service.md, Privacy note). Update the matching unit test.
- [X] T050 Run `npm run build` and confirm `@google/model-viewer` lands in a separate chunk and the main entry chunk grows by ≤ 2 KB gzip versus `main` (plan Performance Goals). Record the numbers in specs/009-photo-to-3d-model/quickstart.md under a new "Build budget" note.
- [X] T051 Run `npm run lint`, `npm run format`, `npm test -- --coverage` (≥ 80% for new files under src/), and `cd worker && ruff check . && ruff format --check . && mypy --strict trellis_worker && pytest --cov=trellis_worker --cov-fail-under=80`. Fix any failures.
  - *Done 2026-09-27:* 392 Vitest tests and 74 pytest tests pass (worker 98% coverage); ruff and mypy --strict are clean; new browser files have ≥ 90% line coverage. **Deviations:** `npm run lint` can't run because the repo has no ESLint config (this was already the case before this feature), so the new files were linted with an inline `no-unused-vars`/`no-undef` config instead. `npm run format` was **not** run because the repo isn't Prettier-formatted and it would rewrite 94 unrelated files; only the new files were formatted (`--single-quote --trailing-comma none --print-width 110`).
- [ ] T052 Execute the quickstart.md §4 database checks D1–D6 and the §5 end-to-end scenarios E1–E12 against a real Supabase project with the worker running. Record pass/fail per scenario at the bottom of specs/009-photo-to-3d-model/quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. It **blocks all stories**. T006→T007→T008→T009→T010→T011 are sequential (same migration file). T012–T015 are [P].
- **US1 (Phase 3)**: Depends on Phase 2.
- **US2 (Phase 4)**: Depends on Phase 2. It only uses `model_*` columns, so it is testable without US1's worker. It touches src/ui/model-3d-panel.js, which is created in T028, so do T028 first or create the file stub in US2.
- **US3 (Phase 5)**: Depends on US1 (request/watch) and US2 (ready state and toggle) for the panel. The db.js (T043) and worker (T040) parts only depend on Phase 2.
- **US4 (Phase 6)**: Depends on US3's `⋯` menu (T042).
- **Polish (Phase 7)**: After the desired stories are done.

### Within Each User Story

- Tests are written first and must fail before implementation.
- Worker: image_prep / trellis / storage → job_runner → `__main__`.
- Browser: module → badge/panel → viewer/card wiring → integration test.

### Parallel Opportunities

- Phase 1: T002–T005 in parallel with T001.
- Phase 2: T012, T013, T014, T015 in parallel (and alongside the migration chain).
- US1: The worker track (T016–T018, T020–T024) and the browser track (T019, T025–T031) are fully independent, so two people or agents can split them.
- US2: T033 and T034 in parallel; T032 alongside them.
- US3: T039 + T043 (db.js) and T040 (worker) are independent of the panel work T038/T041/T042.

---

## Parallel Example: User Story 1

```bash
# Worker track
Task: "worker/tests/test_trellis.py — 3-step single-session call order (T016)"
Task: "worker/tests/test_image_prep.py (T017)"
Task: "worker/trellis_worker/trellis.py generate_glb + check_api (T020)"
Task: "worker/trellis_worker/image_prep.py (T021)"
Task: "worker/trellis_worker/storage.py (T022)"

# Browser track (at the same time)
Task: "tests/unit/model-conversion.test.js (T019)"
Task: "src/modules/model-conversion.js (T025)"
Task: "src/ui/model-badge.js (T026)"
Task: "src/styles/model-3d.css (T030)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Both are P1: a saved model that can't be seen delivers nothing (spec US2 rationale).
1. Phase 1 + Phase 2.
2. Phase 3 (US1). Validate quickstart E1–E2.
3. Phase 4 (US2). Validate E3–E5. **This is the MVP demo.**

### Incremental Delivery

4. US3 (failure recovery, redo, remove, delete cleanup). This matters before real use, because the external service's quota makes failures common.
5. US4 (download).
6. Polish and the full quickstart run.

---

## Notes

- Tasks marked [P] touch different files and don't depend on unfinished tasks.
- Never place `SUPABASE_SERVICE_ROLE_KEY` or `HF_TOKEN` in `.env.local`, `src/`, or git.
- Never pass `state=` to `/extract_glb`. It lives in the Gradio session (research R1).
- Commit after each task or logical group.
