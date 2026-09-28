import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import {
  initDB,
  createAlbum,
  getAlbum,
  getAlbums,
  deleteAlbum,
  updateAlbum,
  updateAlbumOrder,
  createPhoto,
  getPhoto,
  getPhotos,
  getAllPhotos,
  deletePhoto,
  toggleFavorite,
  getPhotoOriginalUrl,
  getAlbumByDate,
  getAlbumDates,
  countPhotos,
  getTutorialLinks
} from '../../src/modules/db.js';

describe('Database Module (Supabase-backed)', () => {
  let fakeClient;

  beforeEach(async () => {
    fakeClient = getCurrentFakeClient();
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

    it('rejects an album_date that is not ISO 8601 (YYYY-MM-DD)', async () => {
      await expect(createAlbum('09/14/2026')).rejects.toThrow(
        'album_date must be ISO 8601 format (YYYY-MM-DD)'
      );
    });

    it('rejects a title longer than 255 characters', async () => {
      await expect(createAlbum('2026-09-14', 'x'.repeat(256))).rejects.toThrow(
        'title must be max 255 characters'
      );
    });

    it('should retrieve an album by id', async () => {
      const created = await createAlbum('2026-09-15', 'Retrieve Test');
      const retrieved = await getAlbum(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.album_date).toBe('2026-09-15');
    });

    it('returns null for an album that does not exist', async () => {
      const retrieved = await getAlbum('00000000-0000-0000-0000-000000000000');
      expect(retrieved).toBeNull();
    });

    it('should get all albums in correct order', async () => {
      await createAlbum('2026-09-10');
      await createAlbum('2026-09-15');
      await createAlbum('2026-09-12');

      const albums = await getAlbums(false); // chronological
      expect(albums.length).toBe(3);
      // Most recent should be first
      expect(albums[0].album_date).toBe('2026-09-15');
    });
  });

  describe('Album rename', () => {
    it('updates the title and returns the updated album', async () => {
      const album = await createAlbum('2026-09-14', 'Original Name');
      const updated = await updateAlbum(album.id, { title: 'New Name' });
      expect(updated.title).toBe('New Name');
      expect((await getAlbum(album.id)).title).toBe('New Name');
    });

    it('trims the submitted title', async () => {
      const album = await createAlbum('2026-09-14', 'Original Name');
      const updated = await updateAlbum(album.id, { title: '  Trimmed  ' });
      expect(updated.title).toBe('Trimmed');
    });

    it('rejects a blank title and leaves the previous title unchanged', async () => {
      const album = await createAlbum('2026-09-14', 'Keep Me');
      await expect(updateAlbum(album.id, { title: '' })).rejects.toThrow(
        'title is required and must not be blank'
      );
      await expect(updateAlbum(album.id, { title: '   ' })).rejects.toThrow(
        'title is required and must not be blank'
      );
      expect((await getAlbum(album.id)).title).toBe('Keep Me');
    });

    it('rejects a title longer than 255 characters', async () => {
      const album = await createAlbum('2026-09-14', 'Keep Me');
      await expect(updateAlbum(album.id, { title: 'x'.repeat(256) })).rejects.toThrow(
        'title must be max 255 characters'
      );
      expect((await getAlbum(album.id)).title).toBe('Keep Me');
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
        photo_data_base64: btoa('test_base64_data'),
        thumbnail_base64: btoa('thumb_base64_data'),
        exif_json: { DateTime: '2026:09:14 10:30:00' }
      };

      const photo = await createPhoto(album.id, photoData);
      expect(photo).toBeDefined();
      expect(photo.album_id).toBe(album.id);
      expect(photo.filename).toBe('test.jpg');
      // Storage upload must happen before the row exists (FR-008) — the resolved thumbnail
      // URL is only present because the fake Storage bucket actually has the object.
      expect(photo.thumbnail_url).toBe('https://fake.local/storage/photos/owner-1/' + photo.id + '/thumb');
    });

    it('rejects a filename longer than 255 characters', async () => {
      const album = await createAlbum('2026-09-14');
      await expect(
        createPhoto(album.id, {
          filename: 'x'.repeat(256) + '.jpg',
          file_size: 100,
          mime_type: 'image/jpeg',
          photo_data_base64: btoa('data')
        })
      ).rejects.toThrow('filename is required and must be max 255 characters');
    });

    it('rejects a file_size of 0', async () => {
      const album = await createAlbum('2026-09-14');
      await expect(
        createPhoto(album.id, {
          filename: 'test.jpg',
          file_size: 0,
          mime_type: 'image/jpeg',
          photo_data_base64: btoa('data')
        })
      ).rejects.toThrow('file_size must be > 0');
    });

    it('rejects an unsupported mime type', async () => {
      const album = await createAlbum('2026-09-14');
      await expect(
        createPhoto(album.id, {
          filename: 'test.gif',
          file_size: 100,
          mime_type: 'image/gif',
          photo_data_base64: btoa('data')
        })
      ).rejects.toThrow('Unsupported file type: image/gif');
    });

    it('should retrieve a photo by id', async () => {
      const album = await createAlbum('2026-09-14');

      const photoData = {
        filename: 'retrieve.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        photo_date: '2026-09-14',
        photo_data_base64: btoa('data'),
        thumbnail_base64: btoa('thumb')
      };

      const created = await createPhoto(album.id, photoData);
      const retrieved = await getPhoto(created.id);
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
          photo_data_base64: btoa('data'),
          thumbnail_base64: btoa('thumb')
        });
      }

      const photos = await getPhotos(album.id);
      expect(photos.length).toBe(3);
    });

    it('should increment photo count when adding photos', async () => {
      const album = await createAlbum('2026-09-14');
      expect(album.photo_count).toBe(0);

      await createPhoto(album.id, {
        filename: 'test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });

      const updated = await getAlbum(album.id);
      expect(updated.photo_count).toBe(1);
    });

    it('should soft delete a photo', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'delete.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });

      await deletePhoto(photo.id, false);

      const deleted = await getPhoto(photo.id);
      expect(deleted).toBeNull();

      const updatedAlbum = await getAlbum(album.id);
      expect(updatedAlbum.photo_count).toBe(0);
    });

    it('should hard delete a photo and remove its Storage objects', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'hard-delete.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data'),
        thumbnail_base64: btoa('thumb')
      });

      await deletePhoto(photo.id, true);

      expect(fakeClient._storageObjects.has(`photos/owner-1/${photo.id}/original`)).toBe(false);
      expect(fakeClient._storageObjects.has(`photos/owner-1/${photo.id}/thumb`)).toBe(false);
    });
  });

  describe('3D model cleanup on delete (spec 009, FR-014)', () => {
    async function seedPhotoWithModel(albumDate = '2026-09-20') {
      const album = await createAlbum(albumDate);
      const photo = await createPhoto(album.id, {
        filename: 'model.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });
      const folder = `owner-1/${photo.id}`;
      const row = fakeClient._tables.photos.find((p) => p.id === photo.id);
      Object.assign(row, {
        model_storage_path: `${folder}/model-current.glb`,
        model_file_size: 10,
        model_generated_at: new Date().toISOString(),
        model_job_id: 'current'
      });
      // Current model plus an orphan from a conversion that was still in flight.
      fakeClient._storageObjects.add(`photos/${folder}/model-current.glb`);
      fakeClient._storageObjects.add(`photos/${folder}/model-inflight.glb`);
      fakeClient._tables.model_conversions.push({
        id: 'inflight',
        owner_id: 'owner-1',
        photo_id: photo.id,
        status: 'processing',
        requested_at: new Date().toISOString()
      });
      return { album, photo, folder };
    }

    function modelKeys(folder) {
      return [`photos/${folder}/model-current.glb`, `photos/${folder}/model-inflight.glb`];
    }

    it('hard-deleting a photo removes its current and in-flight model files and jobs', async () => {
      const { photo, folder } = await seedPhotoWithModel();
      await deletePhoto(photo.id, true);
      for (const key of [...modelKeys(folder), `photos/${folder}/original`]) {
        expect(fakeClient._storageObjects.has(key)).toBe(false);
      }
      expect(fakeClient._tables.model_conversions).toHaveLength(0);
    });

    it('hard-deleting an album removes model files for every photo in it', async () => {
      const { album, folder } = await seedPhotoWithModel();
      await deleteAlbum(album.id, true);
      for (const key of modelKeys(folder)) {
        expect(fakeClient._storageObjects.has(key)).toBe(false);
      }
    });

    it('soft delete keeps model files (the photo is recoverable)', async () => {
      const { album, photo, folder } = await seedPhotoWithModel();
      await deletePhoto(photo.id, false);
      const second = await seedPhotoWithModel('2026-09-21');
      await deleteAlbum(second.album.id, false);
      for (const key of [...modelKeys(folder), ...modelKeys(second.folder)]) {
        expect(fakeClient._storageObjects.has(key)).toBe(true);
      }
      expect(album).toBeDefined();
    });

    it('leaves files in place when listing the folder fails', async () => {
      const { photo, folder } = await seedPhotoWithModel();
      const realFrom = fakeClient.storage.from;
      fakeClient.storage.from = (bucket) => ({
        ...realFrom(bucket),
        list: async () => ({ data: null, error: new TypeError('Failed to fetch') })
      });
      await expect(deletePhoto(photo.id, true)).rejects.toMatchObject({ code: 'network' });
      fakeClient.storage.from = realFrom;
      for (const key of modelKeys(folder)) {
        expect(fakeClient._storageObjects.has(key)).toBe(true);
      }
    });
  });

  describe('Album deletion', () => {
    it('soft-deletes an album and its photos together', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'one.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });

      await deleteAlbum(album.id, false);

      expect(await getAlbum(album.id)).toBeNull();
      expect(await getPhoto(photo.id)).toBeNull();
    });

    describe('hard delete', () => {
      async function seedAlbumWithPhoto() {
        const album = await createAlbum('2026-09-14');
        const photo = await createPhoto(album.id, {
          filename: 'one.jpg',
          file_size: 100,
          mime_type: 'image/jpeg',
          photo_data_base64: btoa('data'),
          thumbnail_base64: btoa('thumb')
        });
        return { album, photo };
      }

      function storageKeys(photo) {
        return [`photos/owner-1/${photo.id}/original`, `photos/owner-1/${photo.id}/thumb`];
      }

      it('permanently removes the album, its photos, and their Storage objects', async () => {
        const { album, photo } = await seedAlbumWithPhoto();

        await deleteAlbum(album.id, true);

        expect(await getAlbum(album.id)).toBeNull();
        expect(await getPhoto(photo.id)).toBeNull();
        for (const key of storageKeys(photo)) {
          expect(fakeClient._storageObjects.has(key)).toBe(false);
        }
      });

      it('leaves everything intact when Storage removal fails, then succeeds on retry', async () => {
        const { album, photo } = await seedAlbumWithPhoto();
        fakeClient._failNextStorageRemoves(1);

        await expect(deleteAlbum(album.id, true)).rejects.toMatchObject({ code: 'network' });

        // Fully intact — nothing was removed by the failed attempt.
        expect(await getAlbum(album.id)).not.toBeNull();
        expect(await getPhoto(photo.id)).not.toBeNull();
        for (const key of storageKeys(photo)) {
          expect(fakeClient._storageObjects.has(key)).toBe(true);
        }

        await deleteAlbum(album.id, true);

        expect(await getAlbum(album.id)).toBeNull();
        expect(await getPhoto(photo.id)).toBeNull();
        for (const key of storageKeys(photo)) {
          expect(fakeClient._storageObjects.has(key)).toBe(false);
        }
      });

      it('leaves rows intact (Storage already gone) when the photo-row delete fails, then succeeds on retry', async () => {
        const { album, photo } = await seedAlbumWithPhoto();
        fakeClient._failNextTableDeletes('photos', 1);

        await expect(deleteAlbum(album.id, true)).rejects.toMatchObject({ code: 'network' });

        // Disclosed transient window (research.md §2): Storage already removed, rows still present.
        expect(await getAlbum(album.id)).not.toBeNull();
        for (const key of storageKeys(photo)) {
          expect(fakeClient._storageObjects.has(key)).toBe(false);
        }

        // Retry re-removes the (already-gone) Storage objects with no error, then finishes.
        await deleteAlbum(album.id, true);

        expect(await getAlbum(album.id)).toBeNull();
        expect(await getPhoto(photo.id)).toBeNull();
      });

      it('leaves an empty album row when the album-row delete fails, then succeeds on retry', async () => {
        const { album, photo } = await seedAlbumWithPhoto();
        fakeClient._failNextTableDeletes('albums', 1);

        await expect(deleteAlbum(album.id, true)).rejects.toMatchObject({ code: 'network' });

        // Disclosed transient window (research.md §2): photo rows + Storage already gone, album row remains.
        expect(await getAlbum(album.id)).not.toBeNull();
        expect(await getPhoto(photo.id)).toBeNull();

        // Retry deletes zero matching photo rows (safe no-op) and finishes the album row.
        await deleteAlbum(album.id, true);

        expect(await getAlbum(album.id)).toBeNull();
      });
    });
  });

  describe('Album Cover Thumbnail', () => {
    it('returns the most recently uploaded photo thumbnail as the cover', async () => {
      const album = await createAlbum('2026-09-14');

      await createPhoto(album.id, {
        filename: 'first.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data'),
        thumbnail_base64: btoa('thumb-first')
      });
      const second = await createPhoto(album.id, {
        filename: 'second.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data'),
        thumbnail_base64: btoa('thumb-second')
      });

      const albums = await getAlbums();
      const found = albums.find((a) => a.id === album.id);
      expect(found.cover_thumbnail_url).toBe(
        `https://fake.local/storage/photos/owner-1/${second.id}/thumb`
      );
    });

    it('returns null cover for an album with zero photos', async () => {
      const album = await createAlbum('2026-09-16');
      const albums = await getAlbums();
      const found = albums.find((a) => a.id === album.id);
      expect(found.cover_thumbnail_url).toBeNull();
    });
  });

  describe('Favorites', () => {
    it('toggles is_favorite on and off and persists the change', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'fav.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });

      expect(photo.is_favorite).toBe(false);

      const favorited = await toggleFavorite(photo.id);
      expect(favorited.is_favorite).toBe(true);
      expect((await getPhoto(photo.id)).is_favorite).toBe(true);

      const unfavorited = await toggleFavorite(photo.id);
      expect(unfavorited.is_favorite).toBe(false);
      expect((await getPhoto(photo.id)).is_favorite).toBe(false);
    });

    it('throws for a non-existent photo id', async () => {
      await expect(toggleFavorite('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'Photo not found'
      );
    });

    it('getAllPhotos with favoritesOnly returns only favorited, non-deleted photos', async () => {
      const album = await createAlbum('2026-09-14');
      const photo1 = await createPhoto(album.id, {
        filename: 'one.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });
      await createPhoto(album.id, {
        filename: 'two.jpg',
        file_size: 100,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('data')
      });

      await toggleFavorite(photo1.id);

      const favorites = await getAllPhotos({ favoritesOnly: true });
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

      const ordered = await getAlbums(true); // custom order
      expect(ordered[1].id).toBe(album1.id);
    });

    it('should reject invalid positions', async () => {
      const album = await createAlbum('2026-09-14');

      await expect(updateAlbumOrder(album.id, 999)).rejects.toThrow();
    });
  });

  describe('Error classification', () => {
    it('rejects with code "network" when Supabase is unreachable', async () => {
      fakeClient._setNetworkDown(true);

      await expect(createAlbum('2026-09-14')).rejects.toMatchObject({ code: 'network' });
    });
  });

  describe('getPhotoOriginalUrl', () => {
    it('resolves the full-resolution image URL for a photo\'s storage_path', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'full-res.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('original data')
      });

      const url = await getPhotoOriginalUrl(photo.storage_path);
      expect(url).toBe(`https://fake.local/storage/photos/owner-1/${photo.id}/original`);
    });

    it('rejects with code "network" when Supabase Storage is unreachable', async () => {
      const album = await createAlbum('2026-09-14');
      const photo = await createPhoto(album.id, {
        filename: 'full-res.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        photo_data_base64: btoa('original data')
      });

      fakeClient._setNetworkDown(true);

      await expect(getPhotoOriginalUrl(photo.storage_path)).rejects.toMatchObject({ code: 'network' });
    });
  });

  describe('Lean queries', () => {
    const photoData = (filename) => ({
      filename,
      file_size: 1024,
      mime_type: 'image/jpeg',
      photo_data_base64: btoa('data'),
      thumbnail_base64: btoa('thumb')
    });

    it('getAlbumByDate finds only the live album for that date', async () => {
      const album = await createAlbum('2026-09-14');
      await createAlbum('2026-09-15');

      expect((await getAlbumByDate('2026-09-14')).id).toBe(album.id);
      expect(await getAlbumByDate('2026-01-01')).toBeNull();

      await deleteAlbum(album.id);
      expect(await getAlbumByDate('2026-09-14')).toBeNull();
    });

    it('getAlbumDates lists live album dates', async () => {
      await createAlbum('2026-09-14');
      const gone = await createAlbum('2026-09-15');
      await deleteAlbum(gone.id);

      expect(await getAlbumDates()).toEqual(['2026-09-14']);
    });

    it('countPhotos counts non-deleted photos without loading them', async () => {
      const album = await createAlbum('2026-09-14');
      await createPhoto(album.id, photoData('a.jpg'));
      const b = await createPhoto(album.id, photoData('b.jpg'));
      await deletePhoto(b.id);

      expect(await countPhotos()).toBe(1);
    });

    it('getTutorialLinks returns only linked photos', async () => {
      const album = await createAlbum('2026-09-14');
      await createPhoto(album.id, photoData('a.jpg'));
      const linked = await createPhoto(album.id, photoData('b.jpg'));
      fakeClient._tables.photos.find((p) => p.id === linked.id).tutorial_link = { channelId: 'UC1' };

      expect(await getTutorialLinks()).toEqual([{ channelId: 'UC1' }]);
    });

    it('updateAlbumOrder writes only albums whose position changed', async () => {
      const a = await createAlbum('2026-09-10');
      await createAlbum('2026-09-11');
      await createAlbum('2026-09-12');
      await updateAlbumOrder(a.id, 0); // normalizes positions 0..2
      const before = fakeClient._tables.albums.map((row) => row.updated_at);

      await updateAlbumOrder(a.id, 0); // no-op move
      expect(fakeClient._tables.albums.map((row) => row.updated_at)).toEqual(before);
    });
  });
});
