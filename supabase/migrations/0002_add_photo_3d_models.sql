-- Adds photo → 3D model conversion (spec 009-photo-to-3d-model).
-- Idempotent: safe to run against a database that already has schema.sql applied.
--
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)
--
-- Design: specs/009-photo-to-3d-model/data-model.md and contracts/database.md.
-- The browser only ever calls request_model_conversion(); the other RPCs are for the
-- standalone worker (worker/), which authenticates with the service-role key.

-- ---------------------------------------------------------------------------
-- photos: pointer to the photo's current 3D model (all four set together, or all null)
-- ---------------------------------------------------------------------------

alter table public.photos add column if not exists model_storage_path text;
alter table public.photos add column if not exists model_file_size bigint;
alter table public.photos add column if not exists model_generated_at timestamptz;
-- No FK on purpose: pruning job history must never break the photo (data-model.md).
alter table public.photos add column if not exists model_job_id uuid;

alter table public.photos drop constraint if exists photos_model_all_or_nothing;
alter table public.photos add constraint photos_model_all_or_nothing check (
  (model_storage_path is null) = (model_file_size is null) and
  (model_storage_path is null) = (model_generated_at is null)
);

alter table public.photos drop constraint if exists photos_model_file_size_range;
alter table public.photos add constraint photos_model_file_size_range check (
  model_file_size is null or (model_file_size > 0 and model_file_size <= 52428800)
);

-- A model path must live in this photo's own Storage folder.
alter table public.photos drop constraint if exists photos_model_path_prefix;
alter table public.photos add constraint photos_model_path_prefix check (
  model_storage_path is null or
  model_storage_path like owner_id::text || '/' || id::text || '/model-%.glb'
);

-- ---------------------------------------------------------------------------
-- model_conversions: one row per conversion attempt
-- ---------------------------------------------------------------------------

create table if not exists public.model_conversions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  photo_id uuid not null references public.photos(id) on delete cascade,
  status text not null,
  is_redo boolean not null default false,
  seed integer not null,
  settings jsonb not null,
  error_code text,
  error_message text,
  result_storage_path text,
  result_file_size bigint,
  worker_id text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint model_conversions_status_check
    check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  constraint model_conversions_failed_has_code
    check ((status = 'failed') = (error_code is not null)),
  constraint model_conversions_completed_has_result
    check ((status = 'completed') = (result_storage_path is not null)),
  constraint model_conversions_started
    check (status in ('queued') or started_at is not null),
  constraint model_conversions_error_code_check
    check (error_code is null or error_code in (
      'TIMEOUT', 'SERVICE_BUSY', 'SERVICE_QUOTA', 'INVALID_IMAGE', 'RESULT_TOO_LARGE', 'INTERNAL'
    )),
  constraint model_conversions_error_message_length
    check (error_message is null or char_length(error_message) <= 500)
);

-- FR-015: at most one active job per photo.
create unique index if not exists uniq_model_conversions_active_photo
  on public.model_conversions (photo_id) where status in ('queued', 'processing');
create index if not exists idx_model_conversions_claim
  on public.model_conversions (status, requested_at) where status = 'queued';
create index if not exists idx_model_conversions_photo_recent
  on public.model_conversions (photo_id, requested_at desc);

alter table public.model_conversions enable row level security;

-- Owner can read their jobs. No insert/update/delete policies: writes go through the
-- SECURITY DEFINER RPCs below (browser) or the service role (worker).
drop policy if exists "model_conversions_owner_select" on public.model_conversions;
create policy "model_conversions_owner_select" on public.model_conversions
  for select
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Generation settings: single source of truth (the worker reads them from each job row)
-- ---------------------------------------------------------------------------

create or replace function public.model_conversion_default_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'texture_resolution', 1024,
    'foreground_ratio', 0.85,
    'remesh', 'none',
    'vertex_count', -1
  );
$$;

-- ---------------------------------------------------------------------------
-- Browser RPC: enqueue a conversion (FR-001, FR-002, FR-015)
-- ---------------------------------------------------------------------------

create or replace function public.request_model_conversion(p_photo_id uuid)
returns public.model_conversions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_photo public.photos;
  v_active_count integer;
  v_is_redo boolean;
  v_job public.model_conversions;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  -- Serializes the per-owner limit check so two quick taps can't both slip under it.
  perform pg_advisory_xact_lock(hashtext('model_conv:' || v_uid::text));

  select * into v_photo
  from public.photos
  where id = p_photo_id and owner_id = v_uid and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'PHOTO_NOT_FOUND';
  end if;

  -- A stale active job (worker down) must not block a retry forever.
  update public.model_conversions
  set status = 'failed',
      error_code = 'TIMEOUT',
      error_message = 'This one took too long. Want to try again?',
      started_at = coalesce(started_at, now()),
      finished_at = now()
  where photo_id = p_photo_id
    and status in ('queued', 'processing')
    and requested_at < now() - interval '10 minutes';

  if exists (
    select 1 from public.model_conversions
    where photo_id = p_photo_id and status in ('queued', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_CONVERTING';
  end if;

  select count(*) into v_active_count
  from public.model_conversions
  where owner_id = v_uid
    and status in ('queued', 'processing')
    and requested_at >= now() - interval '10 minutes';

  if v_active_count >= 3 then
    raise exception using errcode = 'P0001', message = 'CONVERSION_LIMIT';
  end if;

  v_is_redo := v_photo.model_storage_path is not null;

  insert into public.model_conversions (owner_id, photo_id, status, is_redo, seed, settings)
  values (
    v_uid,
    p_photo_id,
    'queued',
    v_is_redo,
    -- Same image + same seed = identical model, so a redo needs a fresh seed (research R4).
    case when v_is_redo then floor(random() * 2147483647)::integer else 0 end,
    public.model_conversion_default_settings()
  )
  returning * into v_job;

  return v_job;
end;
$$;

revoke execute on function public.request_model_conversion(uuid) from public, anon;
grant execute on function public.request_model_conversion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Worker RPCs (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.claim_model_conversion(p_worker_id text)
returns public.model_conversions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.model_conversions;
begin
  update public.model_conversions
  set status = 'processing', started_at = now(), worker_id = p_worker_id
  where id = (
    select id from public.model_conversions
    where status = 'queued'
    order by requested_at
    for update skip locked
    limit 1
  )
  returning * into v_job;

  return v_job;
end;
$$;

-- Swaps the photo's model pointer only on success, so a failed redo keeps the old model
-- (FR-012). Never touches the original photo's columns (FR-018).
create or replace function public.complete_model_conversion(
  p_job_id uuid,
  p_path text,
  p_size bigint
)
returns table (discard boolean, old_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.model_conversions;
  v_photo public.photos;
begin
  select * into v_job from public.model_conversions where id = p_job_id for update;

  -- Missing (photo hard-deleted → cascade) or already timed out by the sweeper.
  if not found or v_job.status <> 'processing' then
    return query select true, null::text;
    return;
  end if;

  select * into v_photo from public.photos where id = v_job.photo_id for update;

  if not found or v_photo.deleted_at is not null then
    update public.model_conversions
    set status = 'canceled', finished_at = now()
    where id = p_job_id;
    return query select true, null::text;
    return;
  end if;

  update public.photos
  set model_storage_path = p_path,
      model_file_size = p_size,
      model_generated_at = now(),
      model_job_id = p_job_id,
      updated_at = now()
  where id = v_photo.id;

  update public.model_conversions
  set status = 'completed',
      result_storage_path = p_path,
      result_file_size = p_size,
      finished_at = now()
  where id = p_job_id;

  return query select false, v_photo.model_storage_path;
end;
$$;

create or replace function public.fail_model_conversion(
  p_job_id uuid,
  p_code text,
  p_message text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.model_conversions
  set status = 'failed',
      error_code = p_code,
      error_message = left(p_message, 500),
      finished_at = now()
  where id = p_job_id and status = 'processing';
$$;

-- FR-006: nothing stays "in progress" more than 10 minutes, even if the worker crashed.
create or replace function public.fail_stale_model_conversions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.model_conversions
  set status = 'failed',
      error_code = 'TIMEOUT',
      error_message = 'This one took too long. Want to try again?',
      started_at = coalesce(started_at, now()),
      finished_at = now()
  where status in ('queued', 'processing')
    and requested_at < now() - interval '10 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.claim_model_conversion(text) from public, anon, authenticated;
revoke execute on function public.complete_model_conversion(uuid, text, bigint) from public, anon, authenticated;
revoke execute on function public.fail_model_conversion(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_stale_model_conversions() from public, anon, authenticated;

grant execute on function public.claim_model_conversion(text) to service_role;
grant execute on function public.complete_model_conversion(uuid, text, bigint) to service_role;
grant execute on function public.fail_model_conversion(uuid, text, text) to service_role;
grant execute on function public.fail_stale_model_conversions() to service_role;
