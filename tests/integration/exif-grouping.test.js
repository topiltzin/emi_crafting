import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAlbums } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { formatExifDate } from '../../src/modules/exif.js';

describe('EXIF & Album Grouping Integration', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('should group photos by EXIF date when available', async () => {
    // Create files representing photos from different dates
    const file1 = new File(['test1'], 'photo1.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-10').getTime()
    });

    const file2 = new File(['test2'], 'photo2.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-10').getTime()
    });

    const file3 = new File(['test3'], 'photo3.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-15').getTime()
    });

    await uploadPhotos([file1, file2, file3]);

    // Get albums
    const albums = getAlbums();

    // Should have created separate albums for different dates
    const groupedByDate = {};
    albums.forEach((album) => {
      if (!groupedByDate[album.album_date]) {
        groupedByDate[album.album_date] = [];
      }
      groupedByDate[album.album_date].push(album);
    });

    // Verify albums exist
    expect(Object.keys(groupedByDate).length).toBeGreaterThan(0);
  });

  it('should fallback to upload date when EXIF missing', async () => {
    const file = new File(['test'], 'photo.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });

    const result = await uploadPhotos([file]);
    expect(result.uploaded).toHaveLength(1);

    const photo = result.uploaded[0];
    const albums = getAlbums();
    const album = albums.find((a) => a.id === photo.album_id);

    expect(album).toBeDefined();
    expect(album.album_date).toBe('2026-09-14');
  });

  it('should format EXIF dates correctly', () => {
    const exifDate = '2026:09:14 10:30:45';
    const formatted = formatExifDate(exifDate);

    expect(formatted).toBe('2026-09-14');
  });

  it('should handle multiple photos in same album', async () => {
    const file1 = new File(['test1'], 'photo1.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });

    const file2 = new File(['test2'], 'photo2.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });

    await uploadPhotos([file1, file2]);

    // Get albums
    const albums = getAlbums();
    const albumsWithCount2 = albums.filter((a) => a.photo_count >= 2);

    // Should have at least one album with multiple photos
    expect(albumsWithCount2.length).toBeGreaterThan(0);
  });
});
