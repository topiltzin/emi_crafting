import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDialog } from '../../src/ui/dialog.js';

function makeContentWithInput() {
  const wrapper = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  wrapper.appendChild(input);
  return { wrapper, input };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

describe('openDialog', () => {
  it('renders the backdrop, title, and content inside #app', () => {
    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose: vi.fn() });

    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(document.querySelector('.modal-title').textContent).toBe('Test Dialog');
    expect(document.querySelector('.modal-content').contains(wrapper)).toBe(true);
  });

  it('pressing Escape closes the dialog and calls onClose', () => {
    const onClose = vi.fn();
    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose });

    expect(document.querySelector('.modal-backdrop')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop itself closes the dialog and calls onClose', () => {
    const onClose = vi.fn();
    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose });

    document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the panel does not close the dialog', () => {
    const onClose = vi.fn();
    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose });

    document.querySelector('.modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking the close button closes the dialog and calls onClose', () => {
    const onClose = vi.fn();
    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose });

    document.querySelector('[data-action="dialog-close"]').click();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the first focusable element in the content on open', () => {
    const { wrapper, input } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose: vi.fn() });

    expect(document.activeElement).toBe(input);
  });

  it('falls back to focusing the close button when content has no focusable element', () => {
    const wrapper = document.createElement('div');
    wrapper.textContent = 'Just some text, nothing focusable.';
    openDialog({ title: 'Test Dialog', content: wrapper, onClose: vi.fn() });

    expect(document.activeElement).toBe(document.querySelector('[data-action="dialog-close"]'));
  });

  it('returns focus to the previously-focused element on close', () => {
    const trigger = document.createElement('button');
    document.getElementById('app').appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { wrapper } = makeContentWithInput();
    openDialog({ title: 'Test Dialog', content: wrapper, onClose: vi.fn() });
    expect(document.activeElement).not.toBe(trigger);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.activeElement).toBe(trigger);
  });

  it('renders an empty title when none is given', () => {
    const { wrapper } = makeContentWithInput();
    openDialog({ content: wrapper, onClose: vi.fn() });

    expect(document.querySelector('.modal-title').textContent).toBe('');
  });

  it('the returned close() handle removes the dialog without calling onClose again', () => {
    const onClose = vi.fn();
    const { wrapper } = makeContentWithInput();
    const { close } = openDialog({ title: 'Test Dialog', content: wrapper, onClose });

    close();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
