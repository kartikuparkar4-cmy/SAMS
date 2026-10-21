(function () {
  'use strict';

  const body = document.getElementById('appointments-body');
  const filters = document.getElementById('filter-form');
  const searchInput = document.getElementById('search');
  const previousButton = document.getElementById('previous-page');
  const nextButton = document.getElementById('next-page');
  const statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
  let currentPage = 1;
  let totalPages = 1;
  let debounceTimer;

  const today = new Date();
  document.getElementById('today-date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(today);

  function requireLogin(error) {
    if (error.status === 401 || error.status === 403) {
      window.location.replace('/admin-login.html');
      return true;
    }
    return false;
  }

  function addCell(row, className, text) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    row.append(cell);
    return cell;
  }

  function createInfoCell(row, className, primary, secondary) {
    const cell = document.createElement('td');
    const wrapper = document.createElement('span');
    wrapper.className = className;
    const strong = document.createElement('strong');
    strong.textContent = primary;
    const small = document.createElement('small');
    small.textContent = secondary;
    wrapper.append(strong, small);
    cell.append(wrapper);
    row.append(cell);
    return cell;
  }

  function renderAppointments(appointments) {
    body.replaceChildren();
    if (!appointments.length) {
      const row = document.createElement('tr');
      const cell = addCell(row, 'table-empty', 'No appointments match these filters.');
      cell.colSpan = 6;
      body.append(row);
      return;
    }

    appointments.forEach((appointment) => {
      const row = document.createElement('tr');
      createInfoCell(row, 'patient-cell', appointment.customerName, appointment.contactNumber);
      createInfoCell(row, 'provider-cell', appointment.providerName, appointment.serviceName);
      createInfoCell(row, 'date-cell', window.App.formatDate(appointment.appointmentDate), appointment.timeSlot);
      addCell(row, 'reference-cell', appointment.referenceCode);

      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${appointment.status.toLowerCase()}`;
      badge.textContent = appointment.status;
      statusCell.append(badge);
      row.append(statusCell);

      const actionCell = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'row-action';
      select.setAttribute('aria-label', `Update status for ${appointment.customerName}`);
      select.dataset.appointmentId = appointment.id;
      select.add(new Option('Update status…', '', true, true));
      select.options[0].disabled = true;
      statuses.filter((status) => status !== appointment.status).forEach((status) => select.add(new Option(status, status)));
      actionCell.append(select);
      row.append(actionCell);
      body.append(row);
    });
  }

  async function loadProviders() {
    try {
      const result = await window.App.request('/api/providers');
      result.providers.forEach((provider) => document.getElementById('filter-provider').add(new Option(provider.name, provider.id)));
    } catch (error) {
      if (requireLogin(error)) return;
      window.App.notify(`Couldn’t load provider filters. ${error.message}`, true);
    }
  }

  async function loadSummary() {
    const result = await window.App.request('/api/dashboard/summary');
    const summary = result.summary;
    document.getElementById('count-total').textContent = String(summary.total);
    document.getElementById('count-pending').textContent = String(summary.pending);
    document.getElementById('count-confirmed').textContent = String(summary.confirmed);
    document.getElementById('count-completed').textContent = String(summary.completed);
    document.getElementById('count-cancelled').textContent = String(summary.cancelled);
  }

  async function loadAppointments() {
    const query = new URLSearchParams();
    const values = new FormData(filters);
    for (const [key, value] of values.entries()) {
      if (value) query.set(key, value);
    }
    query.set('page', String(currentPage));
    query.set('limit', '10');
    body.replaceChildren();
    const loadingRow = document.createElement('tr');
    const loadingCell = addCell(loadingRow, 'table-empty', 'Loading appointments…');
    loadingCell.colSpan = 6;
    body.append(loadingRow);
    try {
      const result = await window.App.request(`/api/appointments?${query.toString()}`);
      renderAppointments(result.appointments);
      totalPages = result.pages;
      document.getElementById('result-count').textContent = `${result.total} appointment${result.total === 1 ? '' : 's'} found`;
      document.getElementById('page-label').textContent = `Page ${result.page} of ${result.pages}`;
      previousButton.disabled = result.page <= 1;
      nextButton.disabled = result.page >= result.pages;
    } catch (error) {
      if (requireLogin(error)) return;
      const row = document.createElement('tr');
      const cell = addCell(row, 'table-empty', error.message);
      cell.colSpan = 6;
      body.replaceChildren(row);
      window.App.setMessage(document.getElementById('result-count'), 'Could not load appointments.');
    }
  }

  async function loadDashboard() {
    try {
      await Promise.all([loadSummary(), loadAppointments()]);
    } catch (error) {
      if (!requireLogin(error)) window.App.notify(`Couldn’t load the dashboard. ${error.message}`, true);
    }
  }

  filters.addEventListener('change', (event) => {
    if (event.target !== searchInput) {
      currentPage = 1;
      loadAppointments();
    }
  });
  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      currentPage = 1;
      loadAppointments();
    }, 280);
  });
  filters.addEventListener('reset', () => {
    window.setTimeout(() => {
      currentPage = 1;
      loadAppointments();
    }, 0);
  });
  previousButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadAppointments();
    }
  });
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadAppointments();
    }
  });
  document.getElementById('refresh-button').addEventListener('click', loadDashboard);

  body.addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-appointment-id]');
    if (!select || !select.value) return;
    const newStatus = select.value;
    const appointmentId = select.dataset.appointmentId;
    select.disabled = true;
    try {
      await window.App.request(`/api/appointments/${encodeURIComponent(appointmentId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      window.App.notify(`Appointment marked ${newStatus.toLowerCase()}.`);
      await loadDashboard();
    } catch (error) {
      if (!requireLogin(error)) window.App.notify(error.message, true);
      select.disabled = false;
      select.value = '';
    }
  });

  document.getElementById('logout-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await window.App.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Expired sessions are cleared by the destination page on the next request.
    }
    window.location.replace('/admin-login.html');
  });

  loadProviders();
  loadDashboard();
})();