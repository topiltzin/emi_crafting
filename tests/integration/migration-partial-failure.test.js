import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

// See tests/unit/migration.test.js for why legacy-local-db.js (the pre-Supabase sql.js/
// IndexedDB reader) is mocked directly rather than seeding a real sql.js blob.
let legacyAlbums = [];
let legacyPhotos = [];

vi.mock('../../src/modules/legacy-local-db.js', () => ({
  hasLegacyLocalData: vi.fn(async () => legacyAlbums.length > 0),
  readLegacyAlbumsAndPhotos: vi.fn(async () => ({ albums: legacyAlbums, photos: legacyPhotos }))
}));

const { getMigrationStatus, runMigration } = await import('../../src/modules/migration.js');
const { getAllPhotos } = await import('../../src/modules/db.js');
const { initApp } = await import('../../src/app.js');

function seedLegacyPhoto(id) {
  return {
    id,
    album_id: 'local-album-1',
    filename: `photo-${id}.jpg`,
    file_size: 100 + id,
    mime_type: 'image/jpeg',
    photo_date: '2026-09-14',
    upload_date: `2026-09-14T00:00:0${id}.000Z`,
    photo_data_base64: btoa(`data-${id}`),
    thumbnail_base64: btoa(`thumb-${id}`),
    exif_json: null,
    deleted_at: null
  };
}

describe('Migration: partial failure and resume', () => {
  beforeEach(() => {
    legacyAlbums = [{ id: 'local-album-1', album_date: '2026-09-14', title: null, deleted_at: null }];
    legacyPhotos = [seedLegacyPhoto(1), seedLegacyPhoto(2), seedLegacyPhoto(3)];
  });

  it('leaves migration resumable and reports exactly what failed when a Storage upload fails partway through', async () => {
    const client = getCurrentFakeClient();
    client._failNextUploads(1); // the 2nd photo's upload fails; 1st and 3rd succeed

    const result = await runMigration();

    expect(result.migrated).toBe(2);
    expect(result.failed).toBe(1);
    expect(getMigrationStatus()).toBe('in_progress'); // not "completed" — safe to retry

    // The legacy source data itself is read-only from migration's perspective (FR-005) — there
    // is no delete/write path into it at all, so nothing to assert beyond: it's still readable.
    expect(legacyPhotos).toHaveLength(3);

    // Retrying picks up exactly the one that failed, without duplicating the two that succeeded.
    const retryResult = await runMigration();
    expect(retryResult).toEqual({ migrated: 1, alreadyDone: 2, failed: 0 });
    expect(getMigrationStatus()).toBe('completed');
    expect(await getAllPhotos()).toHaveLength(3);
  });

  it('tells the user some photos are still local when the app starts up with an incomplete migration', async () => {
    const client = getCurrentFakeClient();
    client._failNextUploads(1);

    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
    // Let the post-render migration-result banner (appended after navigateTo('home')) settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const banner = document.querySelector('.alert-error');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('2 of 3 existing photos were transferred');
    expect(banner.textContent).toContain('still safe on this device');
  });
});
