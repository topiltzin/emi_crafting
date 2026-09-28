// Small "3D" sticker on a photo-card when the photo has a saved 3D model (FR-009). Purely
// visual, like tutorial-badge.js — clicking the card still opens the photo viewer.

export function createModelBadge() {
  const badge = document.createElement('span');
  badge.className = 'model-badge';
  badge.setAttribute('aria-label', 'Has a 3D model');
  badge.setAttribute('title', 'Has a 3D model');
  badge.innerHTML = '<span aria-hidden="true">3D</span>';
  return badge;
}
