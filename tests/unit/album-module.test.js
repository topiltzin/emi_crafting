import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import {
  incrementPhotoCount,
  decrementPhotoCount,
  groupPhotosByDate,
  ensureAlbumsExist,
  createAlbumIfNeeded,
  createNamedAlbum
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

  describe('createNamedAlbum', () => {
    function todayIso() {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    it('creates the album on today\'s date when nothing else occupies it', async () => {
      const album = await createNamedAlbum('My Album');
      expect(album.title).toBe('My Album');
      expect(album.album_date).toBe(todayIso());
    });

    it('claims the next free date when today is already taken, with no error and no collision', async () => {
      await createAlbum(todayIso(), 'test');

      const album = await createNamedAlbum('FOLDER');

      expect(album.title).toBe('FOLDER');
      expect(album.album_date).not.toBe(todayIso());
    });

    it('walks forward past multiple consecutive taken dates', async () => {
      const d1 = todayIso();
      const d2 = new Date();
      d2.setUTCHours(0, 0, 0, 0);
      d2.setUTCDate(d2.getUTCDate() + 1);
      await createAlbum(d1, 'a');
      await createAlbum(d2.toISOString().slice(0, 10), 'b');

      const album = await createNamedAlbum('c');

      expect(album.album_date).not.toBe(d1);
      expect(album.album_date).not.toBe(d2.toISOString().slice(0, 10));
    });

    it('creating several named albums never collides and never reuses an existing row', async () => {
      const first = await createNamedAlbum('One');
      const second = await createNamedAlbum('Two');
      const third = await createNamedAlbum('Three');

      const dates = [first.album_date, second.album_date, third.album_date];
      expect(new Set(dates).size).toBe(3);
      expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    });
  });
});
