import { describe, it, expect } from 'vitest';
import { renderNav } from '../../src/ui/nav.js';

describe('renderNav icons', () => {
  it('renders an SVG icon (not emoji) for every nav item, wrapped in an aria-hidden span', () => {
    const nav = renderNav('home');
    const links = nav.querySelectorAll('.app-nav-link');

    expect(links).toHaveLength(5);
    links.forEach((link) => {
      const iconSpan = link.querySelector('span[aria-hidden="true"]');
      expect(iconSpan).not.toBeNull();
      expect(iconSpan.querySelector('svg')).not.toBeNull();
    });
  });

  it('does not contain any emoji characters in the nav markup', () => {
    const nav = renderNav('home');
    // A representative sample of the emoji this feature replaces; none should appear anywhere in the nav.
    const emoji = ['🏠', '🖼️', '📁', '💗', '⚙️'];
    emoji.forEach((char) => {
      expect(nav.innerHTML).not.toContain(char);
    });
  });

  it('each icon SVG uses currentColor so it inherits the surrounding text color', () => {
    const nav = renderNav('home');
    const svgs = nav.querySelectorAll('.app-nav-link svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg.getAttribute('stroke')).toBe('currentColor');
    });
  });

  it('still marks the active section with aria-current, unaffected by the icon change', () => {
    const nav = renderNav('albums');
    const active = nav.querySelector('.app-nav-link.is-active');
    expect(active.textContent).toContain('Albums');
    expect(active.getAttribute('aria-current')).toBe('page');
  });
});
