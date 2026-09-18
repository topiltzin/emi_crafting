import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAuthView } from '../../src/ui/auth-view.js';

describe('renderAuthView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders email and password inputs and a submit button', () => {
    const view = renderAuthView({ onSignIn: vi.fn() });
    document.getElementById('app').appendChild(view);

    expect(view.querySelector('input[type="email"]')).not.toBeNull();
    expect(view.querySelector('input[type="password"]')).not.toBeNull();
    expect(view.querySelector('button[type="submit"]').textContent).toBe('Sign In');
  });

  it('carries the class names the sign-in styling targets (FR-009/FR-010)', () => {
    const view = renderAuthView({ onSignIn: vi.fn() });
    document.getElementById('app').appendChild(view);

    expect(view.classList.contains('auth-view')).toBe(true);
    expect(view.querySelector('.auth-card')).not.toBeNull();
    expect(view.querySelectorAll('.auth-label')).toHaveLength(2);
    expect(view.querySelectorAll('.auth-input')).toHaveLength(2);
    expect(view.querySelector('.auth-error')).not.toBeNull();
    expect(view.querySelector('.auth-submit')).not.toBeNull();
    expect(view.querySelector('.auth-submit').classList.contains('btn-primary')).toBe(true);
  });

  it('calls onSignIn with the trimmed email and the password on submit', async () => {
    const onSignIn = vi.fn().mockResolvedValue();
    const view = renderAuthView({ onSignIn });
    document.getElementById('app').appendChild(view);

    view.querySelector('input[type="email"]').value = '  owner@example.com  ';
    view.querySelector('input[type="password"]').value = 'secret123';
    view.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();
    await Promise.resolve();

    expect(onSignIn).toHaveBeenCalledWith('owner@example.com', 'secret123');
  });

  it('shows an error message and re-enables the button when onSignIn rejects', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error('Invalid login credentials'));
    const view = renderAuthView({ onSignIn });
    document.getElementById('app').appendChild(view);

    view.querySelector('input[type="email"]').value = 'owner@example.com';
    view.querySelector('input[type="password"]').value = 'wrong';
    view.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const error = view.querySelector('.auth-error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Invalid login credentials');
    expect(view.querySelector('button[type="submit"]').disabled).toBe(false);
  });

  it('does not surface a raw error while a sign-in attempt is pending', async () => {
    let resolveSignIn;
    const onSignIn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
    );
    const view = renderAuthView({ onSignIn });
    document.getElementById('app').appendChild(view);

    view.querySelector('input[type="email"]').value = 'owner@example.com';
    view.querySelector('input[type="password"]').value = 'secret123';
    view.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(view.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(view.querySelector('.auth-error').hidden).toBe(true);

    resolveSignIn();
  });
});
