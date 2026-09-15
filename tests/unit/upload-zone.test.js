import { describe, it, expect, vi } from 'vitest';
import { renderUploadZone, attachUploadZoneEvents } from '../../src/ui/upload-zone.js';

function makeImageFile(name) {
  return new File(['fake-image-bytes'], name, { type: 'image/jpeg' });
}

describe('upload-zone pending file state', () => {
  it('adds a dropped file to the pending list with a thumbnail preview', () => {
    const zone = renderUploadZone();
    document.body.appendChild(zone);
    attachUploadZoneEvents(zone, vi.fn());

    const dropTarget = zone.querySelector('.upload-zone');
    const file = makeImageFile('a.jpg');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    dropTarget.dispatchEvent(dropEvent);

    expect(zone.querySelectorAll('.upload-pending-item')).toHaveLength(1);
    expect(zone.querySelector('.upload-pending-thumb').src).toMatch(/^blob:/);

    zone.remove();
  });

  it('removes a pending file by index and revokes its object URL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const zone = renderUploadZone();
    document.body.appendChild(zone);
    attachUploadZoneEvents(zone, vi.fn());

    const dropTarget = zone.querySelector('.upload-zone');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [makeImageFile('a.jpg'), makeImageFile('b.jpg')] };
    dropTarget.dispatchEvent(dropEvent);

    expect(zone.querySelectorAll('.upload-pending-item')).toHaveLength(2);

    const removeBtn = zone.querySelector('[data-action="remove-pending"][data-index="0"]');
    removeBtn.click();

    expect(zone.querySelectorAll('.upload-pending-item')).toHaveLength(1);
    expect(revokeSpy).toHaveBeenCalled();

    revokeSpy.mockRestore();
    zone.remove();
  });

  it('calls onConfirm with the remaining pending files and clears the list', async () => {
    const zone = renderUploadZone();
    document.body.appendChild(zone);
    const onConfirm = vi.fn().mockResolvedValue();
    attachUploadZoneEvents(zone, onConfirm);

    const dropTarget = zone.querySelector('.upload-zone');
    const file = makeImageFile('a.jpg');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [file] };
    dropTarget.dispatchEvent(dropEvent);

    const confirmBtn = zone.querySelector('[data-action="confirm-upload"]');
    confirmBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toHaveLength(1);
    expect(onConfirm.mock.calls[0][0][0].name).toBe('a.jpg');
    expect(zone.querySelectorAll('.upload-pending-item')).toHaveLength(0);

    zone.remove();
  });

  it('ignores non-image files dropped into the zone', () => {
    const zone = renderUploadZone();
    document.body.appendChild(zone);
    attachUploadZoneEvents(zone, vi.fn());

    const dropTarget = zone.querySelector('.upload-zone');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    dropEvent.dataTransfer = { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] };
    dropTarget.dispatchEvent(dropEvent);

    expect(zone.querySelectorAll('.upload-pending-item')).toHaveLength(0);

    zone.remove();
  });
});
