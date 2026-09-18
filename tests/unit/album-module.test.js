import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import {
  incrementPhotoCount,
  decrementPhotoCount,
  groupPhotosByDate,
  ensureAlbumsExist,
  createAlbumIfNeeded
} from '../../src/modules/album.js';

describe('album module helpers', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('incrementPhotoCount returns the current album when it exists', async () => {
    const album = await createAlbum('2026-09-14');
    const result = await incrementPhotoCount(album.id);
    expect(result.id).toBe(album.id);
  });

  it('incrementPhotoCount throws for a missing album', async () => {
    await expect(incrementPhotoCount('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'not found'
    );
  });

  it('decrementPhotoCount returns the current album when it exists', async () => {
    const album = await createAlbum('2026-09-15');
    const result = await decrementPhotoCount(album.id);
    expect(result.id).toBe(album.id);
  });

  it('decrementPhotoCount throws for a missing album', async () => {
    await expect(decrementPhotoCount('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'not found'
    );
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
      photo_data_base64: btoa('d')
    });

    const albums = await ensureAlbumsExist(new Map([['2026-09-12', []]]));
    expect(albums).toHaveLength(1);
    expect(albums[0].id).toBe(existing.id);
  });

  describe('createAlbumIfNeeded', () => {
    it('returns created: true and the new album when no album exists for the date', async () => {
      const result = await createAlbumIfNeeded('2026-09-20', 'Brand New');
      expect(result.created).toBe(true);
      expect(result.album.album_date).toBe('2026-09-20');
      expect(result.album.title).toBe('Brand New');
    });

    it('returns created: false and the existing album, with its title left unchanged, when one exists for the date', async () => {
      const existing = await createAlbum('2026-09-21', 'Original Title');

      const result = await createAlbumIfNeeded('2026-09-21', 'Ignored New Title');
      expect(result.created).toBe(false);
      expect(result.album.id).toBe(existing.id);
      expect(result.album.title).toBe('Original Title');
    });
  });
});
