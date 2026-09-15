import { describe, it, expect, beforeEach } from 'vitest';
import { showConfirmDialog } from '../../src/ui/confirm-dialog.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

describe('showConfirmDialog', () => {
  it('resolves true when the confirm button is clicked', async () => {
    const promise = showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    document.querySelector('[data-action="confirm-dialog-confirm"]').click();

    await expect(promise).resolves.toBe(true);
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('resolves false when the cancel button is clicked', async () => {
    const promise = showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    document.querySelector('[data-action="confirm-dialog-cancel"]').click();

    await expect(promise).resolves.toBe(false);
  });

  it('resolves false when the close button is clicked', async () => {
    const promise = showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    document.querySelector('[data-action="dialog-close"]').click();

    await expect(promise).resolves.toBe(false);
  });

  it('resolves false on Escape', async () => {
    const promise = showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBe(false);
  });

  it('resolves false on a backdrop click', async () => {
    const promise = showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await expect(promise).resolves.toBe(false);
  });

  it('applies btn-danger to the confirm button by default', () => {
    showConfirmDialog({ title: 'Delete photo?', message: 'Are you sure?' });

    const confirmBtn = document.querySelector('[data-action="confirm-dialog-confirm"]');
    expect(confirmBtn.classList.contains('btn-danger')).toBe(true);
  });

  it('applies btn-primary instead of btn-danger when danger is false', () => {
    showConfirmDialog({ title: 'Confirm?', message: 'Are you sure?', danger: false });

    const confirmBtn = document.querySelector('[data-action="confirm-dialog-confirm"]');
    expect(confirmBtn.classList.contains('btn-primary')).toBe(true);
    expect(confirmBtn.classList.contains('btn-danger')).toBe(false);
  });

  it('renders the provided title and message', () => {
    showConfirmDialog({ title: 'Delete album?', message: '"Paper Crafts" and its 3 photo(s) will be removed.' });

    expect(document.querySelector('.modal-title').textContent).toBe('Delete album?');
    expect(document.querySelector('.confirm-dialog-message').textContent).toBe(
      '"Paper Crafts" and its 3 photo(s) will be removed.'
    );
  });
});
