// Modal for adding/editing a photo's YouTube tutorial link. Promise-based like
// create-album-dialog.js. Typing a valid URL auto-fetches metadata (debounced); the Save
// button only persists once a preview (or a fallback-eligible failure) is ready.
//
// UI contract: specs/008-craft-tutorial-links/contracts/tutorial-link-ui-contract.md

import { openDialog } from './dialog.js';
import { isValidYoutubeUrl, fetchYoutubeMetadata, YoutubeApiError } from '../modules/youtube-client.js';

const DEBOUNCE_MS = 400;

const ERROR_MESSAGES = {
  INVALID_URL: 'Not a valid YouTube URL. Try: youtube.com/watch?v=VIDEO_ID',
  VIDEO_NOT_FOUND: 'Video not found on YouTube. It may have been deleted or made private.',
  QUOTA_EXCEEDED: 'YouTube quota exceeded. Try again tomorrow — you can still save the link below.',
  FETCH_TIMEOUT: 'Network timeout. Retry?',
  AUTH_FAILED: 'YouTube is temporarily unavailable. Please try again later.',
  SERVER_ERROR: 'Something went wrong fetching video details. Please try again.'
};

// Errors where the user's typed URL is still worth saving even without full metadata.
const FALLBACK_ELIGIBLE_CODES = new Set(['QUOTA_EXCEEDED', 'FETCH_TIMEOUT', 'AUTH_FAILED', 'SERVER_ERROR']);

function formatDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * @param {{initialUrl?: string, isEdit?: boolean}} options
 * @returns {Promise<{url: string, metadata: object|null, useFallback: boolean}|null>}
 *   resolves null if the user cancels, otherwise the URL to save and (if fetched) its metadata
 */
export function showTutorialLinkDialog({ initialUrl = '', isEdit = false } = {}) {
  return new Promise((resolve) => {
    const content = document.createElement('div');
    content.className = 'tutorial-link-form';

    const label = document.createElement('label');
    label.className = 'tutorial-link-label';
    label.textContent = 'Paste YouTube URL:';
    label.setAttribute('for', 'tutorial-link-url-input');

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'tutorial-link-url-input';
    input.className = 'tutorial-link-input';
    input.placeholder = 'https://youtube.com/watch?v=...';
    input.value = initialUrl;
    input.autocomplete = 'off';
    input.maxLength = 2000;

    const statusEl = document.createElement('div');
    statusEl.className = 'tutorial-link-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    const previewEl = document.createElement('div');
    previewEl.className = 'tutorial-link-preview';
    previewEl.hidden = true;

    const errorEl = document.createElement('p');
    errorEl.className = 'tutorial-link-error';
    errorEl.hidden = true;
    errorEl.setAttribute('role', 'alert');

    content.appendChild(label);
    content.appendChild(input);
    content.appendChild(statusEl);
    content.appendChild(previewEl);
    content.appendChild(errorEl);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('data-action', 'tutorial-link-cancel');
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.setAttribute('data-action', 'tutorial-link-save');
    saveBtn.textContent = isEdit ? 'Update' : 'Save';
    saveBtn.disabled = true;

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    content.appendChild(actions);

    let resolved = false;
    let debounceTimer = null;
    let fetchToken = 0;
    // 'idle' | 'fetching' | 'preview' | 'fallback' | 'error'
    let state = 'idle';
    let fetchedMetadata = null;
    let fallbackEligibleError = null;

    const { close } = openDialog({
      title: isEdit ? 'Edit Tutorial Link' : 'Add Tutorial Link',
      content,
      className: 'tutorial-link-modal',
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }
    });

    function setState(next) {
      state = next;
      previewEl.hidden = state !== 'preview';
      errorEl.hidden = state !== 'error' && state !== 'fallback';
      saveBtn.disabled = state !== 'preview' && state !== 'fallback';
      saveBtn.textContent =
        state === 'fetching'
          ? 'Fetching...'
          : state === 'fallback'
            ? 'Save Anyway'
            : isEdit
              ? 'Update'
              : 'Save';
      statusEl.textContent = state === 'fetching' ? 'Fetching metadata...' : '';
    }

    function renderPreview(metadata) {
      previewEl.innerHTML = '';
      const thumb = document.createElement('img');
      thumb.className = 'tutorial-link-preview-thumb';
      thumb.src = metadata.thumbnail || '';
      thumb.alt = '';
      thumb.width = 80;
      thumb.height = 45;

      const meta = document.createElement('div');
      meta.className = 'tutorial-link-preview-meta';

      const title = document.createElement('p');
      title.className = 'tutorial-link-preview-title';
      title.textContent = metadata.title;

      const sub = document.createElement('p');
      sub.className = 'tutorial-link-preview-sub';
      const durationText = metadata.duration != null ? ` • ${formatDuration(metadata.duration)}` : '';
      sub.textContent = `${metadata.creator}${durationText}`;

      meta.appendChild(title);
      meta.appendChild(sub);
      previewEl.appendChild(thumb);
      previewEl.appendChild(meta);
    }

    function showError(message, { fallbackEligible = false } = {}) {
      errorEl.textContent = message;
      fallbackEligibleError = fallbackEligible;
      setState(fallbackEligible ? 'fallback' : 'error');
    }

    async function runFetch(url) {
      const token = ++fetchToken;
      setState('fetching');
      try {
        const metadata = await fetchYoutubeMetadata(url);
        if (token !== fetchToken) return; // superseded by a newer input change
        fetchedMetadata = metadata;
        renderPreview(metadata);
        setState('preview');
      } catch (error) {
        if (token !== fetchToken) return;
        fetchedMetadata = null;
        if (error instanceof YoutubeApiError) {
          const message = ERROR_MESSAGES[error.code] || error.message;
          showError(message, { fallbackEligible: FALLBACK_ELIGIBLE_CODES.has(error.code) });
        } else {
          showError(ERROR_MESSAGES.SERVER_ERROR, { fallbackEligible: true });
        }
      }
    }

    function scheduleFetch(url, { immediate = false } = {}) {
      clearTimeout(debounceTimer);
      fetchedMetadata = null;
      previewEl.hidden = true;
      errorEl.hidden = true;

      const trimmed = url.trim();
      if (!trimmed) {
        setState('idle');
        return;
      }
      if (!isValidYoutubeUrl(trimmed)) {
        showError(ERROR_MESSAGES.INVALID_URL, { fallbackEligible: false });
        return;
      }

      if (immediate) {
        runFetch(trimmed);
      } else {
        setState('fetching');
        debounceTimer = setTimeout(() => runFetch(trimmed), DEBOUNCE_MS);
      }
    }

    input.addEventListener('input', () => scheduleFetch(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(debounceTimer);
        scheduleFetch(input.value, { immediate: true });
      }
    });

    saveBtn.addEventListener('click', () => {
      if (state !== 'preview' && state !== 'fallback') return;
      resolved = true;
      close();
      resolve({
        url: input.value.trim(),
        metadata: fetchedMetadata,
        useFallback: state === 'fallback'
      });
    });

    cancelBtn.addEventListener('click', () => {
      resolved = true;
      close();
      resolve(null);
    });

    setState('idle');
    // Edit mode: immediately re-resolve the prefilled URL's metadata so the user sees the
    // current video without having to retype/reconfirm it. Any further edit to the URL falls
    // through to the normal debounced-fetch path above.
    if (isEdit && initialUrl) {
      scheduleFetch(initialUrl, { immediate: true });
    }
  });
}
