export function initDragDrop(gridElement, onReorder) {
  let draggedElement = null;
  let draggedAlbumId = null;
  let draggedFromIndex = null;

  gridElement.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.album-card');
    if (!card) return;

    draggedElement = card;
    draggedAlbumId = parseInt(card.getAttribute('data-album-id'), 10);

    // Get index
    const cards = Array.from(gridElement.querySelectorAll('.album-card'));
    draggedFromIndex = cards.indexOf(card);

    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', card.innerHTML);
  });

  gridElement.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const card = event.target.closest('.album-card');
    if (card && card !== draggedElement) {
      card.classList.add('drag-over');
    }
  });

  gridElement.addEventListener('dragleave', (event) => {
    const card = event.target.closest('.album-card');
    if (card) {
      card.classList.remove('drag-over');
    }
  });

  gridElement.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const card = event.target.closest('.album-card');
    if (!card || !draggedElement || draggedAlbumId === null) {
      cleanup();
      return;
    }

    const cards = Array.from(gridElement.querySelectorAll('.album-card'));
    const newIndex = cards.indexOf(card);

    if (newIndex >= 0 && draggedFromIndex !== newIndex) {
      try {
        await onReorder(draggedAlbumId, newIndex);
      } catch (error) {
        console.error('Drag-drop reorder failed:', error);
      }
    }

    cleanup();
  });

  gridElement.addEventListener('dragend', () => {
    cleanup();
  });

  function cleanup() {
    const cards = gridElement.querySelectorAll('.album-card');
    cards.forEach((c) => {
      c.classList.remove('dragging', 'drag-over');
    });
    draggedElement = null;
    draggedAlbumId = null;
    draggedFromIndex = null;
  }
}

export function calculateNewPosition(currentIndex, dropIndex, _totalCards) {
  if (currentIndex === dropIndex) return currentIndex;
  if (currentIndex < dropIndex) {
    return dropIndex - 1;
  }
  return dropIndex;
}
