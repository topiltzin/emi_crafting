// jsdom (the vitest "jsdom" environment) does not implement IndexedDB. The app's storage layer
// (src/modules/db.js) persists the sql.js database to IndexedDB, so tests need a working
// implementation. fake-indexeddb/auto installs one on the global scope before any test runs.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { resetDatabaseForTests } from '../src/modules/db.js';

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
  HTMLCanvasElement.prototype.toDataURL = (type = 'image/jpeg') =>
    `data:${type};base64,mock-thumbnail-data`;
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

// src/modules/db.js caches its sql.js Database as a module-level singleton (by design, so the
// real app only initializes sql.js once). Within a single test file, that means every test
// shares one growing database unless it's cleared between tests — otherwise tests that reuse
// the same fixture date (e.g. '2026-09-14') collide on Albums.album_date's UNIQUE constraint.
afterEach(async () => {
  await resetDatabaseForTests();
});
