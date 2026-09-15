import { describe, it, expect } from 'vitest';
import { Album } from '../../src/models/Album.js';
import { Photo } from '../../src/models/Photo.js';

describe('Album model', () => {
  it('accepts a valid ISO date and short title', () => {
    const album = new Album({ album_date: '2026-09-14', title: 'Paper Crafts', photo_count: 2 });
    expect(() => album.validate()).not.toThrow();
    expect(album.photo_count).toBe(2);
  });

  it('rejects a non-ISO album_date', () => {
    const album = new Album({ album_date: '09/14/2026' });
    expect(() => album.validate()).toThrow('album_date must be ISO 8601 format (YYYY-MM-DD)');
  });

  it('rejects a title longer than 255 characters', () => {
    const album = new Album({ album_date: '2026-09-14', title: 'x'.repeat(256) });
    expect(() => album.validate()).toThrow('title must be max 255 characters');
  });

  it('falls back to a formatted date when there is no title', () => {
    const album = new Album({ album_date: '2026-09-14' });
    expect(album.getDisplayTitle()).toBe('September 14, 2026');
  });

  it('uses the title when present', () => {
    const album = new Album({ album_date: '2026-09-14', title: 'Paper Crafts' });
    expect(album.getDisplayTitle()).toBe('Paper Crafts');
  });

  it('serializes to JSON without internal-only fields', () => {
    const album = new Album({ id: 1, album_date: '2026-09-14', title: 'Paper Crafts', photo_count: 3 });
    const json = album.toJSON();
    expect(json).toMatchObject({ id: 1, album_date: '2026-09-14', title: 'Paper Crafts', photo_count: 3 });
  });

  it('fromRow constructs an Album from a plain row object', () => {
    const album = Album.fromRow({ id: 5, album_date: '2026-09-14' });
    expect(album).toBeInstanceOf(Album);
    expect(album.id).toBe(5);
  });
});

describe('Photo model', () => {
  it('validates a complete photo record', () => {
    const photo = new Photo({
      album_id: 1,
      filename: 'craft.jpg',
      file_size: 100,
      mime_type: 'image/jpeg',
      photo_data_base64: 'data'
    });
    expect(() => photo.validate()).not.toThrow();
  });

  it('requires an album_id', () => {
    const photo = new Photo({ filename: 'craft.jpg', file_size: 100, mime_type: 'image/jpeg', photo_data_base64: 'd' });
    expect(() => photo.validate()).toThrow('album_id is required');
  });

  it('requires a filename under 255 characters', () => {
    const photo = new Photo({ album_id: 1, filename: '', file_size: 100, mime_type: 'image/jpeg', photo_data_base64: 'd' });
    expect(() => photo.validate()).toThrow('filename is required');
  });

  it('requires a positive file_size', () => {
    const photo = new Photo({ album_id: 1, filename: 'a.jpg', file_size: 0, mime_type: 'image/jpeg', photo_data_base64: 'd' });
    expect(() => photo.validate()).toThrow('file_size must be > 0');
  });

  it('requires a mime_type', () => {
    const photo = new Photo({ album_id: 1, filename: 'a.jpg', file_size: 100, photo_data_base64: 'd' });
    expect(() => photo.validate()).toThrow('mime_type is required');
  });

  it('requires photo_data_base64', () => {
    const photo = new Photo({ album_id: 1, filename: 'a.jpg', file_size: 100, mime_type: 'image/jpeg' });
    expect(() => photo.validate()).toThrow('photo_data_base64 is required');
  });

  it('defaults is_favorite to 0 when absent', () => {
    const photo = new Photo({ album_id: 1 });
    expect(photo.is_favorite).toBe(0);
  });

  it('preserves an explicit is_favorite value', () => {
    const photo = new Photo({ album_id: 1, is_favorite: 1 });
    expect(photo.is_favorite).toBe(1);
  });

  it('builds data URLs for thumbnail and full photo when given raw base64', () => {
    const photo = new Photo({ album_id: 1, thumbnail_base64: 'thumb', photo_data_base64: 'full' });
    expect(photo.getThumbnailUrl()).toBe('data:image/jpeg;base64,thumb');
    expect(photo.getPhotoUrl()).toBe('data:image/jpeg;base64,full');
  });

  it('passes through values that are already data URLs', () => {
    const photo = new Photo({
      album_id: 1,
      thumbnail_base64: 'data:image/png;base64,abc',
      photo_data_base64: 'data:image/png;base64,xyz'
    });
    expect(photo.getThumbnailUrl()).toBe('data:image/png;base64,abc');
    expect(photo.getPhotoUrl()).toBe('data:image/png;base64,xyz');
  });

  it('returns null URLs when there is no image data', () => {
    const photo = new Photo({ album_id: 1 });
    expect(photo.getThumbnailUrl()).toBeNull();
    expect(photo.getPhotoUrl()).toBeNull();
  });

  it('serializes to JSON including is_favorite', () => {
    const photo = new Photo({ id: 1, album_id: 1, filename: 'a.jpg', is_favorite: 1 });
    expect(photo.toJSON()).toMatchObject({ id: 1, album_id: 1, filename: 'a.jpg', is_favorite: 1 });
  });

  it('fromRow constructs a Photo from a plain row object', () => {
    const photo = Photo.fromRow({ id: 9, album_id: 1 });
    expect(photo).toBeInstanceOf(Photo);
    expect(photo.id).toBe(9);
  });
});
