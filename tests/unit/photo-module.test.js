import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getPhoto, createAlbum, getPhotos } from '../../src/modules/db.js';
import { uploadPhotos, removePhoto, getPhotoUrl } from '../../src/modules/photo.js';

describe('photo module helpers', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('getPhotoUrl wraps raw base64 as a data URL', () => {
    expect(getPhotoUrl('abc123')).toBe('data:image/jpeg;base64,abc123');
  });

  it('getPhotoUrl passes through an already-formed data URL', () => {
    expect(getPhotoUrl('data:image/png;base64,abc123')).toBe('data:image/png;base64,abc123');
  });

  it('uploadPhotos with no albumId auto-groups by the photo\'s own date (default behavior)', async () => {
    const result = await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-05-01').getTime() })
    ]);
    expect(result.uploaded[0].album_id).not.toBeUndefined();
  });

  it('uploadPhotos with an explicit albumId files every photo into that album, regardless of the photo\'s own date', async () => {
    // Regression: uploadPhotos() used to hardcode addPhoto(null, file), so "Add Photos" from
    // inside an already-open album silently ignored the open album and re-grouped by date.
    const targetAlbum = await createAlbum('2026-01-01', 'Target Album');

    const result = await uploadPhotos(
      [new File(['a'], 'different-date.jpg', { type: 'image/jpeg', lastModified: new Date('2026-06-15').getTime() })],
      targetAlbum.id
    );

    expect(result.errors).toHaveLength(0);
    expect(result.uploaded[0].album_id).toBe(targetAlbum.id);
    expect(await getPhotos(targetAlbum.id)).toHaveLength(1);
  });

  it('removePhoto soft-deletes the photo via the database module', async () => {
    const result = await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const photoId = result.uploaded[0].id;

    await removePhoto(photoId);

    expect(await getPhoto(photoId)).toBeNull();
  });
});
