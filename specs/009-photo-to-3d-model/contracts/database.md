# Contract: Database RPCs and Access

**Feature**: 009-photo-to-3d-model

This contract covers every database entry point the browser and the worker use for this feature. The tables are defined in [../data-model.md](../data-model.md).

## Access matrix

| Actor | `photos.model_*` | `model_conversions` | Storage `photos/<owner>/<photo>/model-*.glb` |
|---|---|---|---|
| Browser (owner, `authenticated`) | SELECT; UPDATE to null only (remove model) | SELECT own rows; write **only** via `request_model_conversion` | read (signed URL), delete (existing policies) |
| Worker (`service_role`) | written only via `complete_model_conversion` | via `claim_…`, `fail_…`, `complete_…`, `fail_stale_…` | upload, delete (bypasses RLS) |

The service-role key exists **only** in the worker's environment. It never goes in `.env*`, the repo, or the browser bundle.

---

## `request_model_conversion(p_photo_id uuid) → model_conversions`

**Caller**: browser (`supabase.rpc('request_model_conversion', { p_photo_id })`)
**Security**: `SECURITY DEFINER`, `set search_path = public`; `EXECUTE` granted to `authenticated`.

Behavior, in one transaction:
1. `auth.uid()` must not be null; otherwise raise `NOT_AUTHENTICATED`.
2. `pg_advisory_xact_lock(hashtext('model_conv:' || auth.uid()))`. This serializes the per-owner limit check.
3. Load the photo `where id = p_photo_id and owner_id = auth.uid() and deleted_at is null`. If there's no row, raise `PHOTO_NOT_FOUND`.
4. If an active job (`queued`/`processing`) exists for this photo **and** it is younger than 10 minutes, raise `ALREADY_CONVERTING`. If an active job is older than 10 minutes, first mark it `failed/TIMEOUT`, then continue.
5. Count the owner's active jobs younger than 10 minutes. If there are 3 or more, raise `CONVERSION_LIMIT`.
6. Insert `{owner_id, photo_id, status:'queued', is_redo: photo.model_storage_path is not null, seed: is_redo ? floor(random()*2147483647) : 0, settings: <app default settings jsonb>}` and return the row.

**Errors**: raised with `raise exception using errcode = 'P0001', message = '<CODE>'`. The browser maps `error.message` to friendly text:

| Code | UI text |
|---|---|
| `NOT_AUTHENTICATED` | (session expired → existing sign-in flow) |
| `PHOTO_NOT_FOUND` | "This photo isn't available anymore." |
| `ALREADY_CONVERTING` | (UI already disables the button; shows current status) |
| `CONVERSION_LIMIT` | "You already have 3 models cooking — please wait for one to finish." |

The app's default settings jsonb lives in the migration as a SQL function `model_conversion_default_settings()`. The worker reads `settings` from the job row, so this function is the **single source of truth** for generation parameters. The worker's `settings.py` only validates them against the allowed ranges.

---

## `claim_model_conversion(p_worker_id text) → model_conversions | null`

**Caller**: worker. **Security**: `SECURITY DEFINER`; `EXECUTE` revoked from `public`/`authenticated`, granted to `service_role`.

```sql
update model_conversions set status='processing', started_at=now(), worker_id=p_worker_id
where id = (select id from model_conversions
            where status='queued' order by requested_at
            for update skip locked limit 1)
returning *;
```

---

## `complete_model_conversion(p_job_id uuid, p_path text, p_size bigint) → table(discard boolean, old_path text)`

**Caller**: worker (service_role only). This is the transaction described in data-model.md under "Completing a job":
- If the photo is missing or soft-deleted: the job becomes `canceled` and the call returns `(true, null)`.
- Otherwise: the photo's `model_*` columns are set to the new result, the job becomes `completed`, and the call returns `(false, <previous model path or null>)`.
- If the job's status is not `processing` (for example, it was already timed out by the sweeper), it returns `(true, null)` and changes nothing. The late result is discarded.

## `fail_model_conversion(p_job_id uuid, p_code text, p_message text) → void`

**Caller**: worker (service_role only). Sets `failed`, `error_code`, `error_message`, and `finished_at`, but only if the status is `processing`. Otherwise it does nothing.

## `fail_stale_model_conversions() → integer`

**Caller**: worker, on every poll cycle (service_role only). Marks `queued`/`processing` jobs where `requested_at < now() - interval '10 minutes'` as `failed/TIMEOUT` and returns the count.

---

## Browser reads (plain PostgREST, existing RLS)

- **Latest job for a photo**: `from('model_conversions').select('*').eq('photo_id', id).order('requested_at', {ascending:false}).limit(1).maybeSingle()`
- **Photo rows** already use `select('*')`, so the new `model_*` columns come through the existing `db.js` reads with no query changes.
- **Remove model**: `storage.remove([model_storage_path])`, then `from('photos').update({model_storage_path:null, model_file_size:null, model_generated_at:null, model_job_id:null}).eq('id', id)`.
