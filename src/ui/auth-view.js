// Sign-in screen for the single owner account (spec FR-009: one personal account, no
// multi-user sign-up). Rendered in place of the app shell until a Supabase session exists.

export function renderAuthView({ onSignIn }) {
  const container = document.createElement('div');
  container.className = 'auth-view';

  const form = document.createElement('form');
  form.className = 'auth-card';
  form.noValidate = true;

  const heading = document.createElement('h1');
  heading.textContent = "Emi's Craft House";
  form.appendChild(heading);

  const subheading = document.createElement('p');
  subheading.className = 'auth-subheading';
  subheading.textContent = 'Sign in to view your photo albums.';
  form.appendChild(subheading);

  const emailLabel = document.createElement('label');
  emailLabel.className = 'auth-label';
  emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.required = true;
  emailInput.autocomplete = 'username';
  emailInput.className = 'auth-input';
  emailLabel.appendChild(emailInput);
  form.appendChild(emailLabel);

  const passwordLabel = document.createElement('label');
  passwordLabel.className = 'auth-label';
  passwordLabel.textContent = 'Password';
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.required = true;
  passwordInput.autocomplete = 'current-password';
  passwordInput.className = 'auth-input';
  passwordLabel.appendChild(passwordInput);
  form.appendChild(passwordLabel);

  const errorEl = document.createElement('p');
  errorEl.className = 'auth-error';
  errorEl.hidden = true;
  errorEl.setAttribute('role', 'alert');
  form.appendChild(errorEl);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary auth-submit';
  submitBtn.textContent = 'Sign In';
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      await onSignIn(emailInput.value.trim(), passwordInput.value);
    } catch (error) {
      errorEl.textContent = error.message || 'Sign in failed. Please try again.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  container.appendChild(form);
  return container;
}
