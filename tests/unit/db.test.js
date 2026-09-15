import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDB,
  createAlbum,
  getAlbum,
  getAlbums,
  createPhoto,
  getPhoto,
  getPhotos,
  getAllPhotos,
  deletePhoto,
  updateAlbumOrder,
  toggleFavorite
} from '../../src/modules/db.js';

describe('Database Module', () => {
  beforeEach(async () => {
    await initDB();
  });

  describe('Album Operations', () => {
    it('should create an album with unique date', async () => {
      const album = await createAlbum('2026-09-14', 'Test Album');
      expect(album).toBeDefined();
      expect(album.album_date).toBe('2026-09-14');
      expect(album.title).toBe('Test Album');
      expect(album.photo_count).toBe(0);
    });

    it('should retrieve an album by id', async () => {
      const created = await createAlbum('2026-09-15', 'Retrieve Test');
      const retrieved = getAlbum(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.album_date).toBe('2026-09-15');
    });

    it('should get all albums in correct order', async () => {
      await createAlbum('2026-09-10');
      await createAlbum('2026-09-15');
      await createAlbum('2026-09-12');

      const albums = getAlbums(false); // chronological
      expect(albums.length).toBeGreaterThan(0);
      // Most recent should be first
      expect(albums[0].album_date).toBe('2026-09-15');
    });
  });

  describe('Photo Operations', () => {
    it('should create a photo with album reference', async () => {
      const album = await createAlbum('2026-09-14');

      const photoData = {
        filename: 'test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_date: '2026-09-14',
        photo_data_base64: 'test_base64_data',
        thumbnail_base64: 'thumb_base64_data',
        exif_json: { DateTime: '2026:09:14 10:30:00' }
      };

      const photo = await createPhoto(album.id, photoData);
      expect(photo).toBeDefined();
      expect(photo.album_id).toBe(album.id);
      expect(photo.filename).toBe('test.jpg');
    });

    it('should retrieve a photo by id', async () => {
      const album = await createAlbum('2026-09-14');

      const photoData = {
        filename: 'retrieve.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        photo_date: '2026-09-14',
        photo_data_base64: 'data',
        thumbnail_base64: 'thumb'
      };

      const created = await createPhoto(album.id, photoData);
      const retrieved = getPhoto(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.filename).toBe('retrieve.jpg');
    });

    it('should get photos for an album', async () => {
      const album = await createAlbum('2026-09-14');

      for (let i = 0; i < 3; i++) {
        await createPhoto(album.id, {
          filename: `photo${i}.jpg`,
          file_size: 1024,
          mime_type: 'image/jpeg',
          photo_date: '2026-09-14',
          photo_data_base64: 'data',
          thumbnail_base64: 'thumb'
        });
      }

      const photos = getPhotos(album.id);
      expect(photos.length).toBe(3);
    });

    it('should increment photo count when adding photos', async () => {
      const album = await createAlbum('2026-09-14');
      expect(album.photo_count).toBe(0);

      await createPhoto(album.id, {
        filename: 'test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data'
      });

      const updated = getAlbum(album.id);
      expect(updated.photo_count).toBe(1);
    });

    it('should soft delete a photo', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'delete.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data'
      });

      await deletePhoto(photo.id, false);

      const deleted = getPhoto(photo.id);
      expect(deleted).toBeNull();

      const updatedAlbum = getAlbum(album.id);
      expect(updatedAlbum.photo_count).toBe(0);
    });
  });

  describe('Album Cover Thumbnail', () => {
    it('returns the most recently uploaded photo thumbnail as the cover', async () => {
      const album = await createAlbum('2026-09-14');

      await createPhoto(album.id, {
        filename: 'first.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data',
        thumbnail_base64: 'thumb-first'
      });
      await createPhoto(album.id, {
        filename: 'second.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data',
        thumbnail_base64: 'thumb-second'
      });

      const albums = getAlbums();
      const found = albums.find((a) => a.id === album.id);
      expect(found.cover_thumbnail_base64).toBe('thumb-second');
    });

    it('returns null cover for an album with zero photos', async () => {
      const album = await createAlbum('2026-09-16');
      const albums = getAlbums();
      const found = albums.find((a) => a.id === album.id);
      expect(found.cover_thumbnail_base64).toBeNull();
    });
  });

  describe('Favorites', () => {
    it('toggles is_favorite on and off and persists the change', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'fav.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data'
      });

      expect(photo.is_favorite).toBe(0);

      const favorited = await toggleFavorite(photo.id);
      expect(favorited.is_favorite).toBe(1);
      expect(getPhoto(photo.id).is_favorite).toBe(1);

      const unfavorited = await toggleFavorite(photo.id);
      expect(unfavorited.is_favorite).toBe(0);
      expect(getPhoto(photo.id).is_favorite).toBe(0);
    });

    it('throws for a non-existent photo id', async () => {
      await expect(toggleFavorite(999999)).rejects.toThrow('Photo not found');
    });

    it('getAllPhotos with favoritesOnly returns only favorited, non-deleted photos', async () => {
      const album = await createAlbum('2026-09-14');
      const photo1 = await createPhoto(album.id, {
        filename: 'one.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data'
      });
      await createPhoto(album.id, {
        filename: 'two.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: 'data'
      });

      await toggleFavorite(photo1.id);

      const favorites = getAllPhotos({ favoritesOnly: true });
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe(photo1.id);
    });
  });

  describe('Album Ordering', () => {
    it('should update album order', async () => {
      const album1 = await createAlbum('2026-09-10');
      await createAlbum('2026-09-15');
      await createAlbum('2026-09-12');

      // Reorder: move album1 to position 1
      await updateAlbumOrder(album1.id, 1);

      const ordered = getAlbums(true); // custom order
      expect(ordered[1].id).toBe(album1.id);
    });

    it('should reject invalid positions', async () => {
      const album = await createAlbum('2026-09-14');

      expect(async () => {
        await updateAlbumOrder(album.id, 999);
      }).rejects.toThrow();
    });
  });
});
