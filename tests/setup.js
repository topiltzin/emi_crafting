// jsdom (the vitest "jsdom" environment) does not implement IndexedDB. src/modules/migration.js
// (Phase 4) reads pre-existing local data via IndexedDB; fake-indexeddb/auto installs a working
// implementation on the global scope before any test runs.
import 'fake-indexeddb/auto';

import { vi, beforeEach } from 'vitest';
import { resetFakeClient, getCurrentFakeClient } from './helpers/fake-supabase-mock.js';
import { resetMigrationLedgerForTests } from '../src/modules/migration-ledger.js';

// Every test in the suite talks to src/modules/db.js, which talks to Supabase via
// src/modules/supabase-client.js. Mocking that one module here — instead of in every test
// file — means individual test files don't need their own vi.mock boilerplate; a test that
// needs to inspect or customize the fake backend (e.g. simulate a network failure) can still
// pull the live instance via getCurrentFakeClient() from tests/helpers/fake-supabase-mock.js.
vi.mock('../src/modules/supabase-client.js', () => ({
  getSupabaseClient: () => getCurrentFakeClient(),
  getOwnerId: () => getCurrentFakeClient()._ownerId,
  getSession: async () => {
    const { data } = await getCurrentFakeClient().auth.getSession();
    return data.session;
  },
  signInOwner: async (email, password) => {
    const { data, error } = await getCurrentFakeClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  resetSupabaseClientForTests: () => {}
}));

beforeEach(() => {
  resetFakeClient({ ownerId: 'owner-1' });
  // app.js records routes in the URL hash; a route left over from a previous test would
  // otherwise be restored by the next initApp().
  if (typeof history !== 'undefined') history.replaceState(null, '', '/');
  resetMigrationLedgerForTests();
});

// jsdom has no real image codec or <canvas> 2D context (the optional native "canvas" package
// isn't installed). src/modules/storage.js's generateThumbnail() relies on both to decode an
// uploaded image and draw a thumbnail; without these shims its `new Image().onload` never
// fires and any test exercising the upload pipeline (modules/photo.js::uploadPhotos) hangs
// until the test timeout. These shims simulate "a 200x200 image was decoded" and "drawImage
// succeeded" so the promise resolves, without touching any application code.
class MockImage extends EventTarget {
  set src(_value) {
    this.width = 200;
    this.height = 200;
    queueMicrotask(() => {
      if (typeof this.onload === 'function') this.onload();
    });
  }
}
globalThis.Image = MockImage;

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => ({
    drawImage: () => {}
  });
  // Must be valid base64 — src/modules/db.js now decodes this to upload it as Storage bytes,
  // unlike the old sql.js-backed db.js which just stored the raw string in a TEXT column.
  HTMLCanvasElement.prototype.toDataURL = (type = 'image/jpeg') =>
    `data:${type};base64,${btoa('mock-thumbnail-data')}`;
  // The upload pipeline (storage.js createThumbnailBlob/prepareOriginal) encodes via toBlob,
  // which jsdom never calls back without the native "canvas" package.
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type = 'image/png') {
    queueMicrotask(() => callback(new Blob(['mock-image-data'], { type })));
  };
}

// jsdom does not implement URL.createObjectURL/revokeObjectURL (used by src/ui/upload-zone.js
// for pending-photo thumbnail previews). Stub them with a predictable fake blob: URL.
let mockObjectUrlCounter = 0;
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:mock-${(mockObjectUrlCounter += 1)}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

// This project's jsdom/Vitest combination does not expose window.localStorage even with a
// proper http(s) origin configured (vite.config.js's test.environmentOptions.jsdom.url). Stub a
// minimal in-memory Storage implementation so src/modules/theme.js's appearance-preference
// storage (and any future localStorage use) works under test the same way it does in a browser.
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  class MemoryStorage {
    #store = new Map();
    getItem(key) {
      return this.#store.has(key) ? this.#store.get(key) : null;
    }
    setItem(key, value) {
      this.#store.set(key, String(value));
    }
    removeItem(key) {
      this.#store.delete(key);
    }
    clear() {
      this.#store.clear();
    }
    get length() {
      return this.#store.size;
    }
    key(index) {
      return Array.from(this.#store.keys())[index] ?? null;
    }
  }
  const memoryStorage = new MemoryStorage();
  globalThis.localStorage = memoryStorage;
  if (typeof window !== 'undefined') window.localStorage = memoryStorage;
}

