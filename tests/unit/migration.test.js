import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { runMigration, getMigrationStatus } from '../../src/modules/migration.js';
import { resetMigrationLedgerForTests } from '../../src/modules/migration-ledger.js';
import { getAlbums, getPhotos, getAllPhotos } from '../../src/modules/db.js';

const DB_NAME = 'PhotoOrganizerDB';

// Seeds the legacy (pre-Supabase) local database that migration.js reads from, bypassing the
// real sql.js dependency — migration.js only cares about the shape of rows it gets back from
// src/modules/legacy-local-db.js, so we mock that module directly instead of building a real
// sql.js-backed IndexedDB blob in every test.
let legacyAlbums = [];
let legacyPhotos = [];
let legacyDataPresent = true;

vi.mock('../../src/modules/legacy-local-db.js', () => ({
  hasLegacyLocalData: vi.fn(async () => legacyDataPresent),
  readLegacyAlbumsAndPhotos: vi.fn(async () => ({ albums: legacyAlbums, photos: legacyPhotos }))
}));

function seedLegacyAlbum(id, albumDate, title = null) {
  return { id, album_date: albumDate, title, deleted_at: null };
}

function seedLegacyPhoto(id, albumId, overrides = {}) {
  return {
    id,
    album_id: albumId,
    filename: `photo-${id}.jpg`,
    file_size: 100 + id,
    mime_type: 'image/jpeg',
    photo_date: '2026-09-14',
    upload_date: `2026-09-14T00:00:0${id}.000Z`,
    photo_data_base64: btoa(`data-${id}`),
    thumbnail_base64: btoa(`thumb-${id}`),
    exif_json: null,
    deleted_at: null,
    ...overrides
  };
}

describe('migration', () => {
  beforeEach(() => {
    resetMigrationLedgerForTests();
    legacyAlbums = [];
    legacyPhotos = [];
    legacyDataPresent = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports completed with nothing to do when no legacy local data exists', async () => {
    legacyDataPresent = false;

    const result = await runMigration();

    expect(result).toEqual({ migrated: 0, alreadyDone: 0, failed: 0 });
    expect(getMigrationStatus()).toBe('completed');
    expect(await getAlbums()).toHaveLength(0);
  });

  it('migrates every legacy album and photo into Supabase', async () => {
    legacyAlbums = [seedLegacyAlbum('local-album-1', '2026-09-14', 'Paper Crafts')];
    legacyPhotos = [
      seedLegacyPhoto(1, 'local-album-1'),
      seedLegacyPhoto(2, 'local-album-1')
    ];

    const result = await runMigration();

    expect(result).toEqual({ migrated: 2, alreadyDone: 0, failed: 0 });
    expect(getMigrationStatus()).toBe('completed');

    const albums = await getAlbums();
    expect(albums).toHaveLength(1);
    expect(albums[0].album_date).toBe('2026-09-14');
    expect(albums[0].title).toBe('Paper Crafts');
    expect(albums[0].photo_count).toBe(2);

    const photos = await getPhotos(albums[0].id);
    expect(photos.map((p) => p.filename).sort()).toEqual(['photo-1.jpg', 'photo-2.jpg']);
  });

  it('re-running after a full success does nothing (idempotent, no duplicates)', async () => {
    legacyAlbums = [seedLegacyAlbum('local-album-1', '2026-09-14')];
    legacyPhotos = [seedLegacyPhoto(1, 'local-album-1')];

    await runMigration();
    const secondRun = await runMigration();

    expect(secondRun).toEqual({ migrated: 0, alreadyDone: 0, failed: 0 });
    expect(await getAllPhotos()).toHaveLength(1);
  });

  it('resuming after a partial run skips already-migrated photos and does not duplicate them', async () => {
    legacyAlbums = [seedLegacyAlbum('local-album-1', '2026-09-14')];
    legacyPhotos = [
      seedLegacyPhoto(1, 'local-album-1'),
      seedLegacyPhoto(2, 'local-album-1'),
      seedLegacyPhoto(3, 'local-album-1')
    ];

    // First pass only "sees" the first photo (simulating an interruption after one photo).
    const firstBatch = legacyPhotos.slice(0, 1);
    const originalPhotos = legacyPhotos;
    legacyPhotos = firstBatch;
    const firstResult = await runMigration();
    expect(firstResult).toEqual({ migrated: 1, alreadyDone: 0, failed: 0 });
    expect(getMigrationStatus()).toBe('completed');

    // Resume with the full set — status was marked 'completed' after the (successful, if
    // partial) first pass in this test's simplified setup, so force it back to retry.
    const { setMigrationStatus } = await import('../../src/modules/migration-ledger.js');
    setMigrationStatus('in_progress');
    legacyPhotos = originalPhotos;

    const secondResult = await runMigration();

    expect(secondResult.migrated).toBe(2);
    expect(secondResult.alreadyDone).toBe(1);
    expect(secondResult.failed).toBe(0);

    const allPhotos = await getAllPhotos();
    expect(allPhotos).toHaveLength(3);
    expect(new Set(allPhotos.map((p) => p.filename)).size).toBe(3);
  });

  it('does not stop or lose progress when one photo fails, and leaves status resumable', async () => {
    legacyAlbums = [seedLegacyAlbum('local-album-1', '2026-09-14')];
    legacyPhotos = [
      seedLegacyPhoto(1, 'local-album-1'),
      // An invalid mime type makes createPhoto's validation reject this one.
      seedLegacyPhoto(2, 'local-album-1', { mime_type: 'image/gif' }),
      seedLegacyPhoto(3, 'local-album-1')
    ];

    const result = await runMigration();

    expect(result).toEqual({ migrated: 2, alreadyDone: 0, failed: 1 });
    expect(getMigrationStatus()).toBe('in_progress');
    expect(await getAllPhotos()).toHaveLength(2);
  });
});
