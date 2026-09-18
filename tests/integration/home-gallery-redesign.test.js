import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAllPhotos } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { renderNav } from '../../src/ui/nav.js';
import { renderHero } from '../../src/ui/hero.js';
import { renderPhotoGallery } from '../../src/ui/photo-gallery.js';

async function renderHomeSection() {
  const container = document.createElement('div');
  container.appendChild(renderNav('home'));
  container.appendChild(renderHero());
  container.appendChild(renderPhotoGallery(await getAllPhotos(), { emptyStateVariant: 'photos' }));
  return container;
}

describe('Home page redesign', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('renders the hero, nav, and a date-grouped gallery of existing photos', async () => {
    await uploadPhotos([
      new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: new Date('2026-09-05').getTime() }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: new Date('2026-08-01').getTime() })
    ]);

    const home = await renderHomeSection();

    expect(home.querySelector('.app-nav')).not.toBeNull();
    expect(home.querySelector('.app-nav-link.is-active').textContent).toContain('Home');
    expect(home.querySelector('.hero-title').textContent).toBe("Emi's Craft House");
    expect(home.querySelectorAll('.date-section')).toHaveLength(2);
    expect(home.querySelectorAll('.photo-card')).toHaveLength(2);
  });

  it('renders the photos empty state when the database has no photos', async () => {
    const home = await renderHomeSection();

    expect(home.querySelector('.empty-state')).not.toBeNull();
    expect(home.querySelector('.empty-state-heading').textContent).toBe('No creations yet!');
    expect(home.querySelector('[data-action="add-photos"]')).not.toBeNull();
  });
});
