import { describe, it, expect } from 'vitest';
import { groupPhotosByMonth, renderPhotoGallery } from '../../src/ui/photo-gallery.js';

describe('groupPhotosByMonth', () => {
  it('groups photos into correctly labeled month/year buckets', () => {
    const photos = [
      { id: 1, photo_date: '2026-09-05', thumbnail_base64: 'a' },
      { id: 2, photo_date: '2026-09-20', thumbnail_base64: 'a' },
      { id: 3, photo_date: '2026-08-01', thumbnail_base64: 'a' }
    ];

    const groups = groupPhotosByMonth(photos);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('September 2026');
    expect(groups[0].photos.map((p) => p.id)).toEqual([1, 2]);
    expect(groups[1].label).toBe('August 2026');
  });

  it('orders buckets most-recent month first', () => {
    const photos = [
      { id: 1, photo_date: '2026-01-15', thumbnail_base64: 'a' },
      { id: 2, photo_date: '2026-09-15', thumbnail_base64: 'a' },
      { id: 3, photo_date: '2026-05-15', thumbnail_base64: 'a' }
    ];

    const groups = groupPhotosByMonth(photos);

    expect(groups.map((g) => g.label)).toEqual(['September 2026', 'May 2026', 'January 2026']);
  });

  it('falls back to upload_date when photo_date is missing', () => {
    const photos = [{ id: 1, photo_date: null, upload_date: '2026-03-10 10:00:00', thumbnail_base64: 'a' }];

    const groups = groupPhotosByMonth(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('March 2026');
  });
});

describe('renderPhotoGallery', () => {
  it('renders an empty state when there are no photos', () => {
    const gallery = renderPhotoGallery([], { emptyStateVariant: 'photos' });
    expect(gallery.querySelector('.empty-state')).not.toBeNull();
    expect(gallery.querySelector('.date-section')).toBeNull();
  });

  it('renders one date-section per month with all its photos', () => {
    const photos = [
      { id: 1, photo_date: '2026-09-05', thumbnail_base64: 'a', filename: 'a.jpg' },
      { id: 2, photo_date: '2026-08-01', thumbnail_base64: 'a', filename: 'b.jpg' }
    ];

    const gallery = renderPhotoGallery(photos);
    const sections = gallery.querySelectorAll('.date-section');
    expect(sections).toHaveLength(2);
    expect(gallery.querySelectorAll('.photo-card')).toHaveLength(2);
  });
});
