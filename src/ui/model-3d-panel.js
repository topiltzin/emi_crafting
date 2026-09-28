// The "3D model" section of the photo viewer (spec 009-photo-to-3d-model): start a conversion,
// show its progress, switch between the photo and an interactive 3D view, and redo / download /
// remove the model. UI contract: specs/009-photo-to-3d-model/contracts/client-module.md.

import {
  requestConversion,
  describeRequestError,
  getLatestConversion,
  getDisplayStatus,
  isFailedJob,
  describeConversionError,
  watchConversion,
  getModelUrl,
  getModelDownloadUrl,
  removeModel
} from '../modules/model-conversion.js';
import { isWebGLAvailable, loadModelViewer } from '../modules/model-viewer-loader.js';
import { getPhoto } from '../modules/db.js';
import { showConfirmDialog } from './confirm-dialog.js';

const WORKING_TEXT = 'Making your 3D model… this can take a few minutes. You can keep using the app.';
const TIP_TEXT = 'Works best with one object on a plain background.';
const PRIVACY_TEXT = 'Your photo is sent to an external 3D service only when you tap Make it 3D.';
const NO_WEBGL_TEXT = "Your device can't show 3D models, but here's the photo!";
const LOAD_ERROR_TEXT = "This 3D model couldn't be loaded.";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, action, label) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.setAttribute('data-action', action);
  btn.innerHTML = label;
  return btn;
}

/**
 * @param {object} photo photo row (with model_* columns)
 * @param {{onPhotoChange?: (photo: object) => void, getPhotoImage?: () => HTMLElement|null}} options
 * @returns {{element: HTMLElement, destroy: () => void}}
 */
export function createModel3dPanel(photo, { onPhotoChange, getPhotoImage } = {}) {
  const element = el('section', 'model-3d-panel');
  element.setAttribute('aria-label', '3D model');

  let currentPhoto = photo;
  let job = null;
  let view = 'photo'; // 'photo' | '3d'
  let stopWatching = null;
  let destroyed = false;
  let requesting = false;
  let requestError = null;
  let stage = null; // the mounted 3D stage, kept across re-renders while visible

  function setPhoto(updated) {
    currentPhoto = updated;
    if (typeof onPhotoChange === 'function') onPhotoChange(updated);
  }

  function destroy() {
    destroyed = true;
    if (stopWatching) stopWatching();
    stopWatching = null;
    showPhotoImage(true);
  }

  function showPhotoImage(visible) {
    const img = typeof getPhotoImage === 'function' ? getPhotoImage() : null;
    if (img) img.hidden = !visible;
  }

  function startWatching() {
    if (stopWatching) stopWatching();
    stopWatching = watchConversion(currentPhoto.id, handleJobUpdate);
  }

  async function handleJobUpdate(updatedJob) {
    // The viewer can be torn down without calling destroy() (e.g. an app re-render).
    if (destroyed || !element.isConnected) {
      destroy();
      return;
    }
    job = updatedJob;
    if (job && job.status === 'completed') {
      try {
        const fresh = await getPhoto(currentPhoto.id);
        if (fresh) setPhoto({ ...currentPhoto, ...fresh });
      } catch (error) {
        console.error('Failed to refresh photo after 3D conversion:', error);
      }
    }
    if (!destroyed) render();
  }

  async function startConversion() {
    if (requesting) return;
    requesting = true;
    requestError = null;
    render();
    try {
      job = await requestConversion(currentPhoto.id);
      startWatching();
    } catch (error) {
      console.error('Failed to start 3D conversion:', error);
      requestError = describeRequestError(error);
    } finally {
      requesting = false;
      if (!destroyed) render();
    }
  }

  async function handleRemove() {
    const confirmed = await showConfirmDialog({
      title: 'Remove 3D model?',
      message: 'This only removes the 3D model — the photo itself is not affected.',
      confirmLabel: 'Remove'
    });
    if (!confirmed || destroyed) return;
    try {
      setPhoto(await removeModel(currentPhoto));
      view = 'photo';
      stage = null;
      showPhotoImage(true);
      requestError = null;
    } catch (error) {
      console.error('Failed to remove 3D model:', error);
      requestError = "Couldn't remove the 3D model. Please try again.";
    }
    if (!destroyed) render();
  }

  async function handleDownload() {
    try {
      const url = await getModelDownloadUrl(currentPhoto);
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download 3D model:', error);
      requestError = "Couldn't download the 3D model. Please try again.";
      render();
    }
  }

  function setView(next) {
    view = next;
    if (next === 'photo') stage = null;
    showPhotoImage(next === 'photo');
    render();
  }

  // --- rendering ---------------------------------------------------------------------------

  function renderConvertButton({ label = 'Make it 3D ✨', disabled = false } = {}) {
    const btn = button('btn btn-primary model-3d-convert', 'model-convert', label);
    btn.disabled = disabled;
    btn.addEventListener('click', startConversion);
    return btn;
  }

  function renderWorking() {
    const status = el('div', 'model-3d-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const spinner = el('div', 'spinner model-3d-spinner');
    spinner.setAttribute('aria-hidden', 'true');
    status.appendChild(spinner);
    status.appendChild(el('p', 'model-3d-status-text', WORKING_TEXT));
    return status;
  }

  function renderAlert(text) {
    const alert = el('p', 'model-3d-error', text);
    alert.setAttribute('role', 'alert');
    return alert;
  }

  function renderToggle() {
    const group = el('div', 'model-3d-toggle');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Show photo or 3D model');
    for (const [value, label] of [
      ['photo', 'Photo'],
      ['3d', '3D']
    ]) {
      const btn = button('model-3d-toggle-btn', `model-view-${value}`, label);
      btn.setAttribute('aria-pressed', String(view === value));
      btn.addEventListener('click', () => {
        if (view !== value) setView(value);
      });
      group.appendChild(btn);
    }
    return group;
  }

  function renderMenu(busy) {
    const wrap = el('div', 'model-3d-menu');
    const trigger = button('model-3d-menu-btn', 'model-menu', '<span aria-hidden="true">⋯</span>');
    trigger.setAttribute('aria-label', 'More 3D model options');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = el('div', 'model-3d-menu-list');
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const items = [
      ['model-redo', 'Redo 3D model', startConversion, busy],
      ['model-download', 'Download 3D model', handleDownload, false],
      ['model-remove', 'Remove 3D model', handleRemove, busy]
    ];
    for (const [action, label, handler, disabled] of items) {
      const item = button('model-3d-menu-item', action, label);
      item.setAttribute('role', 'menuitem');
      item.disabled = disabled;
      item.addEventListener('click', () => {
        close();
        handler();
      });
      menu.appendChild(item);
    }

    function close() {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => {
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
      if (opening) {
        const first = menu.querySelector('button:not([disabled])');
        if (first) first.focus();
      }
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        trigger.focus();
      }
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  function renderStage() {
    const wrap = el('div', 'model-3d-stage');

    if (!isWebGLAvailable()) {
      showPhotoImage(true);
      wrap.appendChild(el('p', 'model-3d-fallback', NO_WEBGL_TEXT));
      return wrap;
    }

    const loading = el('div', 'model-3d-loading');
    loading.setAttribute('role', 'status');
    loading.innerHTML = '<div class="spinner" aria-hidden="true"></div><span>Loading 3D model…</span>';
    wrap.appendChild(loading);

    const resetBtn = button('btn btn-secondary model-3d-reset', 'model-reset-view', 'Reset view');
    resetBtn.disabled = true;

    function showLoadError() {
      loading.remove();
      resetBtn.remove();
      const viewer = wrap.querySelector('model-viewer');
      if (viewer) viewer.remove();
      wrap.appendChild(renderAlert(LOAD_ERROR_TEXT));
      const redo = renderConvertButton({ label: 'Redo 3D model' });
      redo.setAttribute('data-action', 'model-redo');
      wrap.appendChild(redo);
      showPhotoImage(true);
    }

    Promise.all([getModelUrl(currentPhoto), loadModelViewer()])
      .then(([url]) => {
        if (destroyed) return;
        const viewer = document.createElement('model-viewer');
        viewer.setAttribute('src', url);
        viewer.setAttribute('camera-controls', '');
        viewer.setAttribute('touch-action', 'pan-y');
        viewer.setAttribute('auto-rotate', '');
        viewer.setAttribute('interaction-prompt', 'auto');
        viewer.setAttribute('alt', `3D model of ${currentPhoto.filename || 'your craft'}`);
        viewer.className = 'model-3d-viewer';
        viewer.addEventListener('load', () => {
          loading.remove();
          resetBtn.disabled = false;
        });
        viewer.addEventListener('error', (event) => {
          console.error('3D model failed to load:', event.detail || event);
          showLoadError();
        });
        resetBtn.addEventListener('click', () => {
          viewer.cameraOrbit = 'auto auto auto';
          viewer.fieldOfView = 'auto';
          if (typeof viewer.jumpCameraToGoal === 'function') viewer.jumpCameraToGoal();
        });
        wrap.insertBefore(viewer, loading);
      })
      .catch((error) => {
        console.error('Failed to open 3D view:', error);
        if (!destroyed) showLoadError();
      });

    wrap.appendChild(resetBtn);
    return wrap;
  }

  function render() {
    const status = getDisplayStatus(currentPhoto, job);
    const hasModel = !!currentPhoto.model_storage_path;
    const busy = requesting || status === 'queued' || status === 'processing';
    const failed = isFailedJob(job) && !requesting;

    // Keep a live 3D stage across status re-renders (e.g. a redo finishing its poll) so the
    // model doesn't reload; drop it if the model is gone or the photo view is selected.
    const keepStage = hasModel && view === '3d' && stage;
    if (keepStage) stage.remove();
    element.innerHTML = '';
    element.classList.toggle('model-3d-panel--has-model', hasModel);

    if (hasModel) {
      const bar = el('div', 'model-3d-bar');
      bar.appendChild(renderToggle());
      bar.appendChild(renderMenu(busy));
      element.appendChild(bar);
      if (view === '3d') {
        stage = keepStage || renderStage();
        element.appendChild(stage);
      }
      if (busy) element.appendChild(renderWorking());
      else if (failed && job) {
        element.appendChild(renderAlert(describeConversionError(job)));
        const retry = renderConvertButton({ label: 'Try again' });
        retry.setAttribute('data-action', 'model-retry');
        element.appendChild(retry);
      }
    } else if (busy) {
      element.appendChild(renderConvertButton({ disabled: true }));
      element.appendChild(renderWorking());
    } else if (status === 'failed' && job) {
      element.appendChild(renderAlert(describeConversionError(job)));
      const retry = renderConvertButton({ label: 'Try again' });
      retry.setAttribute('data-action', 'model-retry');
      element.appendChild(retry);
    } else {
      element.appendChild(renderConvertButton());
      element.appendChild(el('p', 'model-3d-tip', `${TIP_TEXT} ${PRIVACY_TEXT}`));
    }

    if (requestError) element.appendChild(renderAlert(requestError));
  }

  render();

  getLatestConversion(currentPhoto.id)
    .then((latest) => {
      if (destroyed) return;
      job = latest;
      if (job && (job.status === 'queued' || job.status === 'processing') && !isFailedJob(job)) {
        startWatching();
      }
      render();
    })
    .catch((error) => {
      console.error('Failed to load 3D model status:', error);
    });

  return { element, destroy };
}
