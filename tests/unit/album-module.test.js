import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import {
  incrementPhotoCount,
  decrementPhotoCount,
  groupPhotosByDate,
  ensureAlbumsExist
} from '../../src/modules/album.js';

describe('album module helpers', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('incrementPhotoCount returns the current album when it exists', async () => {
    const album = await createAlbum('2026-09-14');
    const result = incrementPhotoCount(album.id);
    expect(result.id).toBe(album.id);
  });

  it('incrementPhotoCount throws for a missing album', () => {
    expect(() => incrementPhotoCount(999999)).toThrow('Album 999999 not found');
  });

  it('decrementPhotoCount returns the current album when it exists', async () => {
    const album = await createAlbum('2026-09-15');
    const result = decrementPhotoCount(album.id);
    expect(result.id).toBe(album.id);
  });

  it('decrementPhotoCount throws for a missing album', () => {
    expect(() => decrementPhotoCount(999999)).toThrow('Album 999999 not found');
  });

  it('groupPhotosByDate returns the provided (or default) date map unchanged', () => {
    const map = new Map([['2026-09-14', ['a.jpg']]]);
    expect(groupPhotosByDate([], map)).toBe(map);
    expect(groupPhotosByDate([]) instanceof Map).toBe(true);
  });

  it('ensureAlbumsExist creates an album per date group', async () => {
    const dateGroups = new Map([
      ['2026-09-10', []],
      ['2026-09-11', []]
    ]);

    const albums = await ensureAlbumsExist(dateGroups);
    expect(albums).toHaveLength(2);
    expect(albums.map((a) => a.album_date).sort()).toEqual(['2026-09-10', '2026-09-11']);
  });

  it('ensureAlbumsExist reuses an existing album for the same date', async () => {
    const existing = await createAlbum('2026-09-12');
    await createPhoto(existing.id, {
      filename: 'a.jpg',
      file_size: 10,
      mime_type: 'image/jpeg',
      photo_data_base64: 'd'
    });

    const albums = await ensureAlbumsExist(new Map([['2026-09-12', []]]));
    expect(albums).toHaveLength(1);
    expect(albums[0].id).toBe(existing.id);
  });
});
