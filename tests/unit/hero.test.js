import { describe, it, expect } from 'vitest';
import { renderHero, setHeroPhotos } from '../../src/ui/hero.js';

const photo = (id) => ({ id, filename: `${id}.jpg`, thumbnail_url: `https://x/${id}` });

describe('hero collage', () => {
  it('shows the library-wide total, not just the loaded page size', () => {
    const hero = renderHero();
    setHeroPhotos(hero, [photo('a'), photo('b')], 120);

    expect(hero.querySelectorAll('.hero-sticker img')).toHaveLength(2);
    expect(hero.querySelector('.hero-count').textContent).toBe('120crafts saved');
  });

  it('falls back to the photo list length when no total is given', () => {
    const hero = renderHero();
    setHeroPhotos(hero, [photo('a')]);

    expect(hero.querySelector('.hero-count').textContent).toBe('1craft saved');
  });
});
