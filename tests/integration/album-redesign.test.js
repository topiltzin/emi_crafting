import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAlbums, updateAlbumOrder } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { renderAlbumGrid } from '../../src/ui/album-grid.js';

describe('Album grid redesign', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('renders cover thumbnail, title, count, and date for each album card', async () => {
    await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-05').getTime() }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: new Date('2026-08-01').getTime() })
    ]);

    const albums = await getAlbums();
    const grid = renderAlbumGrid(albums);

    const cards = grid.querySelectorAll('.album-card');
    expect(cards).toHaveLength(2);

    cards.forEach((card) => {
      expect(card.querySelector('.album-thumbnail-img')).not.toBeNull();
      expect(card.querySelector('.album-title')).not.toBeNull();
      expect(card.querySelector('.album-count').textContent).toMatch(/\d+ photos?/);
      expect(card.querySelector('.album-date')).not.toBeNull();
      expect(card.className).toMatch(/album-card--accent-\d/);
    });
  });

  it('shows the shared albums empty state when there are no albums', () => {
    const grid = renderAlbumGrid([]);
    expect(grid.querySelector('.empty-state-heading').textContent).toBe('No albums yet!');
  });

  it('still persists drag-and-drop reordering via updateAlbumOrder', async () => {
    await uploadPhotos([new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-01').getTime() })]);
    await uploadPhotos([new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-05').getTime() })]);
    await uploadPhotos([new File(['c'], 'c.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-10').getTime() })]);

    const albums = await getAlbums(false);
    const [first] = albums;

    await updateAlbumOrder(first.id, 2);

    const reordered = await getAlbums(true);
    expect(reordered[2].id).toBe(first.id);
  });
});
