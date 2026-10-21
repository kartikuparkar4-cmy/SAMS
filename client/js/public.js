(function () {
  'use strict';

  const serviceList = document.getElementById('service-list');
  const providerList = document.getElementById('provider-list');
  const statusForm = document.getElementById('status-form');
  const statusMessage = document.getElementById('status-message');
  const statusResult = document.getElementById('status-result'); 

  function initials(name) {
    return String(name).split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  }

  function renderProviders(providers) {
    providerList.replaceChildren();
    if (!providers.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Provider availability will be updated soon.';
      providerList.append(empty);
      return;
    }

    providers.slice(0, 6).forEach((provider) => {
      const card = document.createElement('a');
      card.className = 'provider-card';
      card.href = `/book.html?provider=${encodeURIComponent(provider.id)}`;
      const avatar = document.createElement('span');
      avatar.className = 'provider-avatar';
      avatar.textContent = initials(provider.name);
      const info = document.createElement('span');
      info.className = 'provider-info';
      const name = document.createElement('h3');
      name.textContent = provider.name;
      const category = document.createElement('p');
      category.textContent = provider.serviceCategory;
      const availability = document.createElement('span');
      availability.className = 'provider-availability';
      const dot = document.createElement('span');
      dot.className = 'status-dot';
      const schedule = provider.schedule && provider.schedule.slots;
      availability.append(dot, document.createTextNode(schedule && schedule.length ? `${schedule.length} appointment times` : 'Availability varies'));
      info.append(name, category, availability);
      const arrow = document.createElement('span');
      arrow.className = 'provider-book';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      card.append(avatar, info, arrow);
      providerList.append(card);
    });
  }

  function renderServices(providers) {
    serviceList.replaceChildren();
    const categories = [...new Set(providers.map((provider) => provider.serviceCategory))];
    if (!categories.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Care services will be listed here.';
      serviceList.append(empty);
      return;
    }
    categories.slice(0, 6).forEach((category, index) => {
      const chip = document.createElement('a');
      chip.className = 'service-chip';
      chip.href = `/book.html?service=${encodeURIComponent(category)}`;
      const mark = document.createElement('span');
      mark.className = 'service-chip-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = ['+', '⌁', '◌', '⌖', '◇', '↗'][index % 6];
      const text = document.createElement('span');
      text.textContent = category;
      chip.append(mark, text);
      serviceList.append(chip);
    });
  }

  function renderStatus(appointment) {
    statusResult.replaceChildren();
    const info = document.createElement('div');
    const status = document.createElement('strong');
    status.textContent = `${appointment.status} appointment`;
    const detail = document.createElement('span');
    detail.textContent = `${appointment.serviceName} · ${window.App.formatDate(appointment.appointmentDate)} at ${appointment.timeSlot}`;
    info.append(status, detail);
    const badge = document.createElement('span');
    badge.className = `status-badge status-${appointment.status.toLowerCase()}`;
    badge.textContent = appointment.status;
    statusResult.append(info, badge);
    statusResult.hidden = false;
  }

  async function loadProviders() {
    try {
      const result = await window.App.request('/api/providers');
      renderProviders(result.providers);
      renderServices(result.providers);
    } catch {
      const message = document.createElement('p');
      message.className = 'muted';
      message.textContent = 'We couldn’t load provider details. Please refresh to try again.';
      providerList.replaceChildren(message);
      serviceList.replaceChildren();
    }
  }

  if (statusForm) {
    statusForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const reference = new FormData(statusForm).get('reference').trim();
      const submit = statusForm.querySelector('button[type="submit"]');
      statusResult.hidden = true;
      window.App.setMessage(statusMessage, 'Checking your booking…');
      submit.disabled = true;
      try {
        const result = await window.App.request(`/api/appointments/status/${encodeURIComponent(reference)}`);
        renderStatus(result.appointment);
        window.App.setMessage(statusMessage, 'Booking found.', true);
      } catch (error) {
        window.App.setMessage(statusMessage, error.status === 404 ? 'We couldn’t find that reference. Please check it and try again.' : error.message);
      } finally {
        submit.disabled = false;
      }
    });
  }

  loadProviders();
})();