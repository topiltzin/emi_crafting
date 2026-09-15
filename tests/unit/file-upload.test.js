import { describe, it, expect, vi, afterEach } from 'vitest';
import { showFileUploadDialog } from '../../src/ui/file-upload.js';

describe('showFileUploadDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with the selected files when the picker fires onchange', async () => {
    const fakeFiles = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      Object.defineProperty(this, 'files', { value: fakeFiles, configurable: true });
      this.onchange({ target: this });
    });

    const files = await showFileUploadDialog();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.jpg');
  });

  it('resolves with an empty array when there are no files', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      Object.defineProperty(this, 'files', { value: null, configurable: true });
      this.onchange({ target: this });
    });

    const files = await showFileUploadDialog();
    expect(files).toEqual([]);
  });

  it('resolves with an empty array when the dialog is cancelled', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      this.oncancel();
    });

    const files = await showFileUploadDialog();
    expect(files).toEqual([]);
  });
});
