import { createAlbum, getAlbum, getAlbums } from './db.js';

export async function createAlbumIfNeeded(albumDate, title = null) {
  // Check if album already exists
  const albums = await getAlbums();
  const existing = albums.find((a) => a.album_date === albumDate);

  if (existing) {
    return { album: existing, created: false };
  }

  // Create new album
  const album = await createAlbum(albumDate, title);
  return { album, created: true };
}

export async function incrementPhotoCount(albumId) {
  const album = await getAlbum(albumId);
  if (!album) {
    throw new Error(`Album ${albumId} not found`);
  }
  // Photo count is incremented in db.createPhoto
  return album;
}

export async function decrementPhotoCount(albumId) {
  const album = await getAlbum(albumId);
  if (!album) {
    throw new Error(`Album ${albumId} not found`);
  }
  // Photo count is decremented in db.deletePhoto
  // TODO: Auto-delete empty albums if desired
  return album;
}

export function groupPhotosByDate(_files, dateMap = new Map()) {
  // Group files by album date
  // This will be called after EXIF extraction
  // Returns Map<date, files>
  return dateMap;
}

export async function ensureAlbumsExist(dateGroups) {
  const albums = [];

  for (const [date] of dateGroups) {
    const { album } = await createAlbumIfNeeded(date);
    albums.push(album);
  }

  return albums;
}
