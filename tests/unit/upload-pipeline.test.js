import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prepareOriginal,
  createThumbnailBlob,
  isHeic,
  THUMBNAIL_SIZE,
  MAX_ORIGINAL_DIMENSION
} from '../../src/modules/storage.js';
import { toLocalIsoDate, nextIsoDate } from '../../src/modules/dates.js';
import { initDB, createAlbum, createPhoto, getAlbums, getAlbum } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { resolvePhotoUrl } from '../../src/modules/photo-url.js';
import { enableSignedUrlRefresh } from '../../src/modules/signed-url-refresh.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

vi.mock('../../src/modules/photo-url.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, resolvePhotoUrl: vi.fn(actual.resolvePhotoUrl) };
});

function fakeImage(width, height) {
  return { source: {}, width, height, release: () => {} };
}

function jpeg(name, day = '2026-05-01') {
  return new File(['x'], name, { type: 'image/jpeg', lastModified: new Date(`${day}T12:00:00`).getTime() });
}

describe('dates', () => {
  it('formats the local calendar day, not the UTC one', () => {
    // 23:30 local on Jan 31 — in any negative UTC offset toISOString() would say Feb 1.
    expect(toLocalIsoDate(new Date(2026, 0, 31, 23, 30))).toBe('2026-01-31');
  });

  it('steps to the next day across month and year boundaries', () => {
    expect(nextIsoDate('2026-01-31')).toBe('2026-02-01');
    expect(nextIsoDate('2026-12-31')).toBe('2027-01-01');
  });
});

describe('image preparation', () => {
  it('keeps an original that is already small enough untouched', async () => {
    const file = jpeg('small.jpg');
    const result = await prepareOriginal(file, fakeImage(1200, 900), 'image/jpeg');
    expect(result.blob).toBe(file);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it(`downscales an original larger than ${MAX_ORIGINAL_DIMENSION}px on its longest edge`, async () => {
    const created = [];
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === 'canvas') created.push(el);
      return el;
    });

    const result = await prepareOriginal(jpeg('big.jpg'), fakeImage(4000, 3000), 'image/jpeg');
    spy.mockRestore();

    expect(result.blob).not.toBeInstanceOf(File);
    expect(result.mimeType).toBe('image/jpeg');
    expect(created[0].width).toBe(MAX_ORIGINAL_DIMENSION);
    expect(created[0].height).toBe(1536);
  });

  it('re-encodes a HEIC source as JPEG even when it is small', async () => {
    const heic = new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' });
    const result = await prepareOriginal(heic, fakeImage(800, 600), 'image/jpeg');
    expect(result.blob).not.toBe(heic);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it(`creates square JPEG thumbnails capped at ${THUMBNAIL_SIZE}px`, async () => {
    const blob = await createThumbnailBlob(fakeImage(3000, 2000));
    expect(blob.type).toBe('image/jpeg');
  });

  it('recognizes HEIC by type or by extension', () => {
    expect(isHeic(new File(['x'], 'a.jpg', { type: 'image/heic' }))).toBe(true);
    expect(isHeic(new File(['x'], 'IMG_1.HEIF', { type: '' }))).toBe(true);
    expect(isHeic(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
  });
});

describe('uploadPhotos', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('files concurrently-uploaded photos from the same day into one album with an exact count', async () => {
    const files = Array.from({ length: 7 }, (_, i) => jpeg(`craft-${i}.jpg`, '2026-05-01'));
    const result = await uploadPhotos(files);

    expect(result.errors).toHaveLength(0);
    expect(new Set(result.uploaded.map((p) => p.album_id)).size).toBe(1);
    const albums = await getAlbums();
    expect(albums).toHaveLength(1);
    expect(albums[0].photo_count).toBe(7);
  });

  it('reports progress once per file', async () => {
    const onProgress = vi.fn();
    await uploadPhotos([jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg')], null, { onProgress });
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it('stores an iPhone HEIC photo as a JPEG', async () => {
    const heic = new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' });
    const { uploaded, errors } = await uploadPhotos([heic]);
    expect(errors).toHaveLength(0);
    expect(uploaded[0].mime_type).toBe('image/jpeg');
    expect(uploaded[0].filename).toBe('IMG_0001.jpg');
  });
});

describe('createPhoto failure cleanup', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('removes already-uploaded files when the photo row cannot be saved', async () => {
    const album = await createAlbum('2026-05-01');
    const fake = getCurrentFakeClient();
    const realFrom = fake.from;
    fake.from = (table) => {
      const builder = realFrom(table);
      if (table === 'photos') {
        builder.insert = () => ({
          select: () => ({ single: async () => ({ data: null, error: { message: 'insert failed' } }) })
        });
      }
      return builder;
    };

    await expect(
      createPhoto(album.id, {
        filename: 'a.jpg',
        file_size: 1,
        mime_type: 'image/jpeg',
        photo_blob: new Blob(['x'], { type: 'image/jpeg' }),
        thumbnail_blob: new Blob(['t'], { type: 'image/jpeg' })
      })
    ).rejects.toBeTruthy();
    fake.from = realFrom;

    expect(fake._storageObjects.size).toBe(0);
    expect((await getAlbum(album.id)).photo_count).toBe(0);
  });
});

describe('signed URL refresh', () => {
  it('re-signs an image whose URL fails to load', async () => {
    resolvePhotoUrl.mockClear();
    resolvePhotoUrl.mockResolvedValueOnce('https://fake.local/fresh-url');
    const root = document.createElement('div');
    enableSignedUrlRefresh(root);
    const img = document.createElement('img');
    img.dataset.storagePath = 'owner-1/p1/thumb.jpg';
    root.appendChild(img);

    img.dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(img.src).toBe('https://fake.local/fresh-url'));
    expect(resolvePhotoUrl).toHaveBeenCalledWith('owner-1/p1/thumb.jpg');

    // A second failure right away doesn't loop.
    img.dispatchEvent(new Event('error'));
    expect(resolvePhotoUrl).toHaveBeenCalledTimes(1);
  });
});
