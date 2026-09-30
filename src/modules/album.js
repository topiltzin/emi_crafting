import { createAlbum, getAlbumByDate, getAlbumDates } from './db.js';
import { toLocalIsoDate, nextIsoDate } from './dates.js';

export async function createAlbumIfNeeded(albumDate, title = null) {
  // Single-row lookup: this runs once per uploaded file, so it must not load every album
  // (and sign every cover URL) just to find one by date.
  const existing = await getAlbumByDate(albumDate);

  if (existing) {
    return { album: existing, created: false };
  }

  // Create new album
  const album = await createAlbum(albumDate, title);
  return { album, created: true };
}

// Manually creating a named album should always just work — the user typed a name, they don't
// want to think about (or collide on) a date. album_date still has to be unique per the schema,
// so this silently claims the earliest free date (today, or the next day that isn't already
// taken) rather than asking the user to pick one or resolve a collision themselves.
export async function createNamedAlbum(title) {
  const takenDates = new Set(await getAlbumDates());

  let albumDate = toLocalIsoDate();
  while (takenDates.has(albumDate)) {
    albumDate = nextIsoDate(albumDate);
  }

  return await createAlbum(albumDate, title);
}
