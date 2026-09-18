import { describe, it, expect, beforeEach } from 'vitest';
import { showCreateAlbumDialog, showRenameAlbumDialog } from '../../src/ui/create-album-dialog.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

function getInput() {
  return document.querySelector('.create-album-input');
}

describe('showCreateAlbumDialog', () => {
  it('has no date field — just a name', () => {
    showCreateAlbumDialog();
    expect(document.querySelector('.create-album-date-input')).toBeNull();
  });

  it('resolves the trimmed name when a valid name is submitted', async () => {
    const promise = showCreateAlbumDialog();

    getInput().value = '  Paper Crafts  ';
    document.querySelector('[data-action="create-album-confirm"]').click();

    await expect(promise).resolves.toBe('Paper Crafts');
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('shows an inline message and does not resolve when the name is blank', async () => {
    let resolvedWith = 'not-resolved-yet';
    const promise = showCreateAlbumDialog().then((value) => {
      resolvedWith = value;
      return value;
    });

    getInput().value = '';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await Promise.resolve();

    expect(document.querySelector('.create-album-error').hidden).toBe(false);
    expect(document.querySelector('.create-album-error').textContent).toBe('Please enter an album name.');
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(resolvedWith).toBe('not-resolved-yet');

    // Clean up: submit a valid name so the dangling promise resolves.
    getInput().value = 'Valid Name';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await promise;
  });

  it('shows an inline message and does not resolve when the name is whitespace-only', async () => {
    let resolvedWith = 'not-resolved-yet';
    const promise = showCreateAlbumDialog().then((value) => {
      resolvedWith = value;
      return value;
    });

    getInput().value = '   ';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await Promise.resolve();

    expect(document.querySelector('.create-album-error').hidden).toBe(false);
    expect(resolvedWith).toBe('not-resolved-yet');

    getInput().value = 'Valid Name';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await promise;
  });

  it('resolves null when Cancel is clicked', async () => {
    const promise = showCreateAlbumDialog();

    document.querySelector('[data-action="create-album-cancel"]').click();

    await expect(promise).resolves.toBeNull();
  });

  it('resolves null when the close button is clicked', async () => {
    const promise = showCreateAlbumDialog();

    document.querySelector('[data-action="dialog-close"]').click();

    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = showCreateAlbumDialog();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on a backdrop click', async () => {
    const promise = showCreateAlbumDialog();

    document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await expect(promise).resolves.toBeNull();
  });

  it('submits on Enter in the input field', async () => {
    const promise = showCreateAlbumDialog();

    getInput().value = 'Fabric Scraps';
    getInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await expect(promise).resolves.toBe('Fabric Scraps');
  });
});

describe('showRenameAlbumDialog', () => {
  it('pre-fills the input with the current title and labels the dialog/button for renaming', () => {
    showRenameAlbumDialog('Paper Crafts');

    expect(getInput().value).toBe('Paper Crafts');
    expect(document.querySelector('.modal-title').textContent).toBe('Rename Album');
    expect(document.querySelector('[data-action="create-album-confirm"]').textContent).toBe('Save');
  });

  it('resolves the trimmed new name when submitted', async () => {
    const promise = showRenameAlbumDialog('Old Name');

    getInput().value = '  New Name  ';
    document.querySelector('[data-action="create-album-confirm"]').click();

    await expect(promise).resolves.toBe('New Name');
  });

  it('shows an inline message and does not resolve when the new name is blank', async () => {
    let resolvedWith = 'not-resolved-yet';
    const promise = showRenameAlbumDialog('Old Name').then((value) => {
      resolvedWith = value;
      return value;
    });

    getInput().value = '';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await Promise.resolve();

    expect(document.querySelector('.create-album-error').hidden).toBe(false);
    expect(resolvedWith).toBe('not-resolved-yet');

    getInput().value = 'Valid Name';
    document.querySelector('[data-action="create-album-confirm"]').click();
    await promise;
  });

  it('resolves null when Cancel is clicked, leaving the name unchanged', async () => {
    const promise = showRenameAlbumDialog('Old Name');

    document.querySelector('[data-action="create-album-cancel"]').click();

    await expect(promise).resolves.toBeNull();
  });
});
