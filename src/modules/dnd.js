export function initDragDrop(gridElement, onReorder) {
  let draggedElement = null;
  let draggedAlbumId = null;
  let draggedFromIndex = null;

  gridElement.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.album-card');
    if (!card) return;

    draggedElement = card;
    draggedAlbumId = card.getAttribute('data-album-id');

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
    const dropIndex = cards.indexOf(card);

    if (dropIndex >= 0 && draggedFromIndex !== dropIndex) {
      const newPosition = calculateNewPosition(draggedFromIndex, dropIndex, cards.length);
      try {
        await onReorder(draggedAlbumId, newPosition);
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
