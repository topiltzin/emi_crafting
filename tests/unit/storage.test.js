import { describe, it, expect } from 'vitest';
import {
  readFileAsBase64,
  generateThumbnail,
  getMimeType,
  validateFileSize
} from '../../src/modules/storage.js';

describe('storage helpers', () => {
  it('reads a file as a base64 data URL', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const result = await readFileAsBase64(file);
    expect(result).toMatch(/^data:/);
  });

  it('generates a square thumbnail data URL', async () => {
    const result = await generateThumbnail('data:image/jpeg;base64,fake', 150);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('accepts supported mime types', () => {
    expect(getMimeType(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe('image/jpeg');
    expect(getMimeType(new File(['x'], 'a.png', { type: 'image/png' }))).toBe('image/png');
  });

  it('rejects unsupported mime types', () => {
    expect(() => getMimeType(new File(['x'], 'a.gif', { type: 'image/gif' }))).toThrow(
      'Unsupported file type: image/gif'
    );
  });

  it('accepts files within the size limit', () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(validateFileSize(file, 1024)).toBe(file.size);
  });

  it('rejects files over the size limit', () => {
    const file = new File(['x'.repeat(2000)], 'a.jpg', { type: 'image/jpeg' });
    expect(() => validateFileSize(file, 1000)).toThrow(/File size exceeds/);
  });

});
