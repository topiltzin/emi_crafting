import { getPhotoOriginalUrl } from '../modules/db.js';
import { openDialog } from './dialog.js';
import { renderTutorialSection } from './tutorial-card.js';
import { showTutorialLinkDialog } from './tutorial-link-modal.js';
import { showConfirmDialog } from './confirm-dialog.js';
import { saveTutorialLink, deleteTutorialLink } from '../modules/tutorial-link.js';

// A photo's own resolved image can't reach Storage for a reason distinct from — but reported
// the same way as — the rest of the app's data operations (app.js's describeError()).
function describeViewerError(error) {
  if (error && error.code === 'network') {
    return "Can't load this photo right now — check your connection and try again.";
  }
  return `Failed to load photo: ${(error && error.message) || 'Unknown error'}`;
}

export function openPhotoViewer(photo) {
  const content = document.createElement('div');
  content.className = 'photo-viewer-content';

  const loading = document.createElement('div');
  loading.className = 'photo-viewer-loading';
  loading.innerHTML = '<div class="spinner"></div>';
  content.appendChild(loading);

  const tutorialWrap = document.createElement('div');
  tutorialWrap.className = 'photo-viewer-tutorial';

  const tutorialErrorEl = document.createElement('p');
  tutorialErrorEl.className = 'photo-viewer-tutorial-error';
  tutorialErrorEl.hidden = true;
  tutorialErrorEl.setAttribute('role', 'alert');

  let currentPhoto = photo;

  function renderTutorial() {
    tutorialWrap.innerHTML = '';
    tutorialWrap.appendChild(
      renderTutorialSection(currentPhoto, {
        onAdd: () => handleAddOrEdit(false),
        onEdit: () => handleAddOrEdit(true),
        onDelete: handleDelete
      })
    );
    tutorialWrap.appendChild(tutorialErrorEl);
  }

  async function handleAddOrEdit(isEdit) {
    const initialUrl = isEdit && currentPhoto.tutorial_link ? currentPhoto.tutorial_link.url : '';
    const result = await showTutorialLinkDialog({ initialUrl, isEdit });
    if (!result) return;

    tutorialErrorEl.hidden = true;
    try {
      const { photo: updatedPhoto } = await saveTutorialLink(currentPhoto.id, result.url, {
        metadata: result.metadata,
        useFallback: result.useFallback
      });
      currentPhoto = updatedPhoto;
      renderTutorial();
    } catch (error) {
      console.error('Failed to save tutorial link:', error);
      tutorialErrorEl.textContent = describeViewerError(error);
      tutorialErrorEl.hidden = false;
    }
  }

  async function handleDelete() {
    const confirmed = await showConfirmDialog({
      title: 'Remove tutorial link?',
      message: 'This only removes the tutorial link — the photo itself is not affected.',
      confirmLabel: 'Remove'
    });
    if (!confirmed) return;

    tutorialErrorEl.hidden = true;
    try {
      currentPhoto = await deleteTutorialLink(currentPhoto.id);
      renderTutorial();
    } catch (error) {
      console.error('Failed to remove tutorial link:', error);
      tutorialErrorEl.textContent = describeViewerError(error);
      tutorialErrorEl.hidden = false;
    }
  }

  // The 3D panel (spec 009) is code-split so the gallery's main bundle doesn't carry it; it
  // mounts into this slot as soon as its chunk arrives.
  const modelSlot = document.createElement('div');
  modelSlot.className = 'model-3d-slot';
  let modelPanel = null;
  let closed = false;

  import('./model-3d-panel.js')
    .then(({ createModel3dPanel }) => {
      if (closed) return;
      modelPanel = createModel3dPanel(currentPhoto, {
        // Keeps the tutorial handlers working on the latest row after a 3D change (and vice versa).
        onPhotoChange: (updated) => {
          currentPhoto = { ...currentPhoto, ...updated };
        },
        getPhotoImage: () => content.querySelector('.photo-viewer-image')
      });
      modelSlot.appendChild(modelPanel.element);
    })
    .catch((error) => {
      console.error('Failed to load the 3D model panel:', error);
    });

  content.appendChild(modelSlot);
  content.appendChild(tutorialWrap);

  const dialog = openDialog({
    title: photo.filename || 'Photo',
    content,
    className: 'photo-viewer',
    onClose: () => {
      closed = true;
      if (modelPanel) modelPanel.destroy();
    }
  });

  renderTutorial();

  getPhotoOriginalUrl(photo.storage_path)
    .then((url) => {
      loading.remove();
      const img = document.createElement('img');
      img.className = 'photo-viewer-image';
      img.src = url;
      img.dataset.storagePath = photo.storage_path;
      img.alt = photo.filename ? `Full-resolution photo: ${photo.filename}` : 'Full-resolution photo';
      content.insertBefore(img, modelSlot);
    })
    .catch((error) => {
      loading.remove();
      const errorEl = document.createElement('p');
      errorEl.className = 'photo-viewer-error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = describeViewerError(error);
      content.insertBefore(errorEl, modelSlot);
    });

  return dialog;
}
