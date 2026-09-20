import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { getAllPhotos } from '../../src/modules/db.js';
import { saveTutorialLink } from '../../src/modules/tutorial-link.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Tutorials tab: browse crafts by creator', () => {
  let fakeClient;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    fakeClient = getCurrentFakeClient();
    await initApp();
  });

  it('shows an empty state when no photos have tutorial links', async () => {
    await uploadPhotos([new File(['x'], 'craft.jpg', { type: 'image/jpeg' })]);

    getApp().querySelector('[data-section="tutorials"]').click();
    await waitFor(() => getApp().querySelector('.empty-state'));

    expect(getApp().querySelector('.empty-state-heading').textContent).toMatch(/No tutorial links/);
  });

  it('lists creators with photo counts and filters to their photos on click', async () => {
    await uploadPhotos([
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['y'], 'b.jpg', { type: 'image/jpeg' }),
      new File(['z'], 'c.jpg', { type: 'image/jpeg' })
    ]);
    const [photoA, photoB, photoC] = await getAllPhotos();

    fakeClient._setFunctionHandler(() => ({
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Video 1',
        creator: "Rachel's Crafts",
        channelId: 'UCrachelcraftschannel000',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        duration: 100
      }
    }));
    await saveTutorialLink(photoA.id, 'https://youtube.com/watch?v=dQw4w9WgXcQ');
    await saveTutorialLink(photoB.id, 'https://youtube.com/watch?v=dQw4w9WgXcQ');

    fakeClient._setFunctionHandler(() => ({
      data: {
        videoId: 'abcdefghijk',
        title: 'Video 2',
        creator: 'Another Maker',
        channelId: 'UCanothermakerchannel000',
        thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
        duration: 200
      }
    }));
    await saveTutorialLink(photoC.id, 'https://youtube.com/watch?v=abcdefghijk');

    getApp().querySelector('[data-section="tutorials"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-creator-card'));

    const cards = getApp().querySelectorAll('.tutorial-creator-card');
    expect(cards.length).toBe(2);

    const rachelCard = Array.from(cards).find((c) => c.textContent.includes("Rachel's Crafts"));
    expect(rachelCard.querySelector('.tutorial-creator-count').textContent).toMatch(/2 craft/);

    rachelCard.click();
    await waitFor(() => getApp().querySelector('.photo-card'));

    expect(getApp().querySelectorAll('.photo-card').length).toBe(2);
    expect(getApp().querySelector('[data-action="tutorials-back"]')).not.toBeNull();

    getApp().querySelector('[data-action="tutorials-back"]').click();
    await waitFor(() => getApp().querySelector('.tutorial-creator-card'));
    expect(getApp().querySelectorAll('.tutorial-creator-card').length).toBe(2);
  });
});
