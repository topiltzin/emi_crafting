import {
  initDB,
  getAlbums,
  getAllPhotos,
  persistDB,
  deletePhoto,
  deleteAlbum,
  updateAlbumOrder,
  toggleFavorite
} from './modules/db.js';
import { uploadPhotos } from './modules/photo.js';
import { createAlbumIfNeeded } from './modules/album.js';
import { renderAlbumGrid, attachAlbumGridEvents, attachAlbumDragDrop } from './ui/album-grid.js';
import { renderAlbumView, attachAlbumViewEvents } from './ui/album-view.js';
import { renderNav, attachNavEvents } from './ui/nav.js';
import { renderHero, attachHeroEvents } from './ui/hero.js';
import { renderPhotoGallery, attachPhotoGalleryEvents } from './ui/photo-gallery.js';
import { renderUploadZone, attachUploadZoneEvents } from './ui/upload-zone.js';
import { getPhotos, getAlbum } from './modules/db.js';

let currentSection = 'home';
let currentAlbumId = null;

export async function initApp() {
  try {
    await initDB();

    buildShell();
    await navigateTo('home');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError(`Failed to initialize app: ${error.message}`);
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
    showError(`Failed to load: ${error.message}`);
  }
}

async function renderHomeSection(main) {
  const hero = renderHero();
  attachHeroEvents(hero, handleAddPhotosEntry, handleCreateAlbum);
  main.appendChild(hero);

  const photos = getAllPhotos();
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'photos' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderPhotosSection(main) {
  const photos = getAllPhotos();
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'photos' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderFavoritesSection(main) {
  const photos = getAllPhotos({ favoritesOnly: true });
  const gallery = renderPhotoGallery(photos, { emptyStateVariant: 'favorites' });
  attachPhotoGalleryEvents(gallery, handleToggleFavorite, handleDeletePhotoFromGallery);
  attachEmptyStateBridge(gallery);
  main.appendChild(gallery);
}

async function renderSettingsSection(main) {
  const { renderSettingsView } = await import('./ui/settings-view.js');
  const { version: appVersion } = await import('../package.json');
  const albums = getAlbums();
  const photos = getAllPhotos({ limit: 100000 });

  const view = renderSettingsView({
    photoCount: photos.length,
    albumCount: albums.length,
    appVersion
  });
  main.appendChild(view);
}

async function renderAlbumsSection(main) {
  const albums = getAlbums();

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

  attachAlbumGridEvents(grid, handleViewAlbum, handleDeleteAlbum);
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
    const album = getAlbum(albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    const photos = getPhotos(albumId);
    main.removeChild(loading);

    const view = renderAlbumView(album, photos);
    main.appendChild(view);

    attachAlbumViewEvents(view, handleBackToAlbums, handleAddPhotos, handleDeletePhoto);
    attachPhotoGalleryEvents(view, handleToggleFavorite, null);
  } catch (error) {
    console.error('Failed to load album:', error);
    main.removeChild(loading);
    showError(`Failed to load album: ${error.message}`);
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
  const title = window.prompt("Name your new album (e.g. 'Paper Crafts'):", '');
  if (title === null) return;

  const today = new Date().toISOString().slice(0, 10);
  try {
    await createAlbumIfNeeded(today, title || null);
    await navigateTo('albums');
  } catch (error) {
    console.error('Create album failed:', error);
    showError(`Failed to create album: ${error.message}`);
  }
}

function openUploadModal(onConfirm) {
  const app = document.getElementById('app');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = 'Add Photos';

  const content = document.createElement('div');
  content.className = 'modal-content';
  const zone = renderUploadZone();
  content.appendChild(zone);

  modal.appendChild(title);
  modal.appendChild(content);
  backdrop.appendChild(modal);
  app.appendChild(backdrop);

  function closeModal() {
    backdrop.remove();
  }

  attachUploadZoneEvents(zone, async (files) => {
    closeModal();
    await onConfirm(files);
  });

  zone.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="cancel-upload"]')) {
      closeModal();
    }
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
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
    showError(`Upload failed: ${error.message}`);
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

      const result = await uploadPhotos(files);

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
      showError(`Add photos failed: ${error.message}`);
    }
  });
}

async function handleDeletePhoto(photoId) {
  await deletePhoto(photoId, false);
  await persistDB();

  if (currentAlbumId) {
    await renderAlbumDetail(currentAlbumId);
  }
}

async function handleDeletePhotoFromGallery(photoId) {
  await deletePhoto(photoId, false);
  await persistDB();
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
    showError(`Failed to update favorite: ${error.message}`);
  }
}

async function handleDeleteAlbum(albumId) {
  try {
    await deleteAlbum(albumId, false);
    await navigateTo('albums');
  } catch (error) {
    console.error('Delete album failed:', error);
    showError(`Delete album failed: ${error.message}`);
  }
}

async function handleReorderAlbums(albumId, newPosition) {
  try {
    await updateAlbumOrder(albumId, newPosition);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await renderSection('albums');
  } catch (error) {
    console.error('Reorder failed:', error);
    showError(`Failed to reorder album: ${error.message}`);
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
