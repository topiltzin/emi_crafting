// Lazy loader for the <model-viewer> web component (research.md R5). It pulls in three.js, so it
// is only fetched the first time someone opens a 3D view — never on normal page loads.

let loadPromise = null;

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function loadModelViewer() {
  if (!loadPromise) {
    loadPromise = import('@google/model-viewer').catch((error) => {
      loadPromise = null; // allow a retry after a transient chunk-load failure
      throw error;
    });
  }
  return loadPromise;
}
