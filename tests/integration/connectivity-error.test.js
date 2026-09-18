import { describe, it, expect } from 'vitest';
import { getCurrentFakeClient } from '../helpers/fake-supabase-mock.js';
import { initApp } from '../../src/app.js';

function getApp() {
  return document.getElementById('app');
}

describe('Connectivity error surfacing (FR-007 / SC-005)', () => {
  it('shows a specific "can\'t reach your photo library" message instead of an empty gallery when Supabase is unreachable', async () => {
    getCurrentFakeClient()._setNetworkDown(true);

    document.body.innerHTML = '<div id="app"></div>';
    await initApp();

    const banner = getApp().querySelector('.alert-error');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toBe("Can't reach your photo library — check your connection and try again.");

    // Not a silently-empty gallery: the empty state (which would look identical to "no photos
    // yet") must not be what's shown here.
    expect(getApp().querySelector('.empty-state')).toBeNull();
  });

  it('recovers on the next load once connectivity is restored', async () => {
    getCurrentFakeClient()._setNetworkDown(true);
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();
    expect(getApp().querySelector('.alert-error')).not.toBeNull();

    getCurrentFakeClient()._setNetworkDown(false);
    document.body.innerHTML = '<div id="app"></div>';
    await initApp();

    expect(getApp().querySelector('.alert-error')).toBeNull();
    expect(getApp().querySelector('.app-nav')).not.toBeNull();
  });
});
