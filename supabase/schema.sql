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
  constraint photos_filename_length check (char_length(filename) <= 255),
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
