import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getAllPhotos } from '../../src/modules/db.js';
import { uploadPhotos } from '../../src/modules/photo.js';
import { renderUploadZone, attachUploadZoneEvents } from '../../src/ui/upload-zone.js';

describe('Upload zone integration', () => {
  beforeEach(async () => {
    await initDB();
  });

  it('shows drag-active state while dragging over the zone', () => {
    const wrapper = renderUploadZone();
    document.body.appendChild(wrapper);
    attachUploadZoneEvents(wrapper, async () => {});

    const dropTarget = wrapper.querySelector('.upload-zone');
    dropTarget.dispatchEvent(new Event('dragenter', { bubbles: true, cancelable: true }));
    expect(dropTarget.classList.contains('is-dragover')).toBe(true);

    dropTarget.dispatchEvent(new Event('dragleave', { bubbles: true, cancelable: true }));
    expect(dropTarget.classList.contains('is-dragover')).toBe(false);

    wrapper.remove();
  });

  it('confirms the pending files through the real uploadPhotos pipeline and they appear correctly dated', async () => {
    const wrapper = renderUploadZone();
    document.body.appendChild(wrapper);

    let uploadResult;
    attachUploadZoneEvents(wrapper, async (files) => {
      uploadResult = await uploadPhotos(files);
    });

    const dropTarget = wrapper.querySelector('.upload-zone');
    const file = new File(['fake'], 'craft.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-09-14').getTime()
    });
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    dropTarget.dispatchEvent(dropEvent);

    const confirmBtn = wrapper.querySelector('[data-action="confirm-upload"]');
    confirmBtn.click();

    const deadline = Date.now() + 2000;
    while (!uploadResult && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(uploadResult.uploaded).toHaveLength(1);

    const photos = await getAllPhotos();
    expect(photos).toHaveLength(1);
    expect(photos[0].filename).toBe('craft.jpg');
    expect(photos[0].photo_date).toBe('2026-09-14');

    wrapper.remove();
  });
});
