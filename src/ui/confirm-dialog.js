import { openDialog } from './dialog.js';

export function showConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true
}) {
  return new Promise((resolve) => {
    const content = document.createElement('div');

    const messageEl = document.createElement('p');
    messageEl.className = 'confirm-dialog-message';
    messageEl.textContent = message;
    content.appendChild(messageEl);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.setAttribute('data-action', 'confirm-dialog-confirm');
    confirmBtn.textContent = confirmLabel;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('data-action', 'confirm-dialog-cancel');
    cancelBtn.textContent = cancelLabel;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    content.appendChild(actions);

    let resolved = false;

    const { close } = openDialog({
      title,
      content,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });

    confirmBtn.addEventListener('click', () => {
      resolved = true;
      close();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => {
      resolved = true;
      close();
      resolve(false);
    });
  });
}
