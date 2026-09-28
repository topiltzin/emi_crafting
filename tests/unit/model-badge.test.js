import { describe, it, expect } from 'vitest';
import { createModelBadge } from '../../src/ui/model-badge.js';
import { createPhotoCard } from '../../src/ui/photo-card.js';

describe('createModelBadge', () => {
  it('renders an accessible "3D" sticker', () => {
    const badge = createModelBadge();
    expect(badge.className).toBe('model-badge');
    expect(badge.getAttribute('aria-label')).toBe('Has a 3D model');
    expect(badge.textContent).toBe('3D');
  });
});

describe('photo card 3D badge (FR-009)', () => {
  it('appears only when the photo has a saved model', () => {
    const without = createPhotoCard({ id: 'p1', filename: 'a.jpg', model_storage_path: null });
    const withModel = createPhotoCard({
      id: 'p2',
      filename: 'b.jpg',
      model_storage_path: 'o/p2/model-j.glb'
    });
    expect(without.querySelector('.model-badge')).toBeNull();
    expect(withModel.querySelector('.photo-card-media .model-badge')).not.toBeNull();
  });
});
