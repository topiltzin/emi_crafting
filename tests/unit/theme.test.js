import { describe, it, expect, beforeEach } from 'vitest';
import { getThemePreference, setThemePreference, applyTheme, initTheme } from '../../src/modules/theme.js';

const STORAGE_KEY = 'emi-craft-theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme module', () => {
  it('defaults to "system" when nothing is stored', () => {
    expect(getThemePreference()).toBe('system');
  });

  it('defaults to "system" when the stored value is invalid or corrupted', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-real-theme');
    expect(getThemePreference()).toBe('system');
  });

  it('setThemePreference persists the value and getThemePreference reflects it', () => {
    setThemePreference('dark');
    expect(getThemePreference()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setThemePreference throws on an invalid value', () => {
    expect(() => setThemePreference('neon')).toThrow();
  });

  it('applyTheme("dark") sets data-theme="dark" on the document root', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme("light") sets data-theme="light" on the document root', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme("system") removes data-theme entirely', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('setThemePreference applies the theme immediately', () => {
    setThemePreference('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initTheme applies whatever is currently stored', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('initTheme with nothing stored leaves data-theme unset (system default)', () => {
    initTheme();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
