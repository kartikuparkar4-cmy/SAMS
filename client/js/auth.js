(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    window.App.setMessage(message, '');
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      await window.App.request('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
      window.location.assign('/admin-dashboard.html');
    } catch (error) {
      window.App.setMessage(message, error.message);
      submit.disabled = false;
      submit.innerHTML = 'Sign in <span aria-hidden="true">↗</span>';
    }
  });
})();