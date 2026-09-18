import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateNewPosition, initDragDrop } from '../../src/modules/dnd.js';

function makeDragEvent(type, dataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = dataTransfer || { setData: vi.fn(), effectAllowed: null, dropEffect: null };
  return event;
}

describe('Drag-Drop Module', () => {
  describe('calculateNewPosition', () => {
    it('should handle dragging down', () => {
      // Drag from index 0 to index 2
      const newPos = calculateNewPosition(0, 2, 4);
      expect(newPos).toBe(1);
    });

    it('should handle dragging up', () => {
      // Drag from index 3 to index 1
      const newPos = calculateNewPosition(3, 1, 4);
      expect(newPos).toBe(1);
    });

    it('should return same index if no movement', () => {
      const newPos = calculateNewPosition(1, 1, 4);
      expect(newPos).toBe(1);
    });

    it('should handle edge case - drag to end', () => {
      const newPos = calculateNewPosition(0, 3, 4);
      expect(newPos).toBe(2);
    });

    it('should handle edge case - drag from end', () => {
      const newPos = calculateNewPosition(3, 0, 4);
      expect(newPos).toBe(0);
    });
  });

  describe('Drag event simulation', () => {
    let gridElement;

    beforeEach(() => {
      // Create mock grid element with album cards
      gridElement = document.createElement('div');
      gridElement.className = 'album-grid';

      for (let i = 0; i < 3; i++) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-album-id', `${i + 1}`);
        card.textContent = `Album ${i + 1}`;
        gridElement.appendChild(card);
      }

      document.body.appendChild(gridElement);
    });

    afterEach(() => {
      document.body.removeChild(gridElement);
    });

    it('should find dragged album card', () => {
      const cards = gridElement.querySelectorAll('.album-card');
      expect(cards.length).toBe(3);
      expect(cards[0].getAttribute('data-album-id')).toBe('1');
    });

    it('should have draggable attribute', () => {
      const card = gridElement.querySelector('.album-card');
      expect(card.getAttribute('draggable')).toBe('true');
    });
  });

  describe('initDragDrop', () => {
    let gridElement;
    let cards;

    beforeEach(() => {
      gridElement = document.createElement('div');
      gridElement.className = 'album-grid';
      for (let i = 0; i < 3; i++) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.setAttribute('data-album-id', `${i + 1}`);
        gridElement.appendChild(card);
      }
      document.body.appendChild(gridElement);
      cards = gridElement.querySelectorAll('.album-card');
    });

    afterEach(() => {
      document.body.removeChild(gridElement);
    });

    it('marks the source card as dragging on dragstart', () => {
      initDragDrop(gridElement, vi.fn());
      cards[0].dispatchEvent(makeDragEvent('dragstart'));
      expect(cards[0].classList.contains('dragging')).toBe(true);
    });

    it('highlights the hovered card on dragover and clears it on dragleave', () => {
      initDragDrop(gridElement, vi.fn());
      cards[0].dispatchEvent(makeDragEvent('dragstart'));

      cards[1].dispatchEvent(makeDragEvent('dragover'));
      expect(cards[1].classList.contains('drag-over')).toBe(true);

      cards[1].dispatchEvent(makeDragEvent('dragleave'));
      expect(cards[1].classList.contains('drag-over')).toBe(false);
    });

    it('calls onReorder with the dragged album id and the corrected drop position, then cleans up', async () => {
      const onReorder = vi.fn().mockResolvedValue();
      initDragDrop(gridElement, onReorder);

      cards[0].dispatchEvent(makeDragEvent('dragstart'));
      cards[2].dispatchEvent(makeDragEvent('dragover'));
      cards[2].dispatchEvent(makeDragEvent('drop'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Album ids are opaque strings end-to-end now (Supabase uses UUIDs); dnd.js reads the
      // id straight from the DOM attribute without parsing it as a number.
      // Forward drag (0 -> 2 of 3): calculateNewPosition(0, 2, 3) === 1, not the raw drop
      // index 2 — dropping past other cards must land exactly where the indicator showed.
      expect(onReorder).toHaveBeenCalledWith('1', 1);
      expect(cards[0].classList.contains('dragging')).toBe(false);
      expect(cards[2].classList.contains('drag-over')).toBe(false);
    });

    it('corrects the drop position the same way for a backward drag', async () => {
      const onReorder = vi.fn().mockResolvedValue();
      initDragDrop(gridElement, onReorder);

      cards[2].dispatchEvent(makeDragEvent('dragstart'));
      cards[0].dispatchEvent(makeDragEvent('dragover'));
      cards[0].dispatchEvent(makeDragEvent('drop'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Backward drag (2 -> 0 of 3): calculateNewPosition(2, 0, 3) === 0.
      expect(onReorder).toHaveBeenCalledWith('3', 0);
    });

    it('does not call onReorder when dropped on the same card it started from', async () => {
      const onReorder = vi.fn();
      initDragDrop(gridElement, onReorder);

      cards[0].dispatchEvent(makeDragEvent('dragstart'));
      cards[0].dispatchEvent(makeDragEvent('drop'));

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('cleans up dragging state on dragend', () => {
      initDragDrop(gridElement, vi.fn());
      cards[0].dispatchEvent(makeDragEvent('dragstart'));
      cards[0].dispatchEvent(new Event('dragend', { bubbles: true }));
      expect(cards[0].classList.contains('dragging')).toBe(false);
    });
  });
});
