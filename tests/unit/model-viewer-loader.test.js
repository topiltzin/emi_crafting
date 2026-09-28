import { describe, it, expect, vi, afterEach } from 'vitest';

const importCount = vi.hoisted(() => ({ n: 0 }));
vi.mock('@google/model-viewer', () => {
  importCount.n += 1;
  return { ModelViewerElement: class {} };
});

import { isWebGLAvailable, loadModelViewer } from '../../src/modules/model-viewer-loader.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isWebGLAvailable', () => {
  it('is true when a WebGL2 or WebGL context can be created', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) =>
      type === 'webgl' ? {} : null
    );
    expect(isWebGLAvailable()).toBe(true);
  });

  it('is false when no context is available or creation throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isWebGLAvailable()).toBe(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isWebGLAvailable()).toBe(false);
  });
});

describe('loadModelViewer', () => {
  it('imports the component once and reuses the same promise', async () => {
    const first = loadModelViewer();
    const second = loadModelViewer();
    expect(first).toBe(second);
    const mod = await first;
    expect(mod.ModelViewerElement).toBeDefined();
    expect(importCount.n).toBe(1);
  });
});
