-- Atomic album photo_count adjustment.
-- Idempotent: safe to run against a database that already has schema.sql applied.
--
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)
--
-- The browser used to read photo_count and write back count ± 1. Uploads now run several at a
-- time, so two of those read-modify-writes could interleave and lose an increment. A single
-- UPDATE ... SET photo_count = photo_count + delta is atomic.
--
-- security invoker: the caller's RLS (albums_owner_all) still decides which rows it can touch.

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
