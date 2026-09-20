// "Tutorials" section (US3): browse craft photos grouped by the YouTube creator whose
// tutorial was used. Two views live here: the creator list, and a single creator's filtered
// photo grid (which reuses photo-gallery.js so favorite/delete/open behave identically to
// every other photo grid in the app).

import { createEmptyState } from './empty-state.js';

export function renderCreatorList(creators) {
  const container = document.createElement('div');
  container.className = 'tutorials-tab';

  if (creators.length === 0) {
    const empty = createEmptyState('tutorials');
    container.appendChild(empty);
    return container;
  }

  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  heading.textContent = 'Tutorials';
  container.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'tutorials-creator-grid';

  creators.forEach((creator) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tutorial-creator-card';
    card.setAttribute('data-action', 'view-creator');
    card.setAttribute('data-channel-id', creator.channelId);
    card.setAttribute('aria-label', `View ${creator.photoCount} craft${creator.photoCount === 1 ? '' : 's'} learned from ${creator.name}`);

    const thumb = document.createElement('img');
    thumb.className = 'tutorial-creator-thumb';
    thumb.src = creator.thumbnail || '';
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.addEventListener('error', () => {
      thumb.style.visibility = 'hidden';
    });

    const meta = document.createElement('div');
    meta.className = 'tutorial-creator-meta';

    const name = document.createElement('p');
    name.className = 'tutorial-creator-name';
    name.textContent = creator.name;

    const count = document.createElement('p');
    count.className = 'tutorial-creator-count';
    count.textContent = `${creator.photoCount} craft${creator.photoCount === 1 ? '' : 's'}`;

    meta.appendChild(name);
    meta.appendChild(count);
    card.appendChild(thumb);
    card.appendChild(meta);
    grid.appendChild(card);
  });

  container.appendChild(grid);
  return container;
}

export function attachCreatorListEvents(container, onSelectCreator) {
  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-action="view-creator"]');
    if (card) {
      onSelectCreator(card.getAttribute('data-channel-id'));
    }
  });
}

export function renderCreatorBackLink() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary tutorials-back-btn';
  btn.setAttribute('data-action', 'tutorials-back');
  btn.textContent = '← Back to Creators';
  return btn;
}

export function renderCreatorHeading(creator) {
  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  heading.textContent = `Crafts learned from ${creator.name}`;
  return heading;
}
