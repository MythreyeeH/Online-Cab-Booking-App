const requests = document.getElementById('requests');
const activeTrip = document.getElementById('activeTrip');
const myTrips = document.getElementById('myTrips');
const driverReviews = document.getElementById('driverReviews');
const availabilityBtn = document.getElementById('availabilityBtn');

let online = true;
let currentDriver = null;

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

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

    currentDriver = result.user;

    document.querySelectorAll('[data-driver-name]').forEach(element => {
      element.textContent = result.user.name;
    });

    const avatar = document.getElementById('driverAvatar');
    if (avatar) {
      avatar.textContent = result.user.name
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
    }

    return true;
  } catch (error) {
    console.error('Unable to verify driver session:', error);
    requests.textContent = 'Could not verify your account. Check the server connection and refresh.';
    return false;
  }
}

function updateAvailabilityButton() {
  availabilityBtn.textContent = online ? 'Go Offline' : 'Go Online';
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (dot) {
    dot.className = online ? 'status-dot' : 'status-dot offline';
  }
  if (text) {
    text.textContent = online ? 'Online' : 'Offline';
  }
}

function renderActiveTrip(trip) {
  if (!activeTrip) return;

  if (!trip) {
    activeTrip.innerHTML = '<p class="empty-state">No active trip in progress.</p>';
    return;
  }

  activeTrip.innerHTML = `
    <article class="ride-card active-card">
      <div class="ride-top">
        <div>
          <h3>Trip #${safe(trip.trip_id)} · ${safe(trip.passenger_name)}</h3>
          <small class="trip-meta">Passenger contact: <strong>${safe(trip.passenger_mobile || '—')}</strong></small>
        </div>
        <span class="fare">${safe(formatFare(trip.fare))}</span>
      </div>
      <div class="route">
        <div class="route-point">
          <span></span>
          <strong>Pickup:</strong>&nbsp;${safe(trip.pickup_location)}
        </div>
        <div class="route-point destination">
          <span></span>
          <strong>Destination:</strong>&nbsp;${safe(trip.destination)}
        </div>
      </div>
      <div class="trip-meta">
        Started: ${formatDate(trip.start_time)} · Vehicle: ${safe(trip.vehicle_number)} (${safe(trip.vehicle_type)})
      </div>
      <div class="ride-actions">
        <button type="button" class="complete" data-complete="${safe(trip.trip_id)}">Complete Trip</button>
      </div>
    </article>
  `;
}

function renderRequests(rides) {
  requests.innerHTML = '';

  if (!rides.length) {
    requests.innerHTML = '<p class="empty-state">No incoming ride requests at this moment.</p>';
    return;
  }

  rides.forEach(ride => {
    const card = document.createElement('article');
    card.className = 'ride-card';
    card.innerHTML = `
      <div class="ride-top">
        <div>
          <h3>Ride Request #${safe(ride.request_id)}</h3>
          <small class="trip-meta">Passenger: <strong>${safe(ride.passenger_name)}</strong> · ${safe(ride.passenger_mobile || '')}</small>
        </div>
        <span class="fare">${safe(formatFare(ride.fare))}</span>
      </div>
      <div class="route">
        <div class="route-point">
          <span></span>
          <strong>Pickup:</strong>&nbsp;${safe(ride.pickup_location)}
        </div>
        <div class="route-point destination">
          <span></span>
          <strong>Destination:</strong>&nbsp;${safe(ride.destination)}
        </div>
      </div>
      <div class="trip-meta">
        Vehicle: ${safe(ride.vehicle_number)} (${safe(ride.vehicle_type)})
        ${ride.scheduled_for ? `· Scheduled for: ${formatDate(ride.scheduled_for)}` : ''}
      </div>
      <div class="ride-actions">
        <button type="button" class="accept" data-accept="${safe(ride.trip_id)}">Accept & Start Trip</button>
        <button type="button" class="reject" data-reject="${safe(ride.trip_id)}">Decline</button>
      </div>
    `;
    requests.appendChild(card);
  });
}

function renderTrips(trips) {
  myTrips.innerHTML = '';

  if (!trips.length) {
    myTrips.innerHTML = '<p class="empty-state">No trip history records yet.</p>';
    return;
  }

  trips.forEach(trip => {
    const card = document.createElement('article');
    card.className = 'ride-card';
    const isCompleted = trip.status === 'COMPLETED';

    card.innerHTML = `
      <div class="ride-top">
        <div>
          <h3>Trip #${safe(trip.trip_id)} · ${safe(trip.passenger_name)}</h3>
          <small class="trip-meta">${formatDate(trip.end_time || trip.start_time || trip.requested_at)}</small>
        </div>
        <div>
          <span class="fare">${safe(formatFare(trip.fare))}</span>
          <span class="tag" style="margin-left: 8px;">${safe(String(trip.status).replaceAll('_', ' '))}</span>
        </div>
      </div>
      <div class="route">
        <div class="route-point">
          <span></span>
          <strong>Pickup:</strong>&nbsp;${safe(trip.pickup_location)}
        </div>
        <div class="route-point destination">
          <span></span>
          <strong>Destination:</strong>&nbsp;${safe(trip.destination)}
        </div>
      </div>
      <div class="trip-meta">
        ${isCompleted ? '<span class="completed-label">✓ Completed</span> · ' : ''}
        Vehicle: ${safe(trip.vehicle_number)} · Distance: ${trip.distance_km ? `${trip.distance_km} km` : '—'}
      </div>
    `;
    myTrips.appendChild(card);
  });
}

function renderReviews(reviews) {
  if (!driverReviews) return;

  const badge = document.getElementById('reviewCountBadge');
  if (badge) badge.textContent = `${reviews.length} review${reviews.length === 1 ? '' : 's'}`;

  if (!reviews.length) {
    driverReviews.innerHTML = '<p class="empty-state">No reviews or ratings received yet.</p>';
    return;
  }

  driverReviews.innerHTML = reviews.map(r => `
    <article class="review-card">
      <div class="review-header">
        <div>
          <strong>${safe(r.passenger_name || 'Passenger')}</strong>
          <small style="color: #64748b; margin-left: 8px;">${formatDate(r.created_at)}</small>
        </div>
        <span class="review-stars">${'★'.repeat(Math.round(r.rating || 5))} <small>(${r.rating}/5)</small></span>
      </div>
      <p class="review-comment">"${safe(r.comment || 'Good ride')}"</p>
    </article>
  `).join('');
}

async function refreshDriverView() {
  const [dashboard, incoming, trips, reviews] = await Promise.all([
    api('/api/driver/dashboard'),
    api('/api/driver/requests'),
    api('/api/driver/trips'),
    api('/api/driver/reviews').catch(() => [])
  ]);

  online = Boolean(dashboard.online);
  updateAvailabilityButton();

  document.getElementById('tripCount').textContent = dashboard.todays_trips || 0;
  document.getElementById('earnings').textContent = formatFare(dashboard.todays_earnings);

  const pendingCount = (incoming || []).length;
  const reqLabel = document.getElementById('requestLabel');
  if (reqLabel) reqLabel.textContent = `${pendingCount} request${pendingCount === 1 ? '' : 's'}`;
  const reqCount = document.getElementById('requestCount');
  if (reqCount) reqCount.textContent = pendingCount;

  // Driver details bar
  if (dashboard.vehicle) {
    const v = dashboard.vehicle;
    document.getElementById('vehicleSummary').textContent = `${v.vehicle_number} (${v.vehicle_type} ${v.model})`;
    // Prefill vehicle form
    document.getElementById('vehNumber').value = v.vehicle_number || '';
    document.getElementById('vehType').value = v.vehicle_type || 'Sedan';
    document.getElementById('vehModel').value = v.model || '';
    document.getElementById('vehCapacity').value = v.capacity || 4;
  } else {
    document.getElementById('vehicleSummary').textContent = 'No vehicle linked';
  }

  if (dashboard.rating) {
    document.getElementById('ratingSummary').textContent = `★ ${dashboard.rating}`;
  }

  if (dashboard.verification_status) {
    const badge = document.getElementById('verificationBadge');
    badge.textContent = dashboard.verification_status;
    badge.className = dashboard.verification_status === 'APPROVED' ? 'tag tag-blue' : 'tag';
  }

  // Active Trip & Past Trips separation
  const active = (trips || []).find(t => t.status === 'IN_PROGRESS');
  const past = (trips || []).filter(t => t.status !== 'IN_PROGRESS');

  renderActiveTrip(active);
  renderRequests(incoming || []);
  renderTrips(past);
  renderReviews(reviews || []);
}

// Request actions (Accept / Reject)
requests.addEventListener('click', async event => {
  const acceptId = event.target.closest('[data-accept]')?.dataset.accept;
  const rejectId = event.target.closest('[data-reject]')?.dataset.reject;

  try {
    if (acceptId) {
      await api(`/api/driver/trips/${acceptId}/accept`, { method: 'PUT' });
      await refreshDriverView();
    }

    if (rejectId) {
      if (!confirm('Decline this ride request?')) return;
      await api(`/api/driver/trips/${rejectId}/reject`, { method: 'PUT' });
      await refreshDriverView();
    }
  } catch (error) {
    window.alert(error.message);
  }
});

// Active trip completion
if (activeTrip) {
  activeTrip.addEventListener('click', async event => {
    const completeId = event.target.closest('[data-complete]')?.dataset.complete;
    if (!completeId) return;

    if (!confirm('Complete this trip and record payment?')) return;

    try {
      await api(`/api/driver/trips/${completeId}/complete`, { method: 'PUT' });
      await refreshDriverView();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

// Availability toggle
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

// Vehicle form toggle and submit
const vehicleSection = document.getElementById('vehicleSection');
const toggleVehicleBtn = document.getElementById('toggleVehicleFormBtn');
const closeVehicleBtn = document.getElementById('closeVehicleBtn');
const vehicleForm = document.getElementById('vehicleForm');
const vehicleMsg = document.getElementById('vehicleMsg');

if (toggleVehicleBtn && vehicleSection) {
  toggleVehicleBtn.addEventListener('click', () => {
    vehicleSection.style.display = vehicleSection.style.display === 'none' ? 'block' : 'none';
  });
}

if (closeVehicleBtn && vehicleSection) {
  closeVehicleBtn.addEventListener('click', () => {
    vehicleSection.style.display = 'none';
  });
}

if (vehicleForm) {
  vehicleForm.addEventListener('submit', async event => {
    event.preventDefault();
    vehicleMsg.textContent = 'Saving...';
    vehicleMsg.style.color = '#475569';

    try {
      const data = {
        vehicle_number: document.getElementById('vehNumber').value.trim(),
        vehicle_type: document.getElementById('vehType').value,
        model: document.getElementById('vehModel').value.trim(),
        capacity: Number(document.getElementById('vehCapacity').value)
      };

      const res = await api('/api/driver/vehicle', {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      vehicleMsg.textContent = res.message || 'Saved successfully';
      vehicleMsg.style.color = '#15803d';
      await refreshDriverView();
      setTimeout(() => {
        if (vehicleSection) vehicleSection.style.display = 'none';
        vehicleMsg.textContent = '';
      }, 1500);
    } catch (error) {
      vehicleMsg.textContent = error.message;
      vehicleMsg.style.color = '#dc2626';
    }
  });
}

// Sign out
document.getElementById('signOutBtn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    location.replace('/auth.html');
  } catch (error) {
    console.error('Unable to sign out:', error);
  }
});

// Initialization
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
