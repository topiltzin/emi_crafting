import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAlbums, getPhotos } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';

describe('Album Upload & View Integration', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('should upload multiple photos and create albums by date', async () => {
    // Create mock files with different dates
    const file1 = new File(['test1'], 'photo1.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-10').getTime()
    });

    const file2 = new File(['test2'], 'photo2.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-15').getTime()
    });

    const file3 = new File(['test3'], 'photo3.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-10').getTime()
    });

    // Upload photos
    const result = await uploadPhotos([file1, file2, file3]);

    expect(result.uploaded).toHaveLength(3);
    expect(result.errors).toHaveLength(0);

    // Check albums were created
    const albums = getAlbums();
    expect(albums.length).toBeGreaterThanOrEqual(2);

    // Check photos are in albums
    const albumsWithPhotos = albums.filter((a) => a.photo_count > 0);
    expect(albumsWithPhotos.length).toBeGreaterThanOrEqual(2);
  });

  it('should retrieve photos from an album', async () => {
    // Upload a photo first
    const file = new File(['test'], 'photo.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });

    const result = await uploadPhotos([file]);
    expect(result.uploaded).toHaveLength(1);

    const photo = result.uploaded[0];
    const photos = getPhotos(photo.album_id);

    expect(photos.length).toBeGreaterThan(0);
    expect(photos[0].filename).toBe('photo.jpg');
  });

  it('should display album date prominently', async () => {
    // Upload photo
    const file = new File(['test'], 'photo.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });

    const result = await uploadPhotos([file]);
    const photo = result.uploaded[0];

    // Get album
    const albums = getAlbums();
    const album = albums.find((a) => a.id === photo.album_id);

    expect(album).toBeDefined();
    expect(album.album_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle upload errors gracefully', async () => {
    // Create invalid file (wrong type)
    const invalidFile = new File(['test'], 'invalid.txt', {
      type: 'text/plain'
    });

    const result = await uploadPhotos([invalidFile]);

    expect(result.uploaded).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filename).toBe('invalid.txt');
  });
});
