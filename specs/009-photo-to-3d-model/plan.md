# Implementation Plan: Photo to 3D Model

**Branch**: `009-photo-to-3d-model` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-photo-to-3d-model/spec.md`

## Summary

Users can turn any of their craft photos into a 3D model with one tap. The browser enqueues a job through a Supabase RPC. A small **standalone Python worker** picks up the job and runs the Hugging Face **TRELLIS.2** Space in one Gradio session: `/preprocess_image` → `/image_to_3d` → `/extract_glb`. The worker saves the resulting **GLB** to the private `photos` Storage bucket and points the photo at it. The photo viewer shows the job's status by polling, and it renders the model with a lazy-loaded `<model-viewer>` component (rotate, zoom, reset, download, redo, remove).

Two research findings changed the approach compared with the request's snippet (see [research.md](./research.md)):
- **R1**: The live API keeps `state` server-side per session and needs a separate background-removal call.
- **R2**: Supabase Edge Functions can run for only 150 s on the Free plan, so a separate worker is required.

## Technical Context

**Language/Version**: Browser is vanilla JavaScript (ES modules, built with Vite 4). Worker is Python 3.12. Database logic is SQL (Postgres 15, Supabase).

**Primary Dependencies**: Existing `@supabase/supabase-js` ^2.116. New browser dependency: `@google/model-viewer` (lazy-loaded). New worker dependencies: `gradio_client`, `supabase` (supabase-py), `Pillow`, `python-dotenv`.

**Storage**: Supabase Postgres, with new `photos.model_*` columns and a new `model_conversions` table. Model files go in the existing private Storage bucket `photos` at `<owner>/<photo>/model-<job>.glb`.

**Testing**: Browser uses Vitest + jsdom, with the existing `tests/helpers/fake-supabase.js` extended with `rpc()` and Storage `list()`. Worker uses pytest + pytest-cov, with ruff and mypy --strict. Database behavior is checked with the SQL scenarios in quickstart.md.

**Target Platform**: Modern desktop and mobile browsers with WebGL (a fallback is shown without it). The worker runs on any always-on Linux host or container.

**Project Type**: A static web SPA with Supabase as the backend, plus one background worker service.

**Performance Goals**: A model is interactive within ≤ 3 s on broadband and ≤ 8 s on mobile (SC-003). Rotation is smooth on mid-range phones (SC-006). At least 90% of conversions finish within ≤ 5 min when the Space is healthy (SC-002). The main JS bundle must not grow by more than 2 KB gzip, because model-viewer is code-split.

**Constraints**: 10-minute job deadline (FR-006). Models are capped at 50 MB (FR-016, which is also the Supabase Free per-file limit). At most 3 active jobs per user and 1 per photo (FR-015). The service-role key and HF token live only in the worker environment. The ZeroGPU daily quota is external (research R3).

**Scale/Scope**: A single-owner family account, with tens to low hundreds of conversions over the app's lifetime. One worker process is enough, though the claim query is safe with several workers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Code Quality | Lint and format enforced on all new code | ✅ ESLint/Prettier cover `src/`. The worker adds ruff (lint and format). | ✅ |
| II. Comprehensive Testing | >80% coverage; integration test for critical paths; tests written alongside code | ✅ Planned: Vitest unit and integration tests for module, panel, badge, and flow; pytest suite for the worker with a ≥80% gate. | ✅ The external Space is mocked in automated tests; the live end-to-end run is in quickstart §5. |
| III. Performance | Targets documented and measured | ✅ SC-002/003/006 plus a bundle budget | ✅ Lazy `import()` of model-viewer; 1024 px texture and 100k faces keep GLBs small (R4). |
| IV. UX Consistency | Existing patterns, accessibility | ✅ Reuses `openDialog`, `showConfirmDialog`, sticker tokens, badge pattern from tutorial links | ✅ Every control is a `<button>`; aria-live status (contracts/client-module.md). |
| V. Simplicity | No speculative abstractions | ⚠️ Adds a second runtime (Python worker) | ✅ Justified below. The worker is a single polling loop, and Realtime/queues/Edge chaining were rejected (R2, R7). |
| QA: Type safety | Strict typing where typing is used | ✅ The JS codebase is untyped, which matches existing practice. The worker uses type hints with `mypy --strict`. | ✅ |
| QA: Documentation | Non-obvious details documented | ✅ `DEPLOYMENT.md` gets a "3D worker" section; `worker/README.md`; `.env.example` gets a note about the new secrets | ✅ |

**Result**: PASS with one justified complexity item (below).

## Project Structure

### Documentation (this feature)

```text
specs/009-photo-to-3d-model/
├── plan.md              # This file
├── research.md          # Phase 0: API findings, runtime choice, quota, settings, viewer
├── data-model.md        # Phase 1: photos.model_* + model_conversions, states
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── database.md          # RPCs, access matrix
│   ├── trellis-service.md   # External Space call sequence + error mapping
│   └── client-module.md     # Browser module API + UI states
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
supabase/
├── migrations/0002_add_photo_3d_models.sql   # NEW: columns, table, indexes, RLS, RPCs, grants
└── schema.sql                                # UPDATED: mirror of the migration

src/
├── modules/
│   ├── model-conversion.js    # NEW: request/poll/status/URLs/remove (contracts/client-module.md)
│   └── db.js                  # UPDATED: hard delete also removes model files
├── ui/
│   ├── model-3d-panel.js      # NEW: status/button/toggle/model-viewer/menu
│   ├── model-badge.js         # NEW: "3D" sticker for photo cards
│   ├── photo-card.js          # UPDATED: mount badge
│   └── photo-viewer.js        # UPDATED: mount panel, destroy on close
└── styles/                    # UPDATED: panel, badge, viewer sizing

tests/
├── helpers/fake-supabase.js   # UPDATED: rpc(), storage list()
├── unit/model-conversion.test.js
├── unit/model-3d-panel.test.js
├── unit/model-badge.test.js
└── integration/photo-to-3d-flow.test.js

worker/                        # NEW: standalone Python service
├── pyproject.toml             # deps, ruff, mypy, pytest config
├── Dockerfile
├── .env.example               # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HF_TOKEN, TRELLIS_SPACE, POLL_SECONDS
├── README.md
├── trellis_worker/
│   ├── __main__.py            # poll loop: fail_stale → claim → run → sleep
│   ├── config.py              # env loading/validation
│   ├── settings.py            # allowed-range validation of job.settings
│   ├── job_runner.py          # orchestrates one job, deadline, complete/fail/discard
│   ├── trellis.py             # the 3-step Gradio session (contracts/trellis-service.md)
│   ├── image_prep.py          # download original, EXIF-orient, resize to 1024 px PNG
│   ├── storage.py             # upload/delete GLB via service role
│   └── errors.py              # exception → error_code/message mapping
└── tests/                     # pytest: runner, trellis (mocked Client), errors, image_prep

DEPLOYMENT.md                  # UPDATED: migration + worker hosting + secrets
```

**Structure Decision**: The existing single-SPA layout (`src/`, `tests/`, `supabase/`) is extended in place. One new top-level `worker/` package holds the only server-side long-running code, kept separate so its Python toolchain doesn't touch the Node build.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Second runtime (Python worker) plus a host to run it | A conversion takes 3–10 min and must survive the tab closing (FR-005, FR-006). The static SPA can't run background work, and Supabase Edge Functions stop at 150 s on the Free plan. | Edge Function background task: times out almost every time on Free (R2). Browser-driven: violates FR-005 and would expose the HF token. Chained edge calls with a raw Gradio session: depends on undocumented Gradio behavior (R2). |
| `SECURITY DEFINER` RPCs instead of plain table writes | The per-user and per-photo active-job limits (FR-015) must be atomic and must not be bypassable from the browser. | Client-side checks alone can race or be bypassed. A plain unique index covers only the per-photo limit. |

## Risks

1. **ZeroGPU quota (high likelihood)**: A free HF token may allow only a few conversions per day. Mitigation: friendly `SERVICE_QUOTA` message, a PRO token recommended in docs, and the Space id is configurable (R3).
2. **External Space changes its API**: Mitigation: the worker validates the endpoint names at startup with `client.view_api()` and logs a clear error. Everything Space-specific is isolated in `trellis.py`.
3. **Worker host downtime**: Mitigation: the client shows jobs older than 10 minutes as failed (R7), so the UI never hangs.
4. **Privacy**: Photos go to a third-party service only on an explicit tap (FR-002). This is noted in the contract.
