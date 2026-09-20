// Small indicator shown on a photo-card in gallery/grid views when the photo has a linked
// tutorial. Purely visual — clicking anywhere on the card (badge included) opens the photo
// detail view like normal, it does not open the modal or the YouTube link directly.

export function createTutorialBadge() {
  const badge = document.createElement('span');
  badge.className = 'tutorial-badge';
  badge.setAttribute('aria-label', 'Tutorial video linked');
  badge.setAttribute('title', 'Tutorial video linked');
  badge.innerHTML = '<span aria-hidden="true">🎬</span>';
  return badge;
}
