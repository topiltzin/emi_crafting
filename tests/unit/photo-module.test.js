import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getPhoto } from '../../src/modules/db.js';
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

  it('removePhoto soft-deletes the photo via the database module', async () => {
    const result = await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-14').getTime() })
    ]);
    const photoId = result.uploaded[0].id;

    await removePhoto(photoId);

    expect(getPhoto(photoId)).toBeNull();
  });
});
