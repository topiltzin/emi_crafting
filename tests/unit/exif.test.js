import { describe, it, expect } from 'vitest';
import { formatExifDate, getPhotoDate } from '../../src/modules/exif.js';

describe('EXIF Module', () => {
  describe('formatExifDate', () => {
    it('should convert EXIF date format to ISO 8601', () => {
      const exifDate = '2026:09:14 10:30:45';
      const result = formatExifDate(exifDate);
      expect(result).toBe('2026-09-14');
    });

    it('should handle dates without time', () => {
      const exifDate = '2026:09:14';
      const result = formatExifDate(exifDate);
      expect(result).toBe('2026-09-14');
    });

    it('should return null for invalid dates', () => {
      const exifDate = 'invalid';
      const result = formatExifDate(exifDate);
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = formatExifDate(null);
      expect(result).toBeNull();
    });

    it('should handle malformed EXIF dates gracefully', () => {
      const exifDate = '2026/09/14';
      const result = formatExifDate(exifDate);
      expect(result).toBeNull();
    });
  });

  describe('getPhotoDate', () => {
    it('should extract date from File object with fallback', async () => {
      // Create a mock File object
      const mockFile = new File(['test'], 'test.jpg', {
        type: 'image/jpeg',
        lastModified: new Date('2026-09-14').getTime()
      });

      const result = await getPhotoDate(mockFile);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
