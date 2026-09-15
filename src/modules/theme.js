const STORAGE_KEY = 'emi-craft-theme';
const VALID_THEMES = new Set(['light', 'dark', 'system']);

export function getThemePreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.has(stored) ? stored : 'system';
}

export function setThemePreference(theme) {
  if (!VALID_THEMES.has(theme)) {
    throw new Error(`Invalid theme preference: ${theme}`);
  }
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function initTheme() {
  applyTheme(getThemePreference());
}
