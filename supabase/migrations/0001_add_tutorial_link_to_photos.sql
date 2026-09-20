-- Adds optional YouTube tutorial link storage to photos (spec 008-craft-tutorial-links).
-- Idempotent: safe to run against a database that already has schema.sql applied.
--
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)

alter table public.photos
  add column if not exists tutorial_link jsonb default null;

-- Structural validation mirrors data-model.md's TutorialLink field constraints so bad writes
-- fail fast at the database layer, not just in client-side validation.
alter table public.photos
  drop constraint if exists photos_tutorial_link_structure;

alter table public.photos
  add constraint photos_tutorial_link_structure check (
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
  );

-- Supports US3 (filter/browse by creator): pull distinct channelIds and count photos per
-- creator without a full sequential scan once a user has hundreds of tutorial-linked photos.
create index if not exists idx_photos_tutorial_link_channel_id
  on public.photos using gin ((tutorial_link -> 'channelId'));
