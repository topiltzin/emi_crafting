-- albums.photo_count maintained by the database.
-- Idempotent: safe to run against a database that already has schema.sql applied.
--
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)
--
-- Replaces 0003's adjust_album_photo_count() RPC, which the browser had to call after every
-- photo insert/delete. If that call failed after the photo row was already saved, the upload was
-- reported as failed and the count drifted. A trigger makes the count part of the same
-- statement as the photo change: it can't be skipped, lost, or fail separately.
--
-- photo_count = number of the album's photos with deleted_at is null.

create or replace function public.sync_album_photo_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  was_counted boolean := tg_op in ('UPDATE', 'DELETE') and old.deleted_at is null;
  is_counted boolean := tg_op in ('INSERT', 'UPDATE') and new.deleted_at is null;
begin
  if tg_op = 'UPDATE'
     and old.album_id is not distinct from new.album_id
     and was_counted = is_counted then
    return null;
  end if;

  if was_counted then
    update public.albums
       set photo_count = greatest(0, photo_count - 1), updated_at = now()
     where id = old.album_id;
  end if;

  if is_counted then
    update public.albums
       set photo_count = photo_count + 1, updated_at = now()
     where id = new.album_id;
  end if;

  return null;
end;
$$;

drop trigger if exists photos_sync_album_photo_count on public.photos;
create trigger photos_sync_album_photo_count
  after insert or delete or update of album_id, deleted_at on public.photos
  for each row execute function public.sync_album_photo_count();

-- Correct any drift accumulated while the browser maintained the count.
update public.albums a
   set photo_count = (
     select count(*) from public.photos p where p.album_id = a.id and p.deleted_at is null
   )
 where photo_count is distinct from (
     select count(*) from public.photos p where p.album_id = a.id and p.deleted_at is null
   );

drop function if exists public.adjust_album_photo_count(uuid, integer);
