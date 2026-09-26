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
import { renderUploadZone, attachUploadZoneEvents } from './ui/upload-zone.js';
import { openDialog } from './ui/dialog.js';
import { showCreateAlbumDialog, showRenameAlbumDialog } from './ui/create-album-dialog.js';
import { initTheme, setThemePreference } from './modules/theme.js';
import { getSession, signInOwner } from './modules/supabase-client.js';
import { renderAuthView } from './ui/auth-view.js';
import { getTutorialCreators, getPhotosByCreator } from './modules/tutorial-link.js';
import {
  renderCreatorList,
  attachCreatorListEvents,
  renderCreatorBackLink,
  renderCreatorHeading
} from './ui/tutorials-tab.js';

let currentSection = 'home';
let currentAlbumId = null;
let currentCreatorId = null;
// Incremented on every full re-render of <main>. An async render that finishes after a newer one
// started must not touch the DOM, or it would append stale content / remove nodes that are gone.
let renderToken = 0;

export async function initApp() {
  try {
    initTheme();

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
  await navigateTo('home');

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

async function navigateTo(section) {
  currentSection = section;
  currentAlbumId = null;
  currentCreatorId = null;

  const app = document.getElementById('app');
  const oldNav = app.querySelector('.app-nav');
  const newNav = renderNav(currentSection);
  attachNavEvents(newNav, (nextSection) => navigateTo(nextSection));
  app.replaceChild(newNav, oldNav);

  await renderSection(section);
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

async function renderHomeSection(target) {
  const hero = renderHero();
  attachHeroEvents(hero, handleAddPhotosEntry, handleCreateAlbum);
  target().appendChild(hero);

  // The gallery shows one page; the hero's "N crafts saved" needs the true total.
  const [photos, total] = await Promise.all([getAllPhotos(), countPhotos()]);
  setHeroPhotos(hero, photos, total);
  target().appendChild(buildGallery(photos, 'photos'));
}

async function renderPhotosSection(target) {
  const photos = await getAllPhotos();
  target().appendChild(buildGallery(photos, 'photos'));
}

async function renderFavoritesSection(target) {
  const photos = await getAllPhotos({ favoritesOnly: true });
  target().appendChild(buildGallery(photos, 'favorites'));
}

function buildGallery(photos, emptyStateVariant) {
  const gallery = renderPhotoGallery(photos, { emptyStateVariant });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhoto, handleOpenPhoto);
  attachEmptyStateBridge(gallery);
  return gallery;
}

async function renderTutorialsSection(target) {
  currentCreatorId = null;
  const creators = await getTutorialCreators();
  const view = renderCreatorList(creators);
  attachCreatorListEvents(view, (channelId) =>
    renderCreatorDetail(document.querySelector('#app main'), channelId, creators)
  );

  view.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="browse-photos"]')) {
      navigateTo('photos');
    }
  });

  target().appendChild(view);
}

async function renderCreatorDetail(main, channelId, creators) {
  currentCreatorId = channelId;
  const creator = creators.find((c) => c.channelId === channelId);
  if (!creator) return;

  const token = ++renderToken;
  main.innerHTML = '';

  const backLink = renderCreatorBackLink();
  backLink.addEventListener('click', () => renderSection('tutorials'));
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
      throw new Error('Album not found');
    }

    const photos = await getPhotos(albumId);
    if (token !== renderToken) return;
    loading.remove();

    const view = renderAlbumView(album, photos);
    main.appendChild(view);

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

    const result = await uploadPhotos(files);

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
      renderSection(currentSection);
    }, 1500);
  } catch (error) {
    console.error('Upload failed:', error);
    showError(describeError(error, 'Upload failed'));
  }
}

async function handleViewAlbum(albumId) {
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

      const result = await uploadPhotos(files, currentAlbumId);

      if (result.errors.length > 0) {
        updateStatus(status, `Added ${result.uploaded.length} photos. Failed: ${result.errors.length}`, 'error');
      } else {
        updateStatus(status, `Added ${photoCountLabel(result.uploaded.length)}!`);
      }

      setTimeout(() => {
        renderAlbumDetail(currentAlbumId);
      }, 1500);
    } catch (error) {
      console.error('Add photos failed:', error);
      showError(describeError(error, 'Add photos failed'));
    }
  });
}

async function handleDeletePhoto(photoId) {
  try {
    await deletePhoto(photoId, false);
  } catch (error) {
    console.error('Delete photo failed:', error);
    showError(describeError(error, 'Failed to delete photo'));
    return;
  }

  if (currentAlbumId) {
    await renderAlbumDetail(currentAlbumId);
  } else {
    await renderSection(currentSection);
  }
}

async function handleOpenPhoto(photoId) {
  try {
    const photo = await getPhoto(photoId);
    if (!photo) return;
    openPhotoViewer(photo);
  } catch (error) {
    console.error('Failed to open photo:', error);
    showError(describeError(error, 'Failed to open photo'));
  }
}

async function handleToggleFavorite(photoId) {
  try {
    await toggleFavorite(photoId);
    const app = document.getElementById('app');
    const card = app.querySelector(`.photo-card[data-photo-id="${photoId}"] .photo-card-favorite`);
    if (card) {
      const isFavorite = card.classList.toggle('is-favorite');
      card.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
      card.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      if (currentSection === 'favorites' && !isFavorite) {
        await renderSection('favorites');
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
