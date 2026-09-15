import { describe, it, expect } from 'vitest';
import { renderSettingsView } from '../../src/ui/settings-view.js';

describe('renderSettingsView', () => {
  it('renders app name, version, and gallery stats', () => {
    const view = renderSettingsView({ photoCount: 12, albumCount: 4, appVersion: '2.0.0' });
    const text = view.textContent;

    expect(text).toContain("Emi's Craft House");
    expect(text).toContain('2.0.0');
    expect(text).toContain('12');
    expect(text).toContain('4');
  });

  it('falls back to sensible defaults when stats are missing', () => {
    const view = renderSettingsView();
    const text = view.textContent;

    expect(text).toContain('0');
    expect(text).toContain('1.0.0');
  });
});
