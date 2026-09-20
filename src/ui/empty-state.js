const VARIANTS = {
  photos: {
    icon: '🎨',
    heading: 'No creations yet!',
    message: "Let's add your first craft photo and start your gallery.",
    ctaLabel: 'Add My First Photo',
    ctaAction: 'add-photos'
  },
  albums: {
    icon: '📁',
    heading: 'No albums yet!',
    message: 'Upload some photos and a colorful album will appear here automatically.',
    ctaLabel: 'Add My First Photo',
    ctaAction: 'add-photos'
  },
  favorites: {
    icon: '💗',
    heading: 'No favorites yet!',
    message: 'Tap the heart on any photo to add it to your favorites.',
    ctaLabel: 'Browse My Photos',
    ctaAction: 'browse-photos'
  },
  tutorials: {
    icon: '🎬',
    heading: 'No tutorial links yet!',
    message: 'Open any photo and add a YouTube tutorial link to see it grouped by creator here.',
    ctaLabel: 'Browse My Photos',
    ctaAction: 'browse-photos'
  }
};

export function createEmptyState(variant) {
  const config = VARIANTS[variant] || VARIANTS.photos;

  const container = document.createElement('div');
  container.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = config.icon;

  const heading = document.createElement('h2');
  heading.className = 'empty-state-heading';
  heading.textContent = config.heading;

  const message = document.createElement('p');
  message.className = 'empty-state-message';
  message.textContent = config.message;

  const cta = document.createElement('button');
  cta.className = 'btn btn-primary';
  cta.textContent = config.ctaLabel;
  cta.setAttribute('data-action', config.ctaAction);

  container.appendChild(icon);
  container.appendChild(heading);
  container.appendChild(message);
  container.appendChild(cta);

  return container;
}
