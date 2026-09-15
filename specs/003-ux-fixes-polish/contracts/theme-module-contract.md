# Contract: `modules/theme.js` (new)

This app has no network API and no `Settings` database table (confirmed — `src/modules/db.js` defines only `Albums`, `Photos`, `AlbumOrder`); the appearance preference introduced by User Story 6 lives entirely in this new module and `localStorage`, documented here so `ui/settings-view.js` (Phase 2 tasks) can be built against a stable signature.

## New

### `getThemePreference(): 'light' | 'dark' | 'system'`

- Reads the `emi-craft-theme` `localStorage` key. Returns `'system'` if the key is absent, or if present but not one of the three valid literal values (corrupted/manually-edited storage) — see `data-model.md`'s Appearance Preference validation rule.
- Pure read, no side effects.

### `setThemePreference(theme: 'light' | 'dark' | 'system'): void`

- Writes `theme` to the `emi-craft-theme` `localStorage` key, then calls `applyTheme(theme)` (below) so the change is visible immediately without a reload.
- Throws if `theme` is not one of the three valid values (defensive — `ui/settings-view.js`'s control only ever offers these three, so this should be unreachable in practice).

### `applyTheme(theme: 'light' | 'dark' | 'system'): void`

- `'light'` → sets `document.documentElement.dataset.theme = 'light'` (forces light palette regardless of OS setting).
- `'dark'` → sets `document.documentElement.dataset.theme = 'dark'` (forces dark palette regardless of OS setting).
- `'system'` → removes the `data-theme` attribute entirely, so `main.css`'s existing `@media (prefers-color-scheme: dark)` block is the sole source of truth again, exactly matching today's behavior.
- Idempotent; safe to call multiple times with the same value.

### `initTheme(): void`

- Convenience wrapper called once at app startup (`app.js`'s init sequence): `applyTheme(getThemePreference())`. Ensures the correct palette is applied before first paint, avoiding a flash of the wrong theme.

## CSS contract (`src/styles/main.css`)

**Correction**: this is a smaller change than first assumed. `main.css:53-54` already reads `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` — the `:not([data-theme='light'])` guard means forcing **light** appearance under a dark OS already works today with zero JS involvement, as long as something sets `data-theme="light"` on `<html>`; nothing in the codebase does yet (confirmed via a repo-wide search — this attribute is otherwise unreferenced), but the CSS side of that half was already built. The only real gap is forcing **dark** appearance under a *light* OS, which the current media-query-gated block cannot do regardless of `data-theme`. One new unconditional block closes that gap:

```css
:root[data-theme='dark'] {
  /* same custom properties as the existing prefers-color-scheme: dark block, main.css:55-70ish */
}
```

No new `[data-theme='light']` block is needed — the base `:root { ... }` (`main.css:1-51`) already holds the light values, and the existing `:not([data-theme='light'])` guard already keeps the dark media-query block from overriding them. `applyTheme('system')` removing the `data-theme` attribute entirely reproduces today's behavior exactly (see `research.md` item 6).

## Unchanged (explicitly, for regression-safety)

No existing CSS custom property *values* change — only the selectors gating the existing dark-palette block gain two siblings. Any user who has never opened the new Settings control gets `'system'` as their effective preference, which is byte-for-byte today's behavior (OS `prefers-color-scheme` alone decides the palette).
