(function () {
  'use strict';

  const form = document.getElementById('booking-form');
  const providerSelect = document.getElementById('provider');
  const serviceSelect = document.getElementById('service');
  const dateInput = document.getElementById('appointment-date');
  const slotSelect = document.getElementById('time-slot');
  const message = document.getElementById('booking-message');
  const submitButton = document.getElementById('booking-submit');
  const providersById = new Map();

  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = localDate;

  function setFieldError(field, text) {
    const target = document.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = text || '';
  }

  function populateProviders(preferredProvider) {
    const category = serviceSelect.value;
    const available = [...providersById.values()].filter((provider) => !category || provider.serviceCategory === category);
    providerSelect.replaceChildren(new Option('Choose a doctor', ''));
    available.forEach((provider) => providerSelect.add(new Option(provider.name, provider.id)));
    if (preferredProvider && providersById.has(preferredProvider)) {
      const selected = providersById.get(preferredProvider);
      serviceSelect.value = selected.serviceCategory;
      populateProviders();
      providerSelect.value = preferredProvider;
    }
  }

  async function loadProviders() {
    try {
      const result = await window.App.request('/api/providers');
      const categories = [...new Set(result.providers.map((provider) => provider.serviceCategory))];
      serviceSelect.replaceChildren(new Option('Choose a treatment', ''));
      categories.forEach((category) => serviceSelect.add(new Option(category, category)));
      result.providers.forEach((provider) => providersById.set(provider.id, provider));
      populateProviders(new URLSearchParams(window.location.search).get('provider'));
      const requestedService = new URLSearchParams(window.location.search).get('service');
      if (requestedService && categories.includes(requestedService)) {
        serviceSelect.value = requestedService;
        populateProviders();
      }
      if (!result.providers.length) {
        window.App.setMessage(message, 'No providers are available right now. Please try again later.');
      }
    } catch (error) {
      providerSelect.disabled = true;
      serviceSelect.disabled = true;
      window.App.setMessage(message, `We couldn’t load providers. ${error.message}`);
    }
  }

  async function loadSlots() {
    slotSelect.disabled = true;
    slotSelect.replaceChildren(new Option('Loading available times…', ''));
    if (!providerSelect.value || !dateInput.value) {
      slotSelect.replaceChildren(new Option('Select a provider and date first', ''));
      return;
    }
    try {
      const result = await window.App.request(`/api/providers/${encodeURIComponent(providerSelect.value)}/availability?date=${encodeURIComponent(dateInput.value)}`);
      slotSelect.replaceChildren(new Option(result.availableSlots.length ? 'Choose an available time' : 'No times available', ''));
      result.availableSlots.forEach((slot) => slotSelect.add(new Option(slot, slot)));
      slotSelect.disabled = result.availableSlots.length === 0;
    } catch (error) {
      slotSelect.replaceChildren(new Option('Could not load availability', ''));
      window.App.setMessage(message, error.message);
    }
  }

  serviceSelect.addEventListener('change', () => {
    populateProviders();
    providerSelect.value = '';
    slotSelect.replaceChildren(new Option('Select a provider and date first', ''));
    slotSelect.disabled = true;
  });
  providerSelect.addEventListener('change', () => {
    const provider = providersById.get(providerSelect.value);
    if (provider) serviceSelect.value = provider.serviceCategory;
    setFieldError('providerId', '');
    loadSlots();
  });
  dateInput.addEventListener('change', () => {
    setFieldError('appointmentDate', '');
    loadSlots();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    window.App.setMessage(message, '');
    document.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(new FormData(form).entries());
    if (!/^\+?[0-9][0-9\s().-]{6,22}$/.test(values.contactNumber.trim())) {
      setFieldError('contactNumber', 'Enter a valid contact number.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending request…';
    try {
      const result = await window.App.request('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(values)
      });
      document.getElementById('confirmation-reference').textContent = result.appointment.referenceCode;
      form.hidden = true;
      document.getElementById('booking-confirmation').hidden = false;
    } catch (error) {
      if (Array.isArray(error.details)) {
        error.details.forEach((detail) => setFieldError(detail.field, detail.message));
      }
      window.App.setMessage(message, error.message);
      submitButton.disabled = false;
      submitButton.innerHTML = 'Request appointment <span aria-hidden="true">↗</span>';
    }
  });

  document.getElementById('copy-reference').addEventListener('click', async () => {
    const reference = document.getElementById('confirmation-reference').textContent;
    try {
      await navigator.clipboard.writeText(reference);
      window.App.notify('Booking reference copied.');
    } catch {
      window.App.notify(`Your booking reference is ${reference}`);
    }
  });

  loadProviders();
})();