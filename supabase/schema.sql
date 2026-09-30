-- Supabase Postgres schema + RLS for the photo organizer's cloud data migration.
--
-- Source of truth: specs/004-supabase-data-migration/contracts/schema.sql (design contract).
-- This copy is what gets applied to the actual Supabase project (SQL editor or
-- `supabase db push`). Keep the two in sync if the schema changes.

create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  album_date date not null,
  title text,
  photo_count integer not null default 0,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint albums_owner_date_unique unique (owner_id, album_date),
  constraint albums_title_length check (title is null or char_length(title) <= 255)
);

create index if not exists idx_albums_owner_deleted on public.albums (owner_id, deleted_at);
create index if not exists idx_albums_position on public.albums (owner_id, position);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  album_id uuid not null references public.albums(id),
  filename text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  photo_date date,
  upload_date timestamptz not null default now(),
  storage_path text not null,
  thumbnail_storage_path text,
  exif_json jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Optional YouTube tutorial link (spec 008-craft-tutorial-links). Shape:
  -- {url, videoId, title, creator, channelId, thumbnail, duration, addedAt}. channelId/duration
  -- may be null when metadata fetch fails and a placeholder is saved (see research.md fallback).
  tutorial_link jsonb,
  -- Current 3D model (spec 009-photo-to-3d-model): all four set together, or all null.
  model_storage_path text,
  model_file_size bigint,
  model_generated_at timestamptz,
  model_job_id uuid,
  constraint photos_filename_length check (char_length(filename) <= 255),
  constraint photos_model_all_or_nothing check (
    (model_storage_path is null) = (model_file_size is null) and
    (model_storage_path is null) = (model_generated_at is null)
  ),
  constraint photos_model_file_size_range check (
    model_file_size is null or (model_file_size > 0 and model_file_size <= 52428800)
  ),
  constraint photos_model_path_prefix check (
    model_storage_path is null or
    model_storage_path like owner_id::text || '/' || id::text || '/model-%.glb'
  ),
  constraint photos_tutorial_link_structure check (
    tutorial_link is null or (
      tutorial_link ? 'url' and
      tutorial_link ? 'videoId' and
      jsonb_typeof(tutorial_link -> 'videoId') = 'string' and
      char_length(tutorial_link ->> 'videoId') = 11 and
      tutorial_link ? 'title' and
      char_length(tutorial_link ->> 'title') between 1 and 255 and
      tutorial_link ? 'creator' and
      char_length(tutorial_link ->> 'creator') between 1 and 255 and
      tutorial_link ? 'thumbnail' and
      tutorial_link ? 'addedAt'
    )
  )
);

create index if not exists idx_photos_album_deleted on public.photos (album_id, deleted_at);
create index if not exists idx_photos_owner_deleted on public.photos (owner_id, deleted_at);
create index if not exists idx_photos_favorite on public.photos (owner_id, is_favorite) where deleted_at is null;
create index if not exists idx_photos_tutorial_link_channel_id
  on public.photos using gin ((tutorial_link -> 'channelId'));

-- Row Level Security: every row is only visible/writable by its owner (single-owner app).
alter table public.albums enable row level security;
alter table public.photos enable row level security;

create policy "albums_owner_all" on public.albums
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "photos_owner_all" on public.photos
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Storage: private bucket for original photos + thumbnails, owner-only access.
-- Create the bucket once via the dashboard/CLI (not plain SQL insert in most setups):
--   supabase storage buckets create photos --private
--
-- Storage policies (owner-only, keyed by the first path segment being the owner's uid,
-- e.g. objects stored at "<owner_id>/<photo_id>/original" and "<owner_id>/<photo_id>/thumb"):
create policy "photos_bucket_owner_read" on storage.objects
  for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos_bucket_owner_write" on storage.objects
  for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos_bucket_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- spec 009-photo-to-3d-model: conversion jobs + RPCs.
-- Mirror of supabase/migrations/0002_add_photo_3d_models.sql (keep the two in sync).

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

-- ---------------------------------------------------------------------------
-- Browser RPC: atomic album photo_count adjustment
-- (supabase/migrations/0003_adjust_album_photo_count.sql)
-- ---------------------------------------------------------------------------

create or replace function public.adjust_album_photo_count(p_album_id uuid, p_delta integer)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.albums
     set photo_count = greatest(0, photo_count + p_delta),
         updated_at = now()
   where id = p_album_id;
$$;

revoke execute on function public.adjust_album_photo_count(uuid, integer) from public, anon;
grant execute on function public.adjust_album_photo_count(uuid, integer) to authenticated;
