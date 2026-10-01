import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../../src/app.js';
import { initDB, createAlbum, createPhoto } from '../../src/modules/db.js';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';

function getApp() {
  return document.getElementById('app');
}

async function waitFor(conditionFn, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await conditionFn()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function seedPhotos(albumId, count) {
  for (let i = 0; i < count; i++) {
    await createPhoto(albumId, {
      filename: `craft-${i}.jpg`,
      file_size: 1,
      mime_type: 'image/jpeg',
      photo_date: '2026-05-01',
      photo_blob: new Blob(['x'], { type: 'image/jpeg' }),
      thumbnail_blob: new Blob(['t'], { type: 'image/jpeg' })
    });
  }
}

async function boot(hash = '') {
  history.replaceState(null, '', `/${hash}`);
  document.body.innerHTML = '<div id="app"></div>';
  await initApp();
}

describe('Paged galleries', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('shows 50 photos, then the rest behind "Load more"', async () => {
    const album = await createAlbum('2026-05-01', 'Big album');
    await seedPhotos(album.id, 55);

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('.photo-card'));
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(50);

    getApp().querySelector('.load-more button').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 55);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(55);
    expect(getApp().querySelector('.load-more')).toBeNull();
  });

  it('pages inside an album too', async () => {
    const album = await createAlbum('2026-05-01', 'Big album');
    await seedPhotos(album.id, 52);

    await boot(`#/albums/${album.id}`);
    await waitFor(() => getApp().querySelector('.album-view .photo-card'));
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(50);

    getApp().querySelector('.load-more button').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 52);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(52);
  });

  it('has no "Load more" when everything fits on one page', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 3);

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('.photo-card'));
    expect(getApp().querySelector('.load-more')).toBeNull();
  });
});

describe('Hash routing', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('records sections and albums in the URL', async () => {
    const album = await createAlbum('2026-05-01', 'Paper');
    await boot();
    expect(window.location.hash).toBe('#/home');

    getApp().querySelector('[data-section="albums"]').click();
    await waitFor(() => getApp().querySelector('.album-card'));
    expect(window.location.hash).toBe('#/albums');

    getApp().querySelector(`[data-action="view"][data-album-id="${album.id}"]`).click();
    await waitFor(() => getApp().querySelector('.album-view'));
    expect(window.location.hash).toBe(`#/albums/${album.id}`);
  });

  it('restores a section and an album from the URL on load', async () => {
    const album = await createAlbum('2026-05-01', 'Paper');

    await boot('#/favorites');
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Favorites');

    await boot(`#/albums/${album.id}`);
    await waitFor(() => getApp().querySelector('.album-view'));
    expect(getApp().querySelector('.album-header h2').textContent).toBe('Paper');
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
  });

  it('re-renders from the URL on Back/Forward', async () => {
    await boot('#/photos');
    getApp().querySelector('[data-section="settings"]').click();
    await waitFor(() => window.location.hash === '#/settings');

    history.replaceState(null, '', '/#/albums');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(getApp().querySelector('.app-nav-link.is-active').textContent).toContain('Albums');
  });

  it('falls back to the album list for a link to an album that no longer exists', async () => {
    await boot('#/albums/does-not-exist');
    await waitFor(() => getApp().querySelector('.album-grid'));
    expect(window.location.hash).toBe('#/albums');
    expect(getApp().querySelector('.alert-error')).toBeNull();
  });

  it('treats an unknown route as Home', async () => {
    await boot('#/nope');
    expect(window.location.hash).toBe('#/home');
  });
});

describe('Photo deletion', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('deleting from the gallery removes the photo row and its files for good', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 1);
    const fake = getCurrentFakeClient();

    await boot('#/photos');
    await waitFor(() => getApp().querySelector('[data-action="delete-photo"]'));
    getApp().querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => document.querySelector('[data-action="confirm-dialog-confirm"]'));
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => fake._tables.photos.length === 0);

    expect(fake._tables.photos).toHaveLength(0);
    expect(fake._storageObjects.size).toBe(0);
  });
});

describe('Photo viewer and the Back button', () => {
  beforeEach(async () => {
    await initDB();
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 2);
  });

  async function openFirstPhoto() {
    await waitFor(() => getApp().querySelector('.photo-card'));
    getApp().querySelector('.photo-card').click();
    await waitFor(() => document.querySelector('.photo-viewer'));
  }

  it('gives the open viewer its own history entry, and Back closes just the viewer', async () => {
    await boot('#/photos');
    const historyLength = history.length;
    await openFirstPhoto();

    expect(history.state && history.state.photoViewer).toBeTruthy();
    expect(history.length).toBe(historyLength + 1);

    history.back();
    await waitFor(() => !document.querySelector('.photo-viewer'));

    expect(document.querySelector('.photo-viewer')).toBeNull();
    expect(window.location.hash).toBe('#/photos');
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(2);
  });

  it('closing the viewer itself steps back off its history entry', async () => {
    await boot('#/photos');
    await openFirstPhoto();

    document.querySelector('[data-action="dialog-close"]').click();
    await waitFor(() => !(history.state && history.state.photoViewer));

    expect(document.querySelector('.photo-viewer')).toBeNull();
    expect(history.state && history.state.photoViewer).toBeFalsy();
    expect(window.location.hash).toBe('#/photos');
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(2);
  });
});

describe('Changes keep the loaded pages', () => {
  beforeEach(async () => {
    await initDB();
  });

  async function loadAll(expected) {
    getApp().querySelector('.load-more button').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === expected);
  }

  async function deleteCard(card) {
    card.querySelector('[data-action="delete-photo"]').click();
    await waitFor(() => document.querySelector('[data-action="confirm-dialog-confirm"]'));
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
  }

  it('deleting a photo removes just that card, keeping later pages', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 55);
    await boot('#/photos');
    await waitFor(() => getApp().querySelector('.load-more'));
    await loadAll(55);

    const lastCard = Array.from(getApp().querySelectorAll('.photo-card')).pop();
    const deletedId = lastCard.getAttribute('data-photo-id');
    await deleteCard(lastCard);
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 54);

    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(54);
    expect(getApp().querySelector(`.photo-card[data-photo-id="${deletedId}"]`)).toBeNull();
  });

  it('deleting inside an album keeps later pages and updates the count', async () => {
    const album = await createAlbum('2026-05-01', 'Big album');
    await seedPhotos(album.id, 52);
    await boot(`#/albums/${album.id}`);
    await waitFor(() => getApp().querySelector('.load-more'));
    await loadAll(52);

    await deleteCard(Array.from(getApp().querySelectorAll('.photo-card')).pop());
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 51);

    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(51);
    expect(getApp().querySelector('.album-photo-count').textContent).toBe('51 photos');
  });

  it('unfavoriting in Favorites removes the card in place', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 3);
    getCurrentFakeClient()._tables.photos.forEach((photo) => {
      photo.is_favorite = true;
    });
    await boot('#/favorites');
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 3);

    getApp().querySelector('.photo-card [data-action="toggle-favorite"]').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 2);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(2);
  });

  it('a favorite set before a delete survives the in-place re-render', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 3);
    await boot('#/photos');
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 3);

    const [first, , last] = getApp().querySelectorAll('.photo-card');
    const favoriteId = first.getAttribute('data-photo-id');
    first.querySelector('[data-action="toggle-favorite"]').click();
    await waitFor(() => first.querySelector('.is-favorite'));

    await deleteCard(last);
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 2);

    const favoriteBtn = getApp().querySelector(
      `.photo-card[data-photo-id="${favoriteId}"] [data-action="toggle-favorite"]`
    );
    expect(favoriteBtn.classList.contains('is-favorite')).toBe(true);
  });

  it('uploading reloads everything that was showing plus the new photo', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 55);
    await boot('#/home');
    await waitFor(() => getApp().querySelector('.load-more'));
    await loadAll(55);

    getApp().querySelector('.hero [data-action="add-photos"]').click();
    await waitFor(() => document.querySelector('.modal .upload-zone'));
    const modal = document.querySelector('.modal');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = {
      files: [new File(['x'], 'new.jpg', { type: 'image/jpeg', lastModified: new Date('2026-05-02T12:00:00').getTime() })]
    };
    modal.querySelector('.upload-zone').dispatchEvent(dropEvent);
    modal.querySelector('[data-action="confirm-upload"]').click();

    // The re-render runs 1.5s after the upload, once the success message has been seen.
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 56);
    expect(getApp().querySelectorAll('.photo-card')).toHaveLength(56);
  });
});

describe('Viewer edits reach the gallery', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('a tutorial link added in the viewer shows on the card and survives an in-place re-render', async () => {
    const album = await createAlbum('2026-05-01');
    await seedPhotos(album.id, 2);
    const fake = getCurrentFakeClient();
    fake._setFunctionHandler(() => ({
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Beginner Blanket Tutorial',
        creator: "Rachel's Crafts",
        channelId: 'UCrachelcraftschannel000',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        duration: 1475
      }
    }));

    await boot('#/photos');
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 2);
    const [linked, other] = getApp().querySelectorAll('.photo-card');
    const linkedId = linked.getAttribute('data-photo-id');
    const otherId = other.getAttribute('data-photo-id');

    linked.click();
    await waitFor(() => document.querySelector('[data-action="tutorial-add"]'));
    document.querySelector('[data-action="tutorial-add"]').click();
    await waitFor(() => document.querySelector('.tutorial-link-input'));
    const input = document.querySelector('.tutorial-link-input');
    input.value = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !document.querySelector('.tutorial-link-preview').hidden);
    expect(document.querySelector('.tutorial-link-preview').hidden).toBe(false);
    document.querySelector('[data-action="tutorial-link-save"]').click();
    await waitFor(() => document.querySelector('.photo-viewer .tutorial-card'));
    expect(document.querySelector('.photo-viewer .tutorial-card')).not.toBeNull();

    document.querySelector('.photo-viewer [data-action="dialog-close"]').click();
    const badgeOn = () =>
      getApp().querySelector(`.photo-card[data-photo-id="${linkedId}"] .tutorial-badge`);
    await waitFor(badgeOn);
    expect(badgeOn()).not.toBeNull();

    // A later in-place re-render (deleting the other photo) must not drop it.
    getApp().querySelector(`.photo-card[data-photo-id="${otherId}"] [data-action="delete-photo"]`).click();
    await waitFor(() => document.querySelector('[data-action="confirm-dialog-confirm"]'));
    document.querySelector('[data-action="confirm-dialog-confirm"]').click();
    await waitFor(() => getApp().querySelectorAll('.photo-card').length === 1);
    expect(badgeOn()).not.toBeNull();
  }, 20000);
});
