const API = '/api/admin';
const features = [
  ['dashboard','▦','Dashboard',null],
  ['passengers','♙','Manage passengers','Manage Passengers'],
  ['drivers','♧','Manage drivers','Manage Drivers'],
  ['approvals','✓','Driver approvals','Approve / Reject Drivers'],
  ['vehicles','▰','Manage vehicles','Manage Vehicles'],
  ['areas','⌖','Service areas','Manage Service Areas'],
  ['fares','₹','Fare rules','Manage Fare Rules'],
  ['trips','⇄','Trips & bookings','Monitor Trips & Bookings'],
  ['issues','⚑','Booking issues','Resolve Booking Issues'],
  ['reports','▤','Reports & revenue','View Reports'],
  ['activity','◷','System activity','Monitor System Activity']
];
let allBookings = [];
let rideMap;
const nav = document.getElementById('adminNav');

function renderNavigation() {
  nav.innerHTML = features.map(([id, icon, label, page]) => `
    <button type="button" class="nav-button ${id === 'dashboard' ? 'active' : ''}" data-feature="${id}" ${page ? `data-page="${page}"` : ''}>
      <span class="nav-icon">${icon}</span><span>${label}</span>
    </button>`).join('');
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('.nav-button');
    if (!button) return;
    if (button.dataset.page) {
      window.location.href = `/admin/pages/feature.html?feature=${encodeURIComponent(button.dataset.page)}`;
      return;
    }
    nav.querySelectorAll('.nav-button').forEach(item => item.classList.toggle('active', item === button));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function loadSummary() {
  const summary = await fetchJson(`${API}/summary`);
  document.getElementById('passengerCount').textContent = summary.passengers;
  document.getElementById('driverCount').textContent = summary.drivers;
  document.getElementById('activeCount').textContent = summary.activeTrips;
  document.getElementById('revenueCount').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(summary.revenue);
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function formatFare(value) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(Number(value || 0));
}
function renderBookings() {
  const query = document.getElementById('bookingSearch').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const filtered = allBookings.filter(b => {
    const searchable = [b.trip_id,b.request_id,b.passenger_name,b.driver_name,b.pickup_location,b.destination,b.vehicle_number,b.vehicle_type,b.status].join(' ').toLowerCase();
    return searchable.includes(query) && (status === 'ALL' || b.status === status);
  });
  const tbody = document.getElementById('bookingRows');
  document.getElementById('bookingCountLabel').textContent = `${filtered.length} shown`;
  document.getElementById('tableFooter').textContent = `Showing ${filtered.length} of ${allBookings.length} bookings`;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No bookings match your search.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>#TR-${String(b.trip_id).padStart(4,'0')}</td>
      <td><div class="person-cell"><strong>${safe(b.passenger_name)}</strong><small>Request #${safe(b.request_id)}</small></div></td>
      <td><div class="person-cell"><strong>${safe(b.driver_name)}</strong><small>${safe(b.vehicle_number)} · ${safe(b.vehicle_type)}</small></div></td>
      <td><div class="route-cell"><strong>● ${safe(b.pickup_location)}</strong><small>↓ ${safe(b.destination)}</small></div></td>
      <td class="fare">${formatFare(b.fare)}</td>
      <td><span class="status ${safe(String(b.status).toLowerCase())}">${safe(b.status.replaceAll('_',' '))}</span></td>
    </tr>`).join('');
}

function initMap() {
  if (!window.L) {
    document.getElementById('rideMap').innerHTML = '<p style="padding:20px">Map library could not load. Check your internet connection.</p>';
    return;
  }
  rideMap = L.map('rideMap').setView([13.0067, 80.2206], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(rideMap);
}
async function loadMapVehicles() {
  const vehicles = await fetchJson(`${API}/map-vehicles`);
  if (!rideMap) return;
  if (window.activeVehicleMarkers) window.activeVehicleMarkers.forEach(marker => rideMap.removeLayer(marker));
  window.activeVehicleMarkers = vehicles.map(vehicle => {
    const marker = L.marker([vehicle.lat, vehicle.lng]).addTo(rideMap);
    marker.bindPopup(`<strong>Trip #${safe(vehicle.trip_id)}</strong><br>Driver: ${safe(vehicle.driver_name)}<br>Vehicle: ${safe(vehicle.vehicle_number)}<br>Status: ${safe(vehicle.status.replaceAll('_',' '))}<br><small>${safe(vehicle.pickup_location)} → ${safe(vehicle.destination)}</small><br><em>Demo coordinates, not live GPS</em>`);
    return marker;
  });
  if (vehicles.length > 0) {
    const group = L.featureGroup(window.activeVehicleMarkers);
    rideMap.fitBounds(group.getBounds().pad(0.25), { maxZoom: 13 });
  }
}
async function refreshDashboard() {
  const button = document.getElementById('refreshBtn');
  button.disabled = true; button.textContent = 'Refreshing…';
  try {
    const [summaryResult, bookingsResult, mapResult] = await Promise.allSettled([loadSummary(), fetchJson(`${API}/bookings`), loadMapVehicles()]);
    if (bookingsResult.status === 'fulfilled') { allBookings = bookingsResult.value; renderBookings(); }
    else throw bookingsResult.reason;
    if (summaryResult.status === 'rejected') console.error(summaryResult.reason);
    if (mapResult.status === 'rejected') console.error(mapResult.reason);
  } catch (error) {
    console.error(error);
    document.getElementById('bookingRows').innerHTML = '<tr><td colspan="6" class="empty-state">Could not load data. Start the Node server and check MySQL configuration.</td></tr>';
    document.getElementById('bookingCountLabel').textContent = 'Connection error';
  } finally { button.disabled = false; button.textContent = '↻ Refresh data'; }
}
renderNavigation();
initMap();
document.getElementById('bookingSearch').addEventListener('input', renderBookings);
document.getElementById('statusFilter').addEventListener('change', renderBookings);
document.getElementById('refreshBtn').addEventListener('click', refreshDashboard);
refreshDashboard();
