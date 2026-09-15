import { openDialog } from './dialog.js';

export function showCreateAlbumDialog() {
  return new Promise((resolve) => {
    const content = document.createElement('div');

    const label = document.createElement('label');
    label.className = 'create-album-label';
    label.textContent = 'Album name';
    label.setAttribute('for', 'create-album-name-input');

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'create-album-name-input';
    input.className = 'create-album-input';
    input.placeholder = "e.g. 'Paper Crafts'";

    const errorEl = document.createElement('p');
    errorEl.className = 'create-album-error';
    errorEl.hidden = true;
    errorEl.setAttribute('role', 'alert');

    label.appendChild(input);
    content.appendChild(label);
    content.appendChild(errorEl);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('data-action', 'create-album-cancel');
    cancelBtn.textContent = 'Cancel';

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn btn-primary';
    createBtn.setAttribute('data-action', 'create-album-confirm');
    createBtn.textContent = 'Create';

    actions.appendChild(cancelBtn);
    actions.appendChild(createBtn);
    content.appendChild(actions);

    let resolved = false;

    const { close } = openDialog({
      title: 'Create Album',
      content,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }
    });

    function submit() {
      const trimmed = input.value.trim();
      if (!trimmed) {
        errorEl.textContent = 'Please enter an album name.';
        errorEl.hidden = false;
        input.focus();
        return;
      }
      resolved = true;
      close();
      resolve(trimmed);
    }

    createBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    cancelBtn.addEventListener('click', () => {
      resolved = true;
      close();
      resolve(null);
    });
  });
}
