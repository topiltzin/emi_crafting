import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, createAlbum } from '../../src/modules/db.js';
import {
  createAlbumIfNeeded,
  createNamedAlbum
} from '../../src/modules/album.js';

describe('album module helpers', () => {
  beforeEach(async () => {
    await initDB();
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
