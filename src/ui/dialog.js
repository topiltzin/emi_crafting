const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function openDialog({ title, content, onClose, className } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = className ? `modal ${className}` : 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-label', title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close-btn';
  closeBtn.setAttribute('data-action', 'dialog-close');
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = title || '';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'modal-content';
  if (content) contentWrapper.appendChild(content);

  modal.appendChild(closeBtn);
  modal.appendChild(titleEl);
  modal.appendChild(contentWrapper);
  backdrop.appendChild(modal);

  const previouslyFocused = document.activeElement;

  function cleanup() {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  function dismiss() {
    cleanup();
    if (typeof onClose === 'function') onClose();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) dismiss();
  });

  closeBtn.addEventListener('click', dismiss);

  document.addEventListener('keydown', onKeydown);

  document.getElementById('app').appendChild(backdrop);

  const initialFocus = contentWrapper.querySelector(FOCUSABLE_SELECTOR);
  (initialFocus || closeBtn).focus();

  return { close: cleanup };
}
