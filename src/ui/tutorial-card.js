// Renders the tutorial section of a photo's detail view (hosted inside photo-viewer.js):
// either the linked-tutorial card (US1 display, US2 click-to-watch) or the "Add Tutorial
// Link" empty state. A single render function since the two states share one slot in the
// viewer and only one is ever shown per photo.
//
// UI contract: specs/008-craft-tutorial-links/contracts/tutorial-link-ui-contract.md

import { trackTutorialViewed } from '../modules/tutorial-link.js';

// Inline SVG placeholder — used when a photo has no thumbnail yet, or the real one fails to
// load (img @error), so the layout never collapses to a broken-image icon.
const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="45" viewBox="0 0 80 45">' +
      '<rect width="80" height="45" rx="4" fill="%23ede9fe"/>' +
      '<path d="M32 15l18 7.5L32 30z" fill="%238b5cf6"/></svg>'
  );

function formatDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * @param {object} photo a photo row (may or may not have `tutorial_link`)
 * @param {{onAdd?: Function, onEdit?: Function, onDelete?: Function}} handlers
 * @returns {HTMLElement}
 */
export function renderTutorialSection(photo, handlers = {}) {
  const link = photo.tutorial_link;
  return link ? renderLinkedCard(photo, link, handlers) : renderEmptyState(handlers);
}

function renderEmptyState({ onAdd } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'tutorial-empty-state';

  const hint = document.createElement('p');
  hint.className = 'tutorial-empty-hint';
  hint.textContent = 'Link a YouTube tutorial showing how you made this craft.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary tutorial-add-btn';
  btn.setAttribute('data-action', 'tutorial-add');
  btn.innerHTML = '<span aria-hidden="true">🎬</span> Add Tutorial Link';
  if (typeof onAdd === 'function') btn.addEventListener('click', onAdd);

  wrap.appendChild(hint);
  wrap.appendChild(btn);
  return wrap;
}

function renderLinkedCard(photo, link, { onEdit, onDelete } = {}) {
  const card = document.createElement('div');
  card.className = 'tutorial-card';
  if (link.metadataReady === false) card.classList.add('tutorial-card--pending');

  const watchLink = document.createElement('a');
  watchLink.className = 'tutorial-card-link';
  watchLink.href = link.url;
  watchLink.target = '_blank';
  watchLink.rel = 'noopener noreferrer';
  watchLink.setAttribute('aria-label', `Watch video on YouTube: ${link.title}`);
  watchLink.addEventListener('click', () => trackTutorialViewed(photo.id, link.videoId));

  const thumb = document.createElement('img');
  thumb.className = 'tutorial-card-thumb';
  thumb.src = link.thumbnail || FALLBACK_THUMB;
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.width = 80;
  thumb.height = 45;
  thumb.addEventListener('error', () => {
    thumb.src = FALLBACK_THUMB;
  });

  const meta = document.createElement('div');
  meta.className = 'tutorial-card-meta';

  const title = document.createElement('p');
  title.className = 'tutorial-card-title';
  title.textContent = link.title;
  title.title = link.title; // native tooltip when CSS truncates with ellipsis

  const sub = document.createElement('p');
  sub.className = 'tutorial-card-sub';
  const durationText = link.duration != null ? ` • ${formatDuration(link.duration)}` : '';
  sub.textContent = `${link.creator}${durationText}`;

  meta.appendChild(title);
  meta.appendChild(sub);

  if (link.metadataReady === false) {
    const pending = document.createElement('p');
    pending.className = 'tutorial-card-pending-note';
    pending.textContent = 'Video details unavailable right now — edit the link to retry.';
    meta.appendChild(pending);
  }

  watchLink.appendChild(thumb);
  watchLink.appendChild(meta);
  card.appendChild(watchLink);

  const actions = document.createElement('div');
  actions.className = 'tutorial-card-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'tutorial-card-edit';
  editBtn.setAttribute('data-action', 'tutorial-edit');
  editBtn.setAttribute('aria-label', 'Edit tutorial link');
  editBtn.innerHTML = '<span aria-hidden="true">✏️</span> Edit';
  if (typeof onEdit === 'function') editBtn.addEventListener('click', onEdit);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'tutorial-card-delete';
  deleteBtn.setAttribute('data-action', 'tutorial-delete');
  deleteBtn.setAttribute('aria-label', 'Remove tutorial link');
  deleteBtn.innerHTML = '<span aria-hidden="true">🗑️</span> Remove';
  if (typeof onDelete === 'function') deleteBtn.addEventListener('click', onDelete);

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}
