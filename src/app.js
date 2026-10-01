import {
  initDB,
  getAlbum,
  getAlbums,
  getAlbumDates,
  getPhoto,
  getPhotos,
  getAllPhotos,
  countPhotos,
  deletePhoto,
  deleteAlbum,
  updateAlbum,
  updateAlbumOrder,
  toggleFavorite
} from './modules/db.js';
import { uploadPhotos } from './modules/photo.js';
import { createNamedAlbum } from './modules/album.js';
import { renderAlbumGrid, attachAlbumGridEvents, attachAlbumDragDrop } from './ui/album-grid.js';
import { renderAlbumView, attachAlbumViewEvents } from './ui/album-view.js';
import { renderNav, attachNavEvents } from './ui/nav.js';
import { renderHero, attachHeroEvents, setHeroPhotos } from './ui/hero.js';
import { renderPhotoGallery, attachPhotoGalleryEvents } from './ui/photo-gallery.js';
import { openPhotoViewer } from './ui/photo-viewer.js';
import { createPhotoCard } from './ui/photo-card.js';
import { renderUploadZone, attachUploadZoneEvents } from './ui/upload-zone.js';
import { openDialog } from './ui/dialog.js';
import { showCreateAlbumDialog, showRenameAlbumDialog } from './ui/create-album-dialog.js';
import { initTheme, setThemePreference } from './modules/theme.js';
import { getSession, signInOwner } from './modules/supabase-client.js';
import { enableSignedUrlRefresh } from './modules/signed-url-refresh.js';
import { renderAuthView } from './ui/auth-view.js';
import { getTutorialCreators, getPhotosByCreator } from './modules/tutorial-link.js';
import {
  renderCreatorList,
  attachCreatorListEvents,
  renderCreatorBackLink,
  renderCreatorHeading
} from './ui/tutorials-tab.js';

const SECTIONS = ['home', 'photos', 'albums', 'favorites', 'tutorials', 'settings'];
// Galleries load this many photos at a time; "Load more" fetches the next page.
const PAGE_SIZE = 50;

let currentSection = 'home';
let currentAlbumId = null;
let currentCreatorId = null;
// Incremented on every full re-render of <main>. An async render that finishes after a newer one
// started must not touch the DOM, or it would append stale content / remove nodes that are gone.
let renderToken = 0;

let appListenersBound = false;
// The open photo viewer, if any: { photoId, hash, close }. It owns a history entry (pushed on
// open) so the browser/phone Back button closes it instead of leaving the page underneath.
let openViewer = null;
// Set when the viewer closes itself and steps back past its own history entry, so the popstate
// that follows isn't mistaken for a navigation.
let ignoreNextPopstate = false;
// How many photos the next gallery render should load up front — set before a re-render that
// should keep what was already showing (e.g. after an upload) instead of snapping to page one.
let keepLoadedCount = 0;

export async function initApp() {
  try {
    initTheme();
    if (!appListenersBound) {
      appListenersBound = true;
      enableSignedUrlRefresh(document);
      window.addEventListener('popstate', handlePopstate);
    }

    const session = await getSession();
    if (!session) {
      showAuthView();
      return;
    }

    await startAuthenticatedApp();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError(describeError(error, 'Failed to initialize app'));
  }
}

// FR-007/SC-005: a network failure gets a specific, actionable message instead of a raw
// error string or an empty/broken gallery.
function describeError(error, contextMessage) {
  if (error && error.code === 'network') {
    return "Can't reach your photo library — check your connection and try again.";
  }
  return `${contextMessage}: ${error.message}`;
}

function showAuthView() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const view = renderAuthView({
    onSignIn: async (email, password) => {
      await signInOwner(email, password);
      app.innerHTML = '';
      await startAuthenticatedApp();
    }
  });

  app.appendChild(view);
}

async function startAuthenticatedApp() {
  const migrationResult = await initDB();
  buildShell();
  await openRoute(parseRoute());
  // A refresh while the viewer was open lands on its history entry; reopen it there.
  if (history.state && history.state.photoViewer) {
    await handleOpenPhoto(history.state.photoViewer, { pushHistory: false });
  }

  // FR-006: if a pre-existing local library didn't fully transfer to the cloud, local data is
  // untouched and safe — tell the user rather than silently retrying forever in the background.
  if (migrationResult && migrationResult.failed > 0) {
    const totalAttempted = migrationResult.migrated + migrationResult.failed;
    showError(
      `${migrationResult.migrated} of ${totalAttempted} existing photos were transferred to your cloud library. ` +
        "The rest are still safe on this device — we'll try again next time you open the app."
    );
  }
}

function buildShell() {
  const app = document.getElementById('app');

  const nav = renderNav(currentSection);
  attachNavEvents(nav, (section) => navigateTo(section));

  const main = document.createElement('main');

  app.appendChild(nav);
  app.appendChild(main);
}

// ----- Routing -----
// Hash routes (#/photos, #/albums/<id>, #/tutorials/<channelId>) give Back/Forward and refresh
// something to restore. Views still render directly on navigation; the URL is recorded with
// pushState alongside, and popstate re-renders whatever the URL now says.

function parseRoute(hash = window.location.hash) {
  const [section, id] = hash
    .replace(/^#\/?/, '')
    .split('/')
    .map((part) => decodeURIComponent(part));
  if (!SECTIONS.includes(section)) return { section: 'home', id: null };
  return { section, id: id || null };
}

function setRoute(path, { replace = false } = {}) {
  const hash = `#/${path}`;
  if (window.location.hash === hash) return;
  if (replace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
}

async function openRoute({ section, id }) {
  setActiveSection(section);
  if (section === 'albums' && id) {
    await renderAlbumDetail(id);
  } else if (section === 'tutorials' && id) {
    await renderCreatorDetailById(id);
  } else {
    setRoute(section, { replace: true });
    await renderSection(section);
  }
}

function handlePopstate(event) {
  if (ignoreNextPopstate) {
    ignoreNextPopstate = false;
    return;
  }
  if (!getMain()) return;

  if (openViewer) {
    const viewer = openViewer;
    openViewer = null;
    viewer.close();
    // Back from the viewer returns to the page it was opened over — already on screen.
    if (window.location.hash === viewer.hash) return;
  }

  const state = event && event.state;
  if (state && state.photoViewer) {
    // Forward onto a viewer entry: reopen that photo over the page underneath.
    handleOpenPhoto(state.photoViewer, { pushHistory: false });
    return;
  }
  openRoute(parseRoute());
}

async function navigateTo(section) {
  setRoute(section);
  setActiveSection(section);
  await renderSection(section);
}

function setActiveSection(section) {
  currentSection = section;
  currentAlbumId = null;
  currentCreatorId = null;

  const app = document.getElementById('app');
  const oldNav = app.querySelector('.app-nav');
  const newNav = renderNav(currentSection);
  attachNavEvents(newNav, (nextSection) => navigateTo(nextSection));
  app.replaceChild(newNav, oldNav);
}

async function renderSection(section) {
  const token = ++renderToken;
  const main = getMain();
  const loading = showLoading(main);

  // A section appends into <main> after awaiting data; if a newer render started meanwhile, it
  // gets a detached stand-in so the stale content never reaches the page.
  const target = () => (token === renderToken ? main : document.createElement('div'));
  try {
    if (section === 'home') {
      await renderHomeSection(target);
    } else if (section === 'photos') {
      await renderPhotosSection(target);
    } else if (section === 'albums') {
      await renderAlbumsSection(target);
    } else if (section === 'favorites') {
      await renderFavoritesSection(target);
    } else if (section === 'tutorials') {
      await renderTutorialsSection(target);
    } else if (section === 'settings') {
      await renderSettingsSection(target);
    }
    loading.remove();
  } catch (error) {
    loading.remove();
    if (token !== renderToken) return;
    console.error(`Failed to load section ${section}:`, error);
    showError(describeError(error, 'Failed to load'));
  }
}

// Size of a gallery's first fetch: one page, or everything that was showing before a re-render.
function takeFirstPageLimit() {
  const limit = Math.max(PAGE_SIZE, keepLoadedCount);
  keepLoadedCount = 0;
  return limit;
}

// Photos currently loaded in the gallery or album on screen.
function loadedPhotoCount() {
  const main = getMain();
  return main ? main.querySelectorAll('.photo-card').length : 0;
}

async function renderHomeSection(target) {
  const hero = renderHero();
  attachHeroEvents(hero, handleAddPhotosEntry, handleCreateAlbum);
  target().appendChild(hero);

  // The gallery shows one page; the hero's "N crafts saved" needs the true total.
  const limit = takeFirstPageLimit();
  const fetchPage = (offset, pageLimit = PAGE_SIZE) => getAllPhotos({ offset, limit: pageLimit });
  const [photos, total] = await Promise.all([fetchPage(0, limit), countPhotos()]);
  setHeroPhotos(hero, photos, total);

  let remaining = total;
  target().appendChild(
    buildGallery(photos, 'photos', fetchPage, limit, {
      onRemove: (shownPhotos) => {
        remaining = Math.max(0, remaining - 1);
        setHeroPhotos(hero, shownPhotos, remaining);
      }
    })
  );
}

async function renderPhotosSection(target) {
  const limit = takeFirstPageLimit();
  const fetchPage = (offset, pageLimit = PAGE_SIZE) => getAllPhotos({ offset, limit: pageLimit });
  target().appendChild(buildGallery(await fetchPage(0, limit), 'photos', fetchPage, limit));
}

async function renderFavoritesSection(target) {
  const limit = takeFirstPageLimit();
  const fetchPage = (offset, pageLimit = PAGE_SIZE) =>
    getAllPhotos({ favoritesOnly: true, offset, limit: pageLimit });
  target().appendChild(buildGallery(await fetchPage(0, limit), 'favorites', fetchPage, limit));
}

// fetchPage(offset), when given, loads further pages behind a "Load more" button (firstLimit is
// what the first page asked for, to tell whether more may exist). Events hang off the stable
// wrapper so they keep working when the month-grouped gallery is re-rendered.
//
// The wrapper's galleryController lets deletes and favorite changes update the loaded photos in
// place — re-fetching would throw away every page loaded so far and jump back to the top.
function buildGallery(firstPage, emptyStateVariant, fetchPage = null, firstLimit = PAGE_SIZE, { onRemove } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'paged-gallery';
  let photos = firstPage;
  let gallery = renderPhotoGallery(photos, { emptyStateVariant });
  wrapper.appendChild(gallery);
  attachPhotoGalleryEvents(wrapper, handleToggleFavorite, handleDeletePhoto, handleOpenPhoto);
  attachEmptyStateBridge(wrapper);

  function rerender() {
    const updated = renderPhotoGallery(photos, { emptyStateVariant });
    gallery.replaceWith(updated);
    gallery = updated;
  }

  wrapper.galleryController = {
    removePhoto(photoId) {
      if (!photos.some((photo) => photo.id === photoId)) return;
      photos = photos.filter((photo) => photo.id !== photoId);
      rerender();
      if (onRemove) onRemove(photos);
    },
    // rerender: redraw now (for changes the card shows that weren't already applied to the DOM).
    updatePhoto(photoId, changes, { rerender: redraw = false } = {}) {
      photos = photos.map((photo) => (photo.id === photoId ? { ...photo, ...changes } : photo));
      if (redraw) rerender();
    }
  };

  if (fetchPage && firstPage.length === firstLimit) {
    wrapper.appendChild(
      createLoadMoreButton(async () => {
        const page = await fetchPage(photos.length);
        const seen = new Set(photos.map((photo) => photo.id));
        photos = photos.concat(page.filter((photo) => !seen.has(photo.id)));
        rerender();
        return page.length === PAGE_SIZE;
      })
    );
  }
  return wrapper;
}

function getGalleryController() {
  const main = getMain();
  const wrapper = main && main.querySelector('.paged-gallery');
  return wrapper ? wrapper.galleryController : null;
}

// loadNextPage() resolves to whether another page may exist.
function createLoadMoreButton(loadNextPage) {
  const container = document.createElement('div');
  container.className = 'load-more';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-secondary';
  button.textContent = 'Load more photos';

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Loading…';
    try {
      if (!(await loadNextPage())) {
        container.remove();
        return;
      }
    } catch (error) {
      console.error('Failed to load more photos:', error);
      showError(describeError(error, 'Failed to load more photos'));
    }
    button.disabled = false;
    button.textContent = 'Load more photos';
  });

  container.appendChild(button);
  return container;
}

async function renderTutorialsSection(target) {
  currentCreatorId = null;
  const creators = await getTutorialCreators();
  const view = renderCreatorList(creators);
  attachCreatorListEvents(view, (channelId) => {
    setRoute(`tutorials/${encodeURIComponent(channelId)}`);
    renderCreatorDetail(getMain(), channelId, creators);
  });

  view.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="browse-photos"]')) {
      navigateTo('photos');
    }
  });

  target().appendChild(view);
}

// Deep link / Back-Forward entry point: the creator list isn't in hand yet.
async function renderCreatorDetailById(channelId) {
  const token = ++renderToken;
  const main = getMain();
  const loading = showLoading(main);
  let creators;
  try {
    creators = await getTutorialCreators();
  } catch (error) {
    if (token !== renderToken) return;
    loading.remove();
    console.error('Failed to load tutorial creators:', error);
    showError(describeError(error, 'Failed to load'));
    return;
  }
  if (token !== renderToken) return;

  if (!creators.some((c) => c.channelId === channelId)) {
    setRoute('tutorials', { replace: true });
    await renderSection('tutorials');
    return;
  }
  await renderCreatorDetail(main, channelId, creators);
}

async function renderCreatorDetail(main, channelId, creators) {
  currentCreatorId = channelId;
  const creator = creators.find((c) => c.channelId === channelId);
  if (!creator) return;

  const token = ++renderToken;
  main.innerHTML = '';

  const backLink = renderCreatorBackLink();
  backLink.addEventListener('click', () => {
    setRoute('tutorials');
    renderSection('tutorials');
  });
  main.appendChild(backLink);
  main.appendChild(renderCreatorHeading(creator));

  let photos;
  try {
    photos = await getPhotosByCreator(channelId);
  } catch (error) {
    if (token !== renderToken) return;
    console.error('Failed to load creator photos:', error);
    showError(describeError(error, 'Failed to load'));
    return;
  }
  if (token !== renderToken) return;
  main.appendChild(buildGallery(photos, 'photos'));
}

async function renderSettingsSection(target) {
  const { renderSettingsView, attachSettingsViewEvents } = await import('./ui/settings-view.js');
  const { version: appVersion } = await import('../package.json');
  const [photoCount, albumDates] = await Promise.all([countPhotos(), getAlbumDates()]);

  const view = renderSettingsView({
    photoCount,
    albumCount: albumDates.length,
    appVersion
  });
  attachSettingsViewEvents(view, (theme) => setThemePreference(theme));
  target().appendChild(view);
}

async function renderAlbumsSection(target) {
  const albums = await getAlbums();

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn btn-primary';
  uploadBtn.textContent = '+ Add Photos';
  uploadBtn.addEventListener('click', handleAddPhotosEntry);
  toolbar.appendChild(uploadBtn);
  target().appendChild(toolbar);

  const grid = renderAlbumGrid(albums);
  target().appendChild(grid);

  attachAlbumGridEvents(grid, handleViewAlbum, handleDeleteAlbum, handleEditAlbum);
  attachAlbumDragDrop(grid, handleReorderAlbums);

  grid.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="add-photos"]')) {
      handleAddPhotosEntry();
    }
  });
}

async function renderAlbumDetail(albumId) {
  currentAlbumId = albumId;
  const token = ++renderToken;
  const main = getMain();
  const loading = showLoading(main);

  try {
    const album = await getAlbum(albumId);
    if (!album) {
      // A stale link (bookmark, Back into a deleted album): land on the album list instead.
      if (token !== renderToken) return;
      setRoute('albums', { replace: true });
      setActiveSection('albums');
      await renderSection('albums');
      return;
    }

    const limit = takeFirstPageLimit();
    const photos = await getPhotos(albumId, 0, limit);
    if (token !== renderToken) return;
    loading.remove();

    const view = renderAlbumView(album, photos);
    main.appendChild(view);

    if (photos.length === limit) {
      const grid = view.querySelector('.photo-grid');
      view.appendChild(
        createLoadMoreButton(async () => {
          // Offset from what's on screen: deletes since the last page shift the server's offsets.
          const shownIds = new Set(
            Array.from(grid.querySelectorAll('.photo-card'), (card) => card.getAttribute('data-photo-id'))
          );
          const page = await getPhotos(albumId, shownIds.size, PAGE_SIZE);
          page
            .filter((photo) => !shownIds.has(photo.id))
            .forEach((photo) => grid.appendChild(createPhotoCard(photo)));
          return page.length === PAGE_SIZE;
        })
      );
    }

    attachAlbumViewEvents(view, handleBackToAlbums, handleAddPhotos, handleDeletePhoto, () =>
      handleEditAlbum(albumId)
    );
    attachPhotoGalleryEvents(view, handleToggleFavorite, null, handleOpenPhoto);
  } catch (error) {
    if (token !== renderToken) return;
    console.error('Failed to load album:', error);
    loading.remove();
    showError(describeError(error, 'Failed to load album'));
  }
}

function attachEmptyStateBridge(galleryElement) {
  galleryElement.addEventListener('photo-gallery:empty-state-cta', (event) => {
    if (event.detail.action === 'add-photos') {
      handleAddPhotosEntry();
    } else if (event.detail.action === 'browse-photos') {
      navigateTo('photos');
    }
  });
}

function handleAddPhotosEntry() {
  openUploadModal(async (files) => {
    await handleUploadPhotos(files);
  });
}

async function handleCreateAlbum() {
  const title = await showCreateAlbumDialog();
  if (title === null) return;

  try {
    // Always succeeds — no date to pick, no collision to resolve. See createNamedAlbum().
    await createNamedAlbum(title);
    await navigateTo('albums');
  } catch (error) {
    console.error('Create album failed:', error);
    showError(describeError(error, 'Failed to create album'));
  }
}

function openUploadModal(onConfirm) {
  const zone = renderUploadZone();

  const { close } = openDialog({ title: 'Add Photos', content: zone });

  attachUploadZoneEvents(zone, async (files) => {
    close();
    await onConfirm(files);
  });

  zone.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="cancel-upload"]')) {
      close();
    }
  });
}

async function handleUploadPhotos(files) {
  if (!files || files.length === 0) return;

  try {
    const status = showStatus(`Uploading ${photoCountLabel(files.length)}...`);

    const result = await uploadPhotos(files, null, {
      onProgress: (done, total) => updateStatus(status, `Uploading ${done} of ${total}...`)
    });

    if (result.errors.length > 0) {
      updateStatus(
        status,
        `Uploaded ${result.uploaded.length} photos. Failed: ${result.errors.map((e) => e.filename).join(', ')}`,
        'error'
      );
    } else {
      updateStatus(status, `Successfully uploaded ${photoCountLabel(result.uploaded.length)}!`);
    }

    setTimeout(() => {
      rerenderKeepingPlace(result.uploaded.length, () => renderSection(currentSection));
    }, 1500);
  } catch (error) {
    console.error('Upload failed:', error);
    showError(describeError(error, 'Upload failed'));
  }
}

// Re-renders the current view with everything that was loaded (plus newly added photos) and
// restores the scroll position, instead of snapping back to the first page at the top.
async function rerenderKeepingPlace(addedCount, render) {
  const scrollY = window.scrollY;
  keepLoadedCount = loadedPhotoCount() + addedCount;
  await render();
  window.scrollTo(0, scrollY);
}

async function handleViewAlbum(albumId) {
  setRoute(`albums/${encodeURIComponent(albumId)}`);
  await renderAlbumDetail(albumId);
}

async function handleBackToAlbums() {
  await navigateTo('albums');
}

function handleAddPhotos() {
  if (!currentAlbumId) return;

  openUploadModal(async (files) => {
    if (files.length === 0) return;

    try {
      const status = showStatus(`Adding ${photoCountLabel(files.length)}...`);

      const result = await uploadPhotos(files, currentAlbumId, {
        onProgress: (done, total) => updateStatus(status, `Adding ${done} of ${total}...`)
      });

      if (result.errors.length > 0) {
        updateStatus(status, `Added ${result.uploaded.length} photos. Failed: ${result.errors.length}`, 'error');
      } else {
        updateStatus(status, `Added ${photoCountLabel(result.uploaded.length)}!`);
      }

      setTimeout(() => {
        rerenderKeepingPlace(result.uploaded.length, () => renderAlbumDetail(currentAlbumId));
      }, 1500);
    } catch (error) {
      console.error('Add photos failed:', error);
      showError(describeError(error, 'Add photos failed'));
    }
  });
}

async function handleDeletePhoto(photoId) {
  try {
    // Permanent, like album deletion: the dialog promises "can't be undone" and there is no trash
    // screen, so a soft delete only left invisible files consuming storage forever.
    await deletePhoto(photoId, true);
  } catch (error) {
    console.error('Delete photo failed:', error);
    showError(describeError(error, 'Failed to delete photo'));
    return;
  }

  if (currentAlbumId) {
    removeAlbumPhotoCard(photoId);
    return;
  }
  const controller = getGalleryController();
  if (controller) {
    controller.removePhoto(photoId);
  } else {
    await renderSection(currentSection);
  }
}

function removeAlbumPhotoCard(photoId) {
  const main = getMain();
  const card = main.querySelector(`.photo-card[data-photo-id="${photoId}"]`);
  if (card) card.remove();

  const remaining = main.querySelectorAll('.photo-card').length;
  if (remaining === 0) {
    // Last loaded photo gone: re-render for the empty state (or the next page, if any).
    renderAlbumDetail(currentAlbumId);
    return;
  }
  const countEl = main.querySelector('.album-photo-count');
  if (countEl) {
    const count = Math.max(0, parseInt(countEl.dataset.count, 10) - 1);
    countEl.dataset.count = String(count);
    countEl.textContent = photoCountLabel(count);
  }
}

async function handleOpenPhoto(photoId, { pushHistory = true } = {}) {
  try {
    const photo = await getPhoto(photoId);
    if (!photo) return;
    if (openViewer) openViewer.close();

    const hash = window.location.hash;
    // The viewer can add/remove a tutorial link or 3D model; reflect that on the card (badges)
    // once it closes, and in the loaded photos a later in-place re-render draws from.
    let changedPhoto = null;
    const applyViewerChanges = () => {
      const controller = getGalleryController();
      if (changedPhoto && controller) {
        const { tutorial_link, model_storage_path } = changedPhoto;
        controller.updatePhoto(photoId, { tutorial_link, model_storage_path }, { rerender: true });
      }
      changedPhoto = null;
    };
    const viewer = openPhotoViewer(photo, {
      onPhotoChange: (updated) => {
        changedPhoto = updated;
      },
      // Dismissed by the user: drop the viewer's history entry so Back doesn't "reopen" nothing.
      onClose: () => {
        applyViewerChanges();
        if (openViewer !== entry) return;
        openViewer = null;
        if (history.state && history.state.photoViewer === photoId) {
          ignoreNextPopstate = true;
          history.back();
        }
      }
    });
    const entry = {
      photoId,
      hash,
      close: () => {
        viewer.close();
        applyViewerChanges();
      }
    };
    openViewer = entry;
    if (pushHistory) history.pushState({ photoViewer: photoId }, '', hash);
  } catch (error) {
    console.error('Failed to open photo:', error);
    showError(describeError(error, 'Failed to open photo'));
  }
}

async function handleToggleFavorite(photoId) {
  try {
    const updated = await toggleFavorite(photoId);
    const controller = getGalleryController();
    if (controller) controller.updatePhoto(photoId, { is_favorite: updated.is_favorite });
    const app = document.getElementById('app');
    const card = app.querySelector(`.photo-card[data-photo-id="${photoId}"] .photo-card-favorite`);
    if (card) {
      const isFavorite = card.classList.toggle('is-favorite');
      card.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
      card.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      if (currentSection === 'favorites' && !isFavorite) {
        if (controller) {
          controller.removePhoto(photoId);
        } else {
          await renderSection('favorites');
        }
      }
    }
  } catch (error) {
    console.error('Toggle favorite failed:', error);
    showError(describeError(error, 'Failed to update favorite'));
  }
}

async function handleDeleteAlbum(albumId) {
  try {
    // Permanent deletion, matching what the confirmation dialog already promises ("can't be
    // undone") — the app has no trash/restore screen, so a soft delete was invisible, unrecoverable
    // clutter that still consumed storage forever.
    await deleteAlbum(albumId, true);
    await navigateTo('albums');
  } catch (error) {
    console.error('Delete album failed:', error);
    showError(describeError(error, 'Delete album failed'));
  }
}

async function handleEditAlbum(albumId) {
  try {
    const album = await getAlbum(albumId);
    if (!album) return;

    const newTitle = await showRenameAlbumDialog(album.title || '');
    if (newTitle === null) return;

    await updateAlbum(albumId, { title: newTitle });

    if (currentAlbumId === albumId) {
      await renderAlbumDetail(albumId);
    } else {
      await renderSection(currentSection);
    }
  } catch (error) {
    console.error('Rename album failed:', error);
    showError(describeError(error, 'Failed to rename album'));
  }
}

async function handleReorderAlbums(albumId, newPosition) {
  try {
    await updateAlbumOrder(albumId, newPosition);
    await renderSection('albums');
  } catch (error) {
    console.error('Reorder failed:', error);
    showError(describeError(error, 'Failed to reorder album'));
    throw error;
  }
}

function getMain() {
  return document.getElementById('app').querySelector('main');
}

function showLoading(main) {
  main.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.innerHTML = '<div class="spinner"></div>';
  main.appendChild(loading);
  return loading;
}

function photoCountLabel(count) {
  return `${count} photo${count !== 1 ? 's' : ''}`;
}

function showStatus(message) {
  const main = getMain();

  const status = document.createElement('div');
  status.className = 'alert alert-success';
  status.textContent = message;

  main.insertBefore(status, main.firstChild);

  return status;
}

function updateStatus(element, message, type = 'success') {
  element.className = `alert alert-${type}`;
  element.textContent = message;
}

function showError(message) {
  const app = document.getElementById('app');
  const main = app.querySelector('main');

  const error = document.createElement('div');
  error.className = 'alert alert-error';
  error.textContent = message;

  if (main) {
    main.insertBefore(error, main.firstChild);
  } else {
    app.replaceChildren(error);
  }

  setTimeout(() => {
    error.remove();
  }, 5000);
}
