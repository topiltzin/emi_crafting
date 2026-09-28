# Data Model: Photo to 3D Model

**Feature**: 009-photo-to-3d-model | **Date**: 2026-09-27

Two changes to the Supabase Postgres schema: new columns on `photos` for the **current 3D model**, and a new `model_conversions` table for **conversion jobs**. The SQL goes in `supabase/migrations/0002_add_photo_3d_models.sql` and is mirrored into `supabase/schema.sql`, following the pattern from spec 008.

---

## Entity: Photo (existing, extended)

New nullable columns. All four are set together or all are null.

| Column | Type | Rules |
|---|---|---|
| `model_storage_path` | `text` | Storage path in bucket `photos`: `<owner_id>/<photo_id>/model-<job_id>.glb`. Null means the photo has no 3D model. |
| `model_file_size` | `bigint` | Bytes; `> 0` and `<= 52428800` (50 MB, FR-016). |
| `model_generated_at` | `timestamptz` | When the current model was saved. |
| `model_job_id` | `uuid` | The `model_conversions.id` that produced the current model (traceability, R4). No FK, so pruning job history never breaks the photo. |

**Constraint** `photos_model_all_or_nothing`: `(model_storage_path is null) = (model_file_size is null) and (model_storage_path is null) = (model_generated_at is null)`.

**Constraint** `photos_model_path_prefix`: `model_storage_path is null or model_storage_path like owner_id::text || '/' || id::text || '/model-%.glb'`. This stops a path from pointing into another photo's folder.

**Derived UI state** (client-only):
- `has3dModel = model_storage_path != null` → "3D" badge (FR-009)

**Who writes**:
- **Worker (service role)**: sets all four columns on success.
- **Owner (browser, existing RLS)**: can set all four to null when removing a model (FR-013).

---

## Entity: ConversionJob — table `model_conversions` (new)

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `owner_id` | `uuid` not null → `auth.users(id)` | Always equals the photo's `owner_id` (set by the RPC from `auth.uid()`). |
| `photo_id` | `uuid` not null → `photos(id)` **on delete cascade** | FR-014: hard delete removes jobs. |
| `status` | `text` not null | One of `queued`, `processing`, `completed`, `failed`, `canceled`. |
| `is_redo` | `boolean` not null default false | True when the photo already had a model at request time. |
| `seed` | `integer` not null | `0` for a first conversion; random in `[0, 2^31-1]` for a redo (R4). |
| `settings` | `jsonb` not null | Snapshot of the generation parameters used (R4). |
| `error_code` | `text` | Set only when `status = 'failed'`. One of the codes in the table below. |
| `error_message` | `text` | Friendly message shown to the user; ≤ 500 characters. |
| `result_storage_path` | `text` | Set when `completed`. |
| `result_file_size` | `bigint` | Set when `completed`. |
| `worker_id` | `text` | Which worker claimed the job (for debugging). |
| `requested_at` | `timestamptz` not null default `now()` | The 10-minute deadline is measured from this (FR-006). |
| `started_at` | `timestamptz` | Set on claim. |
| `finished_at` | `timestamptz` | Set when the job reaches any terminal status. |

**Indexes**
- `uniq_model_conversions_active_photo`: unique `(photo_id)` `where status in ('queued','processing')`. FR-015: at most one active job per photo.
- `idx_model_conversions_claim`: `(status, requested_at)` `where status = 'queued'`. Used by the worker's claim query.
- `idx_model_conversions_photo_recent`: `(photo_id, requested_at desc)`. Used to fetch the latest job for a photo.

**Checks**
- `status in (...)`
- `(status = 'failed') = (error_code is not null)`
- `(status = 'completed') = (result_storage_path is not null)`
- `status in ('queued') or started_at is not null`

**RLS**
- `enable row level security`
- Policy `model_conversions_owner_select`: `for select using (owner_id = auth.uid())`
- **No** insert, update, or delete policies for `authenticated`. Writes happen only through the `SECURITY DEFINER` RPCs or by the service role (see [contracts/database.md](./contracts/database.md)).

### Error codes

| `error_code` | Cause | User message (FR-006, edge cases) |
|---|---|---|
| `TIMEOUT` | Not done 10 minutes after the request | "This one took too long. Want to try again?" |
| `SERVICE_BUSY` | Space queue full, Space sleeping or erroring, connection failure | "The 3D maker is busy right now. Try again in a little while." |
| `SERVICE_QUOTA` | ZeroGPU quota exceeded (R3) | "The 3D maker is out of energy for today — try again later." |
| `INVALID_IMAGE` | Original couldn't be downloaded or decoded, or preprocessing found no subject | "We couldn't read this photo. Try a clearer photo of one object." |
| `RESULT_TOO_LARGE` | GLB larger than 50 MB | "The 3D model came out too big to save. Try again." |
| `INTERNAL` | Anything else | "Something went wrong making the 3D model. Try again." |

### State transitions

```text
            request_model_conversion()
                     │
                     ▼
                 ┌────────┐  claim_model_conversion()  ┌────────────┐
                 │ queued │ ─────────────────────────▶ │ processing │
                 └────────┘                            └────────────┘
                     │  stale >10 min                     │   │   │
                     │  (fail_stale_...)                  │   │   │ photo soft-deleted
                     ▼                                    │   │   ▼ before finalize
                 ┌────────┐ ◀── error / deadline ─────────┘   │ ┌──────────┐
                 │ failed │                                   │ │ canceled │
                 └────────┘                                   │ └──────────┘
                                                success       ▼
                                                        ┌───────────┐
                                                        │ completed │
                                                        └───────────┘
```

- **Terminal statuses**: `completed`, `failed`, `canceled`. A retry or redo always creates a **new** job row, so no row leaves a terminal status.
- **Hard delete** of the photo removes the row at any status (cascade). An in-flight worker then finds the photo missing, deletes its uploaded file, and stops (research R8).

### Completing a job (worker, one transaction via RPC `complete_model_conversion`)

1. Lock the photo row (`for update`). If it is missing or `deleted_at is not null`, mark the job `canceled` and return `discard = true`. The worker then deletes the uploaded file.
2. Save the photo's previous `model_storage_path` (if any) as `old_path`.
3. Set the photo's model columns to the new result, and set the job to `completed` with `result_*` and `finished_at`.
4. Return `old_path`. The worker deletes it from Storage **after** commit. A redo swaps to the new model only when it succeeds (FR-012), and a failed redo leaves the old model untouched.

---

## Entity: 3D Model (logical)

This is not a separate table. It is the pair of the `photos.model_*` columns and the Storage object they point to. It is represented this way because the spec allows exactly one current model per photo, and keeping it on `photos` means the gallery needs no join (research R6).

## Validation rules → requirements

| Rule | Requirement |
|---|---|
| One active job per photo (unique partial index + RPC check) | FR-015 |
| ≤ 3 active jobs per owner (RPC with advisory lock) | FR-015 |
| 10-minute deadline from `requested_at` | FR-006 |
| `model_file_size <= 50 MB` | FR-016 |
| Owner-only SELECT; model files in the owner folder | FR-008 |
| Cascade delete jobs; hard delete removes model files | FR-014 |
| New model replaces the old one only in `complete_model_conversion` | FR-012 |
| Original photo columns are never written by the conversion path | FR-018 |
