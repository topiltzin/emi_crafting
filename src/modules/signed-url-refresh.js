import { resolvePhotoUrl } from './photo-url.js';

// Signed URLs expire (photo-url.js), so an <img> rendered from one breaks if the app stays open
// long enough — or a lazy image scrolls into view after expiry. Images that carry their Storage
// path in data-storage-path get re-signed when they fail to load, at most once per few minutes
// so a genuinely missing file doesn't loop.
const RETRY_AFTER_MS = 5 * 60 * 1000;

export function enableSignedUrlRefresh(root = document) {
  root.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.storagePath) return;

      const lastRefresh = Number(img.dataset.urlRefreshedAt || 0);
      if (Date.now() - lastRefresh < RETRY_AFTER_MS) return;
      img.dataset.urlRefreshedAt = String(Date.now());

      resolvePhotoUrl(img.dataset.storagePath)
        .then((url) => {
          if (url) img.src = url;
        })
        .catch((error) => console.warn('Failed to refresh image URL:', error));
    },
    // Resource load errors don't bubble; capture sees them.
    true
  );
}
