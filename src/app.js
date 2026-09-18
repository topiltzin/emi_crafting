import {
  initDB,
  getAlbums,
  getAllPhotos,
  deletePhoto,
  deleteAlbum,
  updateAlbum,
  updateAlbumOrder,
  toggleFavorite
} from './modules/db.js';
import { uploadPhotos } from './modules/photo.js';
import { createAlbumIfNeeded } from './modules/album.js';
import {
  renderAlbumGrid,
  attachAlbumGridEvents,
  attachAlbumDragDrop,
  formatAlbumDate
} from './ui/album-grid.js';
import { renderAlbumView, attachAlbumViewEvents } from './ui/album-view.js';
import { renderNav, attachNavEvents } from './ui/nav.js';
import { renderHero, attachHeroEvents } from './ui/hero.js';
import { renderPhotoGallery, attachPhotoGalleryEvents } from './ui/photo-gallery.js';
import { renderUploadZone, attachUploadZoneEvents } from './ui/upload-zone.js';
import { openDialog } from './ui/dialog.js';
import { showCreateAlbumDialog, showRenameAlbumDialog } from './ui/create-album-dialog.js';
import { showConfirmDialog } from './ui/confirm-dialog.js';
import { initTheme, setThemePreference } from './modules/theme.js';
import { getPhotos, getAlbum } from './modules/db.js';
import { getSession, signInOwner } from './modules/supabase-client.js';
import { renderAuthView } from './ui/auth-view.js';

let currentSection = 'home';
let currentAlbumId = null;

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

  const app = document.getElementById('app');
  const oldNav = app.querySelector('.app-nav');
  const newNav = renderNav(currentSection);
  attachNavEvents(newNav, (nextSection) => navigateTo(nextSection));
  app.replaceChild(newNav, oldNav);

  await renderSection(section);
}

async function renderSection(section) {
  const app = document.getElementById('app');
  const main = app.querySelector('main');
  main.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.innerHTML = '<div class="spinner"></div>';
  main.appendChild(loading);

  try {
    if (section === 'home') {
      await renderHomeSection(main);
    } else if (section === 'photos') {
      await renderPhotosSection(main);
    } else if (section === 'albums') {
      await renderAlbumsSection(main);
    } else if (section === 'favorites') {
      await renderFavoritesSection(main);
    } else if (section === 'settings') {
      await renderSettingsSection(main);
    }
    main.removeChild(loading);
  } catch (error) {
    console.error(`Failed to load section ${section}:`, error);
    main.removeChild(loading);
    showError(describeError(error, 'Failed to load'));
  }
}

async function renderHomeSection(main) {
  const hero = renderHero();
  attachHeroEvents(hero, handleAddPhotosEntry, handleCreateAlbum);
  main.appendChild(hero);

  const photos = await getAllPhotos();
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'photos' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderPhotosSection(main) {
  const photos = await getAllPhotos();
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'photos' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderFavoritesSection(main) {
  const photos = await getAllPhotos({ favoritesOnly: true });
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'favorites' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderSettingsSection(main) {
  const { renderSettingsView, attachSettingsViewEvents } = await import('./ui/settings-view.js');
  const { version: appVersion } = await import('../package.json');
  const albums = await getAlbums();
  const photos = await getAllPhotos({ limit: 100000 });

  const view = renderSettingsView({
    photoCount: photos.length,
    albumCount: albums.length,
    appVersion
  });
  attachSettingsViewEvents(view, (theme) => setThemePreference(theme));
  main.appendChild(view);
}

async function renderAlbumsSection(main) {
  const albums = await getAlbums();

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn btn-primary';
  uploadBtn.textContent = '+ Add Photos';
  uploadBtn.addEventListener('click', handleAddPhotosEntry);
  toolbar.appendChild(uploadBtn);
  main.appendChild(toolbar);

  const grid = renderAlbumGrid(albums);
  main.appendChild(grid);

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
  const app = document.getElementById('app');
  const main = app.querySelector('main');
  main.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.innerHTML = '<div class="spinner"></div>';
  main.appendChild(loading);

  try {
    const album = await getAlbum(albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    const photos = await getPhotos(albumId);
    main.removeChild(loading);

    const view = renderAlbumView(album, photos);
    main.appendChild(view);

    attachAlbumViewEvents(view, handleBackToAlbums, handleAddPhotos, handleDeletePhoto, () =>
      handleEditAlbum(albumId)
    );
    attachPhotoGalleryEvents(view, handleToggleFavorite, null);
  } catch (error) {
    console.error('Failed to load album:', error);
    main.removeChild(loading);
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

  const today = new Date().toISOString().slice(0, 10);
  try {
    const { album, created } = await createAlbumIfNeeded(today, title || null);
    if (created) {
      await navigateTo('albums');
      return;
    }

    // FR-002: an album for today already exists — createAlbumIfNeeded returned it as-is rather
    // than silently discarding the name the user just typed. Tell them and offer a way out.
    await handleAlbumAlreadyExistsForToday(album);
  } catch (error) {
    console.error('Create album failed:', error);
    showError(describeError(error, 'Failed to create album'));
  }
}

async function handleAlbumAlreadyExistsForToday(existingAlbum) {
  const existingName = existingAlbum.title || formatAlbumDate(existingAlbum.album_date);
  const wantsRename = await showConfirmDialog({
    title: 'Album already exists',
    message: `You already have an album for today ("${existingName}"). Rename it, or keep it as is?`,
    confirmLabel: 'Rename it',
    cancelLabel: 'Keep as is',
    danger: false
  });
  if (!wantsRename) return;

  const newTitle = await showRenameAlbumDialog(existingAlbum.title || '');
  if (newTitle === null) return;

  try {
    await updateAlbum(existingAlbum.id, { title: newTitle });
    await navigateTo('albums');
  } catch (error) {
    console.error('Rename album failed:', error);
    showError(describeError(error, 'Failed to rename album'));
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
    const app = document.getElementById('app');
    const main = app.querySelector('main');

    const status = document.createElement('div');
    status.className = 'alert alert-success';
    status.textContent = `Uploading ${files.length} photo${files.length !== 1 ? 's' : ''}...`;
    main.insertBefore(status, main.firstChild);

    const result = await uploadPhotos(files);

    if (result.errors.length > 0) {
      status.className = 'alert alert-error';
      status.innerHTML = `
        Uploaded ${result.uploaded.length} photos.
        Failed: ${result.errors.map((e) => e.filename).join(', ')}
      `;
    } else {
      status.className = 'alert alert-success';
      status.textContent = `Successfully uploaded ${result.uploaded.length} photo${result.uploaded.length !== 1 ? 's' : ''}!`;
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
      const status = showStatus(`Adding ${files.length} photo${files.length !== 1 ? 's' : ''}...`);

      const result = await uploadPhotos(files, currentAlbumId);

      if (result.errors.length > 0) {
        updateStatus(status, `Added ${result.uploaded.length} photos. Failed: ${result.errors.length}`, 'error');
      } else {
        updateStatus(status, `Added ${result.uploaded.length} photo${result.uploaded.length !== 1 ? 's' : ''}!`, 'success');
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
  await deletePhoto(photoId, false);

  if (currentAlbumId) {
    await renderAlbumDetail(currentAlbumId);
  }
}

async function handleDeletePhotoFromGallery(photoId) {
  await deletePhoto(photoId, false);
  await renderSection(currentSection);
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
    await deleteAlbum(albumId, false);
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
    await new Promise((resolve) => setTimeout(resolve, 100));
    await renderSection('albums');
  } catch (error) {
    console.error('Reorder failed:', error);
    showError(describeError(error, 'Failed to reorder album'));
    throw error;
  }
}

function showStatus(message) {
  const app = document.getElementById('app');
  const main = app.querySelector('main');

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
    app.innerHTML = `<div class="alert alert-error">${message}</div>`;
  }

  setTimeout(() => {
    error.remove();
  }, 5000);
}
