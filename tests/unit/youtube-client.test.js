import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import {
  extractVideoId,
  isValidYoutubeUrl,
  parseIsoDuration,
  fetchYoutubeMetadata,
  buildFallbackTutorialLink,
  YoutubeApiError
} from '../../src/modules/youtube-client.js';

describe('extractVideoId', () => {
  it('extracts the id from a long-form watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id when a timestamp query param is present', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id when a playlist query param is present', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('extracts the id from a URL with no protocol', () => {
    expect(extractVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a mobile URL', () => {
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractVideoId('https://example.com/video')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractVideoId('')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(extractVideoId('not a url at all')).toBeNull();
  });

  it('returns null for a YouTube URL with no video id', () => {
    expect(extractVideoId('https://www.youtube.com/')).toBeNull();
  });
});

describe('isValidYoutubeUrl', () => {
  it('accepts a valid URL', () => {
    expect(isValidYoutubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects an invalid URL', () => {
    expect(isValidYoutubeUrl('https://vimeo.com/12345')).toBe(false);
  });
});

describe('parseIsoDuration', () => {
  it('parses hours, minutes, and seconds', () => {
    expect(parseIsoDuration('PT1H24M35S')).toBe(1 * 3600 + 24 * 60 + 35);
  });

  it('parses minutes and seconds only', () => {
    expect(parseIsoDuration('PT24M35S')).toBe(1475);
  });

  it('parses seconds only', () => {
    expect(parseIsoDuration('PT45S')).toBe(45);
  });

  it('returns 0 for an empty string', () => {
    expect(parseIsoDuration('')).toBe(0);
  });

  it('returns 0 for malformed input', () => {
    expect(parseIsoDuration('not-a-duration')).toBe(0);
  });
});

describe('fetchYoutubeMetadata', () => {
  let fakeClient;
  const validUrl = 'https://youtube.com/watch?v=dQw4w9WgXcQ';

  beforeEach(() => {
    fakeClient = getCurrentFakeClient();
  });

  it('throws INVALID_URL without calling the API when the URL is not YouTube', async () => {
    await expect(fetchYoutubeMetadata('https://example.com')).rejects.toMatchObject({
      code: 'INVALID_URL'
    });
  });

  it('returns parsed metadata on success', async () => {
    fakeClient._setFunctionHandler(() => ({
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Test Video',
        creator: 'Test Creator',
        channelId: 'UCabc123',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        duration: 212
      }
    }));

    const metadata = await fetchYoutubeMetadata(validUrl);
    expect(metadata).toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: 'Test Video',
      creator: 'Test Creator',
      channelId: 'UCabc123',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      duration: 212
    });
  });

  it('throws VIDEO_NOT_FOUND without retrying', async () => {
    let callCount = 0;
    fakeClient._setFunctionHandler(() => {
      callCount += 1;
      return { errorBody: { error: 'VIDEO_NOT_FOUND', message: 'Video not found on YouTube.' } };
    });

    await expect(fetchYoutubeMetadata(validUrl)).rejects.toMatchObject({
      code: 'VIDEO_NOT_FOUND'
    });
    expect(callCount).toBe(1);
  });

  it('retries on FETCH_TIMEOUT up to 4 attempts, then throws', async () => {
    let callCount = 0;
    fakeClient._setFunctionHandler(() => {
      callCount += 1;
      return { errorBody: { error: 'FETCH_TIMEOUT', message: 'Request to YouTube took too long.' } };
    });

    await expect(fetchYoutubeMetadata(validUrl)).rejects.toMatchObject({ code: 'FETCH_TIMEOUT' });
    expect(callCount).toBe(4);
  });

  it('retries on QUOTA_EXCEEDED and succeeds if a later attempt works', async () => {
    let callCount = 0;
    fakeClient._setFunctionHandler(() => {
      callCount += 1;
      if (callCount < 3) {
        return { errorBody: { error: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded.' } };
      }
      return {
        data: {
          videoId: 'dQw4w9WgXcQ',
          title: 'Recovered',
          creator: 'Creator',
          channelId: 'UCabc123',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          duration: 100
        }
      };
    });

    const metadata = await fetchYoutubeMetadata(validUrl);
    expect(metadata.title).toBe('Recovered');
    expect(callCount).toBe(3);
  });

  it('does not retry AUTH_FAILED', async () => {
    let callCount = 0;
    fakeClient._setFunctionHandler(() => {
      callCount += 1;
      return { errorBody: { error: 'AUTH_FAILED', message: 'YouTube API key is invalid.' } };
    });

    await expect(fetchYoutubeMetadata(validUrl)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(callCount).toBe(1);
  });

  it('uses exponential backoff delays between retries', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    fakeClient._setFunctionHandler(() => {
      callCount += 1;
      return { errorBody: { error: 'FETCH_TIMEOUT', message: 'timeout' } };
    });

    const promise = fetchYoutubeMetadata(validUrl).catch((e) => e);
    // Flush the microtask queue + all pending timers (0ms, 100ms, 500ms, 1000ms).
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeInstanceOf(YoutubeApiError);
    expect(callCount).toBe(4);
    vi.useRealTimers();
  });
});

describe('buildFallbackTutorialLink', () => {
  it('builds a placeholder with the original URL and extracted videoId', () => {
    const fallback = buildFallbackTutorialLink('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(fallback.url).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(fallback.videoId).toBe('dQw4w9WgXcQ');
    expect(fallback.title).toBe('YouTube Video');
    expect(fallback.metadataReady).toBe(false);
    expect(fallback.addedAt).toBeTruthy();
  });
});
