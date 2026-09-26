import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, createAlbum, getPhotos } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';

describe('photo module helpers', () => {
  beforeEach(async () => {
    await initDB();
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

});
