# Quickstart & Validation: Photo to 3D Model

**Feature**: 009-photo-to-3d-model

This guide proves the feature works end to end. Contracts: [database](./contracts/database.md), [TRELLIS service](./contracts/trellis-service.md), [browser module/UI](./contracts/client-module.md). Data: [data-model.md](./data-model.md).

## Prerequisites

- The existing app setup from `DEPLOYMENT.md`: Supabase project, `photos` bucket, owner account, `.env.local`.
- Python 3.12 and `pip`/`uv` for the worker.
- A Hugging Face account and access token (`HF_TOKEN`, read scope). A PRO token is recommended: free accounts get only a small daily ZeroGPU allowance, which may cover just a few conversions per day (research R3).
- The Supabase **service-role key**, for the worker only. Keep it in the worker's own environment, never in the repo or `.env.local`.

## 1. Apply the database changes

```bash
supabase db push            # applies supabase/migrations/0002_add_photo_3d_models.sql
```

Expected: `photos` has the `model_*` columns; `model_conversions` exists with RLS enabled; the RPCs `request_model_conversion`, `claim_model_conversion`, `complete_model_conversion`, `fail_model_conversion`, `fail_stale_model_conversions` exist.

## 2. Run the worker

```bash
cd worker
cp .env.example .env        # fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HF_TOKEN
pip install -e ".[dev]"
python -m trellis_worker    # logs: "worker <id> polling every 10s"
```

(Or `docker build -t emi-3d-worker worker && docker run --env-file worker/.env emi-3d-worker` on any always-on host.)

## 3. Automated checks

```bash
npm test                          # Vitest: model-conversion, model-3d-panel, model-badge, photo-to-3d-flow
npm run lint
cd worker && pytest --cov=trellis_worker --cov-fail-under=80 && ruff check . && mypy --strict trellis_worker
```

## 4. Database rule checks (SQL editor as the owner, or `supabase start` locally)

| # | Action | Expected |
|---|---|---|
| D1 | `select request_model_conversion('<photo>')` twice | The second call raises `ALREADY_CONVERTING`. |
| D2 | Request on 4 different photos while the worker is stopped | The 4th raises `CONVERSION_LIMIT`. |
| D3 | Request on another user's or a nonexistent photo id | `PHOTO_NOT_FOUND`. |
| D4 | `insert into model_conversions ...` directly as `authenticated` | Denied by RLS. |
| D5 | `select claim_model_conversion('x')` as `authenticated` | Permission denied. |
| D6 | Leave a job queued with the worker stopped for more than 10 min, then start the worker | The job becomes `failed/TIMEOUT`. |

## 5. End-to-end scenarios (`npm run dev`, worker running)

| # | Story | Steps | Expected |
|---|---|---|---|
| E1 | US1 | Upload a photo of one craft on a plain background → open it → **Make it 3D ✨** | The button disables and the "Making your 3D model…" status shows. Uploading alone never starts a conversion (FR-002). |
| E2 | US1 | While E1 runs, close the tab and wait about 5 min, then reopen the app | The photo card shows a **3D** badge. In the DB, the job is `completed` and the `photos.model_*` columns are set. |
| E3 | US2 | Open the photo → toggle **3D** | A spinner, then the model within 3 s on broadband (SC-003). Drag rotates, scroll/pinch zooms, **Reset view** recenters. |
| E4 | US2 | Repeat E3 in phone emulation (390 px wide) and on a real phone | Fits the screen with no horizontal scroll; touch rotate and pinch zoom work smoothly (SC-006). |
| E5 | US2 | Disable WebGL (Chrome flag `--disable-webgl`) → toggle 3D | The friendly fallback message shows and the photo is still visible. |
| E6 | US3 | Stop the worker, request a conversion, wait 10 min | "This one took too long…" and **Try again** shown. The original photo is unchanged. |
| E7 | US3 | Set `HF_TOKEN` to an invalid value → request | The job fails with a friendly message and no file is left in Storage. |
| E8 | US3 | On a photo with a model: **Redo 3D model** | The old model stays viewable until the new one completes, then it is replaced. The old `.glb` is gone from Storage. The new job's `seed ≠ 0`. |
| E9 | US3 | **Remove 3D model** → confirm | The badge disappears, the `.glb` is deleted, and the photo is unchanged. |
| E10 | US3 | Hard-delete a photo that has a model, and another whose conversion is in progress | Both folders are empty in Storage; job rows are gone; the worker log shows "discarded". |
| E11 | US4 | **Download 3D model** | `<name>-3d.glb` downloads and opens in a desktop glTF viewer (e.g. https://gltf-viewer.donmccurdy.com). |
| E12 | Privacy | Open a second browser signed out, paste a model's Storage path URL without a signature | 400/403. The model isn't publicly reachable (FR-008). |

## 6. Success criteria spot-checks

- **SC-002**: Run 10 conversions of single-object photos while the Space is healthy. At least 9 should complete in ≤ 5 min (`finished_at - requested_at`).
- **SC-005**: For every failed job in the table above, confirm a friendly message, a retry button, and no leftover `model-*.glb` (`storage.list('<owner>/<photo>/')`).
- **SC-007**: Hand the app to 5 family members (including a child) and ask them to "find the 3D craft and spin it". At least 4 should succeed without help.

## Build budget (T050, measured 2026-09-27)

`vite build` on this branch vs `main` (gzip -9):

| Chunk | main | this branch | Δ |
|---|---|---|---|
| Entry `index-*.js` | 82,828 B | 83,214 B | **+386 B** (budget ≤ 2 KB ✅) |
| Entry `index-*.css` | 7,225 B | 7,798 B | +573 B |
| `model-3d-panel-*.js` (lazy, on photo open) | — | 3,668 B | new |
| `model-viewer-*.js` (lazy, on first 3D view) | — | 289,848 B | new |

The first version exceeded the budget (+3.2 KB) with the panel in the entry chunk. `photo-viewer.js`
now `import()`s the panel so only the badge ships in the main bundle.

## Validation log (2026-09-27)

| Check | Where | Result |
|---|---|---|
| D1–D6 plus RLS, claim, complete/discard, redo old-path, constraints, cascade (26 checks) | `schema.sql` + migrations 0001/0002 (0002 applied twice for idempotency) on a local PostgreSQL 16 with stubbed `auth`/`storage` schemas | ✅ all pass |
| Worker pipeline against the **live** `microsoft/TRELLIS.2` Space (anonymous, the Space's own example image) | `generate_glb` via the worker's real code path | ✅ valid 4.68 MB GLB in 154 s. All 3 steps ran on one session hash. The GLB requires `EXT_texture_webp`, which model-viewer supports |
| E1–E11 browser flows | Vitest integration test `tests/integration/photo-to-3d-flow.test.js` against the fake backend | ✅ |
| E1–E12 against a real Supabase project + deployed worker | — | ⏳ **Not run yet**: needs the migration applied to the real project and the worker running with real secrets |
| Visual render of a real GLB in a browser | — | ⏳ Not run (no headless browser available here); covered by E3 once deployed |
