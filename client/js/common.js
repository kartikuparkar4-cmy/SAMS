(function () {
  'use strict';

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options && options.headers),
        ...(options && options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('The server returned an unreadable response. Please try again.');
    }

    if (!response.ok) {
      const error = new Error(body.message || 'Something went wrong. Please try again.');
      error.status = response.status;
      error.details = body.errors || [];
      throw error;
    }

    return body;
  }

  function notify(message, isError) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = isError ? 'toast toast-error' : 'toast';
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4500);
  }

  function setMessage(element, message, isSuccess) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('success', Boolean(isSuccess));
  }

  function formatDate(value, options) {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, options || { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  function titleCase(value) {
    return String(value || '').replace(/\b\w/g, (character) => character.toUpperCase());
  }

  document.querySelectorAll('[data-current-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
      navigation.classList.toggle('is-open', !isOpen);
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        navigation.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Open navigation');
      }
    });
  }

  window.App = { request, notify, setMessage, formatDate, titleCase };
})();