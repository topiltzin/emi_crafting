import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import { initDB, createAlbum, createPhoto, getPhoto } from '../../src/modules/db.js';
import {
  validateTutorialLink,
  saveTutorialLink,
  deleteTutorialLink,
  getTutorialCreators,
  getPhotosByCreator
} from '../../src/modules/tutorial-link.js';

const VALID_LINK = {
  url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Test Video',
  creator: 'Test Creator',
  channelId: 'UCabcdefghijklmnopqrstu',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  duration: 212,
  addedAt: new Date().toISOString()
};

async function seedPhoto(overrides = {}) {
  const album = await createAlbum(`2026-0${(seedPhoto.counter = (seedPhoto.counter || 0) + 1) % 9 || 1}-01`);
  return createPhoto(album.id, {
    filename: 'craft.jpg',
    file_size: 1024,
    mime_type: 'image/jpeg',
    photo_data_base64: btoa('fake-image-bytes'),
    ...overrides
  });
}

describe('validateTutorialLink', () => {
  it('accepts a fully-populated valid link', () => {
    expect(() => validateTutorialLink(VALID_LINK)).not.toThrow();
  });

  it('accepts a fallback link with null channelId/duration/thumbnail', () => {
    expect(() =>
      validateTutorialLink({
        url: VALID_LINK.url,
        videoId: VALID_LINK.videoId,
        title: 'YouTube Video',
        creator: 'Unknown',
        channelId: null,
        thumbnail: null,
        duration: null,
        addedAt: new Date().toISOString()
      })
    ).not.toThrow();
  });

  it('rejects a videoId that is not 11 characters', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, videoId: 'short' })).toThrow(
      /videoId must be exactly 11 characters/
    );
  });

  it('rejects a title over 255 characters', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, title: 'x'.repeat(256) })).toThrow(
      /title is required and must be max 255 characters/
    );
  });

  it('rejects a missing title', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, title: '' })).toThrow(/title/);
  });

  it('rejects a duration of 0', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, duration: 0 })).toThrow(/duration/);
  });

  it('rejects a duration over 12 hours', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, duration: 43201 })).toThrow(/duration/);
  });

  it('rejects a missing addedAt', () => {
    expect(() => validateTutorialLink({ ...VALID_LINK, addedAt: undefined })).toThrow(/addedAt/);
  });
});

describe('saveTutorialLink / deleteTutorialLink', () => {
  let fakeClient;

  beforeEach(async () => {
    fakeClient = getCurrentFakeClient();
    await initDB();
  });

  it('fetches metadata and persists the tutorial link on success', async () => {
    const photo = await seedPhoto();
    fakeClient._setFunctionHandler(() => ({
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Test Video',
        creator: 'Test Creator',
        channelId: 'UCabcdefghijklmnopqrstu',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        duration: 212
      }
    }));

    const { photo: updated, metadataReady } = await saveTutorialLink(
      photo.id,
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    );

    expect(metadataReady).toBe(true);
    expect(updated.tutorial_link.title).toBe('Test Video');

    const reloaded = await getPhoto(photo.id);
    expect(reloaded.tutorial_link.videoId).toBe('dQw4w9WgXcQ');
  });

  it('saves a fallback placeholder when the API is unavailable after retries', async () => {
    const photo = await seedPhoto();
    fakeClient._setFunctionHandler(() => ({
      errorBody: { error: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded.' }
    }));

    const { photo: updated, metadataReady } = await saveTutorialLink(
      photo.id,
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    );

    expect(metadataReady).toBe(false);
    expect(updated.tutorial_link.title).toBe('YouTube Video');
    expect(updated.tutorial_link.metadataReady).toBe(false);
  });

  it('propagates a non-retryable error (e.g. video not found) without saving anything', async () => {
    const photo = await seedPhoto();
    fakeClient._setFunctionHandler(() => ({
      errorBody: { error: 'VIDEO_NOT_FOUND', message: 'Video not found on YouTube.' }
    }));

    await expect(
      saveTutorialLink(photo.id, 'https://youtube.com/watch?v=dQw4w9WgXcQ')
    ).rejects.toMatchObject({ code: 'VIDEO_NOT_FOUND' });

    const reloaded = await getPhoto(photo.id);
    expect(reloaded.tutorial_link).toBeNull();
  });

  it('removes the tutorial link on delete', async () => {
    const photo = await seedPhoto();
    fakeClient._setFunctionHandler(() => ({ data: VALID_LINK }));
    await saveTutorialLink(photo.id, VALID_LINK.url);

    const deleted = await deleteTutorialLink(photo.id);
    expect(deleted.tutorial_link).toBeNull();

    const reloaded = await getPhoto(photo.id);
    expect(reloaded.tutorial_link).toBeNull();
  });
});

describe('getTutorialCreators / getPhotosByCreator', () => {
  let fakeClient;

  beforeEach(async () => {
    fakeClient = getCurrentFakeClient();
    await initDB();
  });

  it('returns an empty list when no photos have tutorials', async () => {
    await seedPhoto();
    expect(await getTutorialCreators()).toEqual([]);
  });

  it('aggregates photos by channelId with counts', async () => {
    const photoA = await seedPhoto();
    const photoB = await seedPhoto();
    const photoC = await seedPhoto();

    fakeClient._setFunctionHandler(() => ({
      data: { ...VALID_LINK, channelId: 'UCcreatorA00000000000000' }
    }));
    await saveTutorialLink(photoA.id, VALID_LINK.url);
    await saveTutorialLink(photoB.id, VALID_LINK.url);

    fakeClient._setFunctionHandler(() => ({
      data: { ...VALID_LINK, channelId: 'UCcreatorB00000000000000', creator: 'Creator B' }
    }));
    await saveTutorialLink(photoC.id, VALID_LINK.url);

    const creators = await getTutorialCreators();
    expect(creators).toHaveLength(2);
    const creatorA = creators.find((c) => c.channelId === 'UCcreatorA00000000000000');
    expect(creatorA.photoCount).toBe(2);
  });

  it('filters photos to only those linked to the given creator', async () => {
    const photoA = await seedPhoto();
    const photoB = await seedPhoto();

    fakeClient._setFunctionHandler(() => ({
      data: { ...VALID_LINK, channelId: 'UCcreatorA00000000000000' }
    }));
    await saveTutorialLink(photoA.id, VALID_LINK.url);

    const filtered = await getPhotosByCreator('UCcreatorA00000000000000');
    expect(filtered.map((p) => p.id)).toEqual([photoA.id]);
    expect(filtered.map((p) => p.id)).not.toContain(photoB.id);
  });
});
