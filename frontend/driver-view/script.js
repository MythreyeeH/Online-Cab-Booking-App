const requests = document.getElementById('requests');
const myTrips = document.getElementById('myTrips');
const availabilityBtn = document.getElementById('availabilityBtn');

let online = true;

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatFare(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

async function requireDriverSession() {
  try {
    const result = await api('/api/auth/session');

    if (!result.authenticated || result.role !== 'DRIVER') {
      location.replace(result.authenticated
        ? result.role === 'ADMIN' || result.role === 'SUPER ADMIN'
          ? '/admin/admin-dashboard.html'
          : '/passenger/passenger-dashboard.html'
        : '/auth.html?role=DRIVER');
      return false;
    }

    document.querySelectorAll('[data-driver-name]').forEach(element => {
      element.textContent = result.user.name;
    });
    return true;
  } catch (error) {
    console.error('Unable to verify driver session:', error);
    requests.textContent = 'Could not verify your account. Check the server connection and refresh.';
    return false;
  }
}

function updateAvailabilityButton() {
  availabilityBtn.textContent = online ? 'Go Offline' : 'Go Online';
}

function renderRequests(rides) {
  requests.innerHTML = '';

  if (!rides.length) {
    requests.textContent = 'No new ride requests.';
    return;
  }

  rides.forEach(ride => {
    const card = document.createElement('article');
    card.className = 'ride-card';
    card.innerHTML = `
      <div>
        <p><strong>Passenger:</strong> ${safe(ride.passenger_name)}</p>
        <p><strong>Pickup:</strong> ${safe(ride.pickup_location)}</p>
        <p><strong>Destination:</strong> ${safe(ride.destination)}</p>
        <p><strong>Fare:</strong> ${safe(formatFare(ride.fare))}</p>
        <p><strong>Vehicle:</strong> ${safe(ride.vehicle_number)} · ${safe(ride.vehicle_type)}</p>
      </div>
      <div class="ride-actions">
        <button type="button" data-accept="${safe(ride.trip_id)}">Start Trip</button>
        <button type="button" class="reject" data-reject="${safe(ride.trip_id)}">Decline</button>
      </div>
    `;
    requests.appendChild(card);
  });
}

function renderTrips(trips) {
  myTrips.innerHTML = '';

  if (!trips.length) {
    myTrips.innerHTML = '<p>No trips yet.</p>';
    return;
  }

  trips.forEach(trip => {
    const card = document.createElement('article');
    card.className = 'ride-card';

    const actions = trip.status === 'IN_PROGRESS'
      ? `<div class="ride-actions"><button type="button" data-complete="${safe(trip.trip_id)}">Complete Trip</button></div>`
      : '';

    card.innerHTML = `
      <div>
        <p><strong>${safe(trip.pickup_location)}</strong> → ${safe(trip.destination)}</p>
        <p>Passenger: ${safe(trip.passenger_name)}</p>
        <p>Status: ${safe(String(trip.status).replaceAll('_', ' '))}</p>
        <p>Fare: ${safe(formatFare(trip.fare))}</p>
      </div>
      ${actions}
    `;
    myTrips.appendChild(card);
  });
}

async function refreshDriverView() {
  const [dashboard, incoming, trips] = await Promise.all([
    api('/api/driver/dashboard'),
    api('/api/driver/requests'),
    api('/api/driver/trips')
  ]);

  online = Boolean(dashboard.online);
  updateAvailabilityButton();
  document.getElementById('tripCount').textContent = dashboard.todays_trips;
  document.getElementById('earnings').textContent = formatFare(dashboard.todays_earnings);
  renderRequests(incoming);
  renderTrips(trips);
}

requests.addEventListener('click', async event => {
  const acceptId = event.target.closest('[data-accept]')?.dataset.accept;
  const rejectId = event.target.closest('[data-reject]')?.dataset.reject;

  try {
    if (acceptId) {
      await api(`/api/driver/trips/${acceptId}/accept`, { method: 'PUT' });
      await refreshDriverView();
    }

    if (rejectId) {
      await api(`/api/driver/trips/${rejectId}/reject`, { method: 'PUT' });
      await refreshDriverView();
    }
  } catch (error) {
    window.alert(error.message);
  }
});

myTrips.addEventListener('click', async event => {
  const completeId = event.target.closest('[data-complete]')?.dataset.complete;
  if (!completeId) return;

  try {
    await api(`/api/driver/trips/${completeId}/complete`, { method: 'PUT' });
    await refreshDriverView();
  } catch (error) {
    window.alert(error.message);
  }
});

availabilityBtn.addEventListener('click', async () => {
  try {
    const result = await api('/api/driver/availability', {
      method: 'PUT',
      body: JSON.stringify({ online: !online })
    });
    online = Boolean(result.online);
    updateAvailabilityButton();
  } catch (error) {
    window.alert(error.message);
  }
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    location.replace('/auth.html');
  } catch (error) {
    console.error('Unable to sign out:', error);
  }
});

requireDriverSession().then(async authenticated => {
  if (!authenticated) return;

  try {
    await refreshDriverView();
    setInterval(() => {
      refreshDriverView().catch(error => console.error(error));
    }, 15000);
  } catch (error) {
    requests.textContent = error.message;
  }
});
