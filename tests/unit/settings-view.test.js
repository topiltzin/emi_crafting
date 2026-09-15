import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderSettingsView, attachSettingsViewEvents } from '../../src/ui/settings-view.js';
import { setThemePreference } from '../../src/modules/theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

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

  it('renders an Appearance card with the current preference selected', () => {
    setThemePreference('dark');
    const view = renderSettingsView();

    const checked = view.querySelector('[data-action="set-theme"]:checked');
    expect(checked.value).toBe('dark');
  });

  it('defaults to "system" ("Match Device") selected when no preference is stored', () => {
    const view = renderSettingsView();

    const checked = view.querySelector('[data-action="set-theme"]:checked');
    expect(checked.value).toBe('system');
  });
});

describe('attachSettingsViewEvents', () => {
  it('invokes onAppearanceChange with the selected value', () => {
    const view = renderSettingsView();
    const onAppearanceChange = vi.fn();
    attachSettingsViewEvents(view, onAppearanceChange);

    const darkRadio = view.querySelector('[data-action="set-theme"][value="dark"]');
    darkRadio.checked = true;
    darkRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onAppearanceChange).toHaveBeenCalledWith('dark');
  });
});
