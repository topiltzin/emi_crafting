import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAlbums, createAlbum, updateAlbumOrder } from '../../src/modules/db.js';

describe('Album Reorder Integration', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('should reorder albums by position', async () => {
    // Create albums
    const album1 = await createAlbum('2026-09-10');
    await createAlbum('2026-09-15');
    await createAlbum('2026-09-12');

    // Get initial order
    const initialOrder = getAlbums(true);
    expect(initialOrder.length).toBeGreaterThanOrEqual(3);

    // Reorder: move album1 to position 1
    await updateAlbumOrder(album1.id, 1);

    // Get new order
    const newOrder = getAlbums(true);

    // Album1 should be at position 1
    expect(newOrder[1].id).toBe(album1.id);
  });

  it('should persist order after reload', async () => {
    // Create albums
    const album1 = await createAlbum('2026-09-10');
    const album2 = await createAlbum('2026-09-15');

    // Set custom order
    await updateAlbumOrder(album1.id, 1);
    await updateAlbumOrder(album2.id, 0);

    // Get order (simulates reload)
    const order = getAlbums(true);

    // Verify custom order is maintained
    expect(order[0].id).toBe(album2.id);
    expect(order[1].id).toBe(album1.id);
  });

  it('should handle reordering with many albums', async () => {
    // Create 5 albums
    const albums = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(2026, 8, 10 + i);
      const dateStr = date.toISOString().split('T')[0];
      albums.push(await createAlbum(dateStr));
    }

    // Reverse the order
    for (let i = 0; i < albums.length; i++) {
      await updateAlbumOrder(albums[i].id, albums.length - 1 - i);
    }

    // Verify reverse order
    const ordered = getAlbums(true);
    for (let i = 0; i < albums.length; i++) {
      expect(ordered[i].id).toBe(albums[albums.length - 1 - i].id);
    }
  });

  it('should reject invalid positions', async () => {
    const album = await createAlbum('2026-09-14');

    expect(async () => {
      await updateAlbumOrder(album.id, 999);
    }).rejects.toThrow();
  });

  it('should default to chronological order if no custom order set', async () => {
    // Create albums
    await createAlbum('2026-09-10');
    await createAlbum('2026-09-15');
    await createAlbum('2026-09-12');

    // Get default order (no custom ordering)
    const order = getAlbums(false); // false = chronological

    // Verify chronological order (newest first)
    expect(order[0].album_date).toBe('2026-09-15');
    expect(order[1].album_date).toBe('2026-09-12');
    expect(order[2].album_date).toBe('2026-09-10');
  });
});
