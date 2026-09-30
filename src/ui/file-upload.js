export function showFileUploadDialog() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

    input.onchange = (event) => {
      const files = Array.from(event.target.files || []);
      resolve(files);
    };

    input.oncancel = () => {
      resolve([]);
    };

    input.click();
  });
}
