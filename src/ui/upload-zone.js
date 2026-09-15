import { showFileUploadDialog } from './file-upload.js';

export function renderUploadZone() {
  const wrapper = document.createElement('div');
  wrapper.className = 'upload-zone-wrapper';

  const zone = document.createElement('div');
  zone.className = 'upload-zone';
  // Not a role="button": it contains a real <button> below. Drag-and-drop itself is a
  // mouse/touch-only gesture; the "Choose Photos" button is the accessible, keyboard-operable
  // equivalent, so the container stays non-interactive to avoid nested focusable controls.

  const icon = document.createElement('div');
  icon.className = 'upload-zone-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📤';

  const text = document.createElement('p');
  text.className = 'upload-zone-text';
  text.textContent = 'Drop your photos here';

  const subtext = document.createElement('p');
  subtext.className = 'upload-zone-subtext';
  subtext.textContent = 'or choose photos from your device';

  const browseBtn = document.createElement('button');
  browseBtn.type = 'button';
  browseBtn.className = 'btn btn-secondary';
  browseBtn.setAttribute('data-action', 'browse');
  browseBtn.textContent = 'Choose Photos';

  zone.appendChild(icon);
  zone.appendChild(text);
  zone.appendChild(subtext);
  zone.appendChild(browseBtn);

  const pendingList = document.createElement('div');
  pendingList.className = 'upload-pending-list';
  pendingList.hidden = true;

  const rejectedNotice = document.createElement('p');
  rejectedNotice.className = 'upload-rejected-notice';
  rejectedNotice.setAttribute('role', 'alert');
  rejectedNotice.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'upload-zone-actions';
  actions.hidden = true;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.setAttribute('data-action', 'confirm-upload');
  confirmBtn.textContent = 'Add Photos';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.setAttribute('data-action', 'cancel-upload');
  cancelBtn.textContent = 'Cancel';

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);

  wrapper.appendChild(zone);
  wrapper.appendChild(pendingList);
  wrapper.appendChild(rejectedNotice);
  wrapper.appendChild(actions);

  return wrapper;
}

export function attachUploadZoneEvents(zoneElement, onConfirm) {
  const zone = zoneElement.querySelector('.upload-zone');
  const pendingList = zoneElement.querySelector('.upload-pending-list');
  const rejectedNotice = zoneElement.querySelector('.upload-rejected-notice');
  const actions = zoneElement.querySelector('.upload-zone-actions');
  const confirmBtn = zoneElement.querySelector('[data-action="confirm-upload"]');

  let pendingFiles = [];
  let pendingUrls = [];

  function renderRejectedNotice(names) {
    if (!names || names.length === 0) {
      rejectedNotice.hidden = true;
      rejectedNotice.textContent = '';
      return;
    }
    const list = names.join(', ');
    rejectedNotice.textContent =
      names.length === 1
        ? `"${list}" wasn't added — only photo files are supported.`
        : `${list} weren't added — only photo files are supported.`;
    rejectedNotice.hidden = false;
  }

  function renderPendingList() {
    pendingList.innerHTML = '';
    pendingList.hidden = pendingFiles.length === 0;
    actions.hidden = pendingFiles.length === 0;
    confirmBtn.disabled = pendingFiles.length === 0;

    pendingFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'upload-pending-item';

      const img = document.createElement('img');
      img.className = 'upload-pending-thumb';
      img.src = pendingUrls[index];
      img.alt = `Pending photo: ${file.name}`;
      item.appendChild(img);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'upload-pending-remove';
      removeBtn.setAttribute('data-action', 'remove-pending');
      removeBtn.setAttribute('data-index', String(index));
      removeBtn.setAttribute('aria-label', `Remove ${file.name} from upload`);
      removeBtn.innerHTML = '<span aria-hidden="true">✕</span>';
      item.appendChild(removeBtn);

      pendingList.appendChild(item);
    });
  }

  function addFiles(fileList) {
    const allFiles = Array.from(fileList);
    const accepted = allFiles.filter((file) => file.type.startsWith('image/'));
    const rejected = allFiles.filter((file) => !file.type.startsWith('image/'));

    accepted.forEach((file) => {
      pendingFiles.push(file);
      pendingUrls.push(URL.createObjectURL(file));
    });
    renderRejectedNotice(rejected.map((file) => file.name));
    renderPendingList();
  }

  function removeAt(index) {
    URL.revokeObjectURL(pendingUrls[index]);
    pendingFiles.splice(index, 1);
    pendingUrls.splice(index, 1);
    renderPendingList();
  }

  function clearPending() {
    pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    pendingFiles = [];
    pendingUrls = [];
    renderRejectedNotice([]);
    renderPendingList();
  }

  ['dragenter', 'dragover'].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((eventName) => {
    zone.addEventListener(eventName, () => {
      zone.classList.remove('is-dragover');
    });
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
    if (event.dataTransfer && event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  });

  zoneElement.addEventListener('click', async (event) => {
    if (event.target.closest('[data-action="browse"]')) {
      const files = await showFileUploadDialog();
      if (files.length > 0) addFiles(files);
      return;
    }

    const removeBtn = event.target.closest('[data-action="remove-pending"]');
    if (removeBtn) {
      removeAt(parseInt(removeBtn.getAttribute('data-index'), 10));
      return;
    }

    if (event.target.closest('[data-action="cancel-upload"]')) {
      clearPending();
      return;
    }

    if (event.target.closest('[data-action="confirm-upload"]') && pendingFiles.length > 0) {
      const filesToUpload = [...pendingFiles];
      clearPending();
      await onConfirm(filesToUpload);
    }
  });

  // Set the correct initial disabled/hidden state immediately — without this, the confirm
  // button and pending controls default to their enabled/visible markup state until the first
  // add/remove event fires.
  renderPendingList();
}
