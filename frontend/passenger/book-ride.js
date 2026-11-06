const rideSearchForm = document.getElementById('rideSearchForm');
const searchButton = document.getElementById('searchButton');
const cabResults = document.getElementById('cabResults');
const searchMessage = document.getElementById('searchMessage');
const resultCount = document.getElementById('resultCount');
const resultsDescription = document.getElementById('resultsDescription');
const distanceSummary = document.getElementById('distanceSummary');
const passengerSessionReady = requirePassengerSession();
const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});
let map;
let pickupMarker;
let destinationMarker;
let routeLine;

/**
 * Shorten a full Nominatim display_name to a concise "Place, City" label.
 * e.g. "Vadapalani, Zone 10 Kodambakkam, Chennai, … Tamil Nadu, India"
 *   → "Vadapalani, Chennai"
 */
function shortenLocation(raw) {
    if (!raw) return raw;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 2) return raw;
    const first = parts[0];
    const city = parts.slice(1).find(p =>
        !/^\d/.test(p) &&
        p.toLowerCase() !== first.toLowerCase() &&
        p.length <= 30
    );
    return city ? `${first}, ${city}` : first;
}

function initializeMap() {
    if (!window.L) {
        document.getElementById('routeMap').textContent =
            'The map library did not load. Check your internet connection and reload the page.';
        showMessage('Map library could not load. Location search still works, but the map cannot be displayed.', true);
        return;
    }

    map = L.map('routeMap').setView([13.0067, 80.2206], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function clearSearchMap() {
    if (!map) {
        return;
    }

    for (const layer of [pickupMarker, destinationMarker, routeLine]) {
        if (layer) {
            map.removeLayer(layer);
        }
    }

    pickupMarker = null;
    destinationMarker = null;
    routeLine = null;
}

function showSearchOnMap(result) {
    if (!map) {
        return;
    }

    clearSearchMap();

    const pickup = [
        result.pickup_coordinates.latitude,
        result.pickup_coordinates.longitude
    ];
    const destination = [
        result.destination_coordinates.latitude,
        result.destination_coordinates.longitude
    ];

    pickupMarker = L.circleMarker(pickup, {
        radius: 8,
        color: '#146c4b',
        fillColor: '#2eb987',
        fillOpacity: 1,
        weight: 2
    }).addTo(map);

    destinationMarker = L.circleMarker(destination, {
        radius: 8,
        color: '#285b94',
        fillColor: '#4d91dc',
        fillOpacity: 1,
        weight: 2
    }).addTo(map);

    const pickupLabel = document.createElement('span');
    pickupLabel.textContent = `Pickup: ${shortenLocation(result.pickup_location)}`;
    pickupMarker.bindTooltip(pickupLabel);

    const destinationLabel = document.createElement('span');
    destinationLabel.textContent = `Destination: ${shortenLocation(result.destination)}`;
    destinationMarker.bindTooltip(destinationLabel);

    routeLine = L.polyline([pickup, destination], {
        color: '#187b56',
        weight: 4,
        dashArray: '8 7'
    }).addTo(map);

    map.fitBounds(routeLine.getBounds().pad(0.15), { maxZoom: 14 });
    distanceSummary.textContent =
        `Pickup: ${shortenLocation(result.pickup_location)}. Destination: ${shortenLocation(result.destination)}. ` +
        `Straight-line distance: ${result.distance_km} km; road distance may be longer.`;
}

function showMessage(message, isError = false) {
    searchMessage.textContent = message;
    searchMessage.classList.add('visible');
    searchMessage.classList.toggle('error', isError);
}

function addDetail(list, label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');

    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.appendChild(row);
}

function renderCabs(vehicles, distanceKm) {
    cabResults.replaceChildren();

    if (!vehicles.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No available cabs match this route right now. Please try again later.';
        cabResults.appendChild(emptyState);
        resultCount.textContent = '0 cabs';
        resultCount.classList.remove('has-results');
        return;
    }

    for (const vehicle of vehicles) {
        const card = document.createElement('article');
        card.className = 'cab-card';

        const header = document.createElement('div');
        header.className = 'cab-card-header';

        const vehicleInfo = document.createElement('div');
        const title = document.createElement('h3');
        const model = document.createElement('p');
        title.textContent = `${vehicle.vehicle_type} · ${vehicle.vehicle_number}`;
        model.className = 'cab-model';
        model.textContent = vehicle.model;
        vehicleInfo.append(title, model);

        const fare = document.createElement('strong');
        fare.className = 'cab-fare';
        fare.textContent = money.format(vehicle.estimated_fare);
        header.append(vehicleInfo, fare);

        const details = document.createElement('dl');
        details.className = 'cab-details';
        addDetail(details, 'Driver', vehicle.driver_name);
        addDetail(details, 'Driver rating', `${Number(vehicle.driver_rating).toFixed(1)} / 5`);
        addDetail(details, 'Capacity', `${vehicle.capacity} passengers`);
        addDetail(details, 'Straight-line distance', `${distanceKm} km`);

        const rate = document.createElement('p');
        rate.className = 'cab-rate';
        rate.textContent = `${money.format(vehicle.base_fare)} base + ${money.format(vehicle.per_km_rate)} per km`;

        const scheduledVal = document.getElementById('scheduledFor')?.value;
        const bookButton = document.createElement('button');
        bookButton.className = 'primary-button book-cab-button';
        bookButton.type = 'button';
        bookButton.textContent = scheduledVal ? 'Schedule this cab' : 'Book this cab';
        bookButton.addEventListener('click', () => bookCab(vehicle.vehicle_id, bookButton));

        card.append(header, details, rate, bookButton);
        cabResults.appendChild(card);
    }

    resultCount.textContent = `${vehicles.length} ${vehicles.length === 1 ? 'cab' : 'cabs'}`;
    resultCount.classList.add('has-results');
}

async function bookCab(vehicleId, button) {
    if (!await passengerSessionReady) {
        return;
    }

    const formData = new FormData(rideSearchForm);
    const scheduledFor = formData.get('scheduled_for') ? formData.get('scheduled_for').trim() : '';
    const confirmMessage = scheduledFor
        ? `Schedule this cab for ${new Date(scheduledFor).toLocaleString()}?`
        : 'Book this cab for the displayed pickup and destination?';

    if (!window.confirm(confirmMessage)) {
        return;
    }

    button.disabled = true;
    button.textContent = scheduledFor ? 'Scheduling…' : 'Booking…';

    try {
        const result = await passengerApi('/api/passenger/bookings', {
            method: 'POST',
            body: {
                vehicle_id: vehicleId,
                pickup_location: formData.get('pickup_location').trim(),
                destination: formData.get('destination').trim(),
                scheduled_for: scheduledFor || null
            }
        });

        const successText = result.scheduled_for
            ? `Cab scheduled! Trip #${result.trip_id} reserved with ${result.driver_name} for ${new Date(result.scheduled_for).toLocaleString()}. Opening your active trips…`
            : `Cab booked. Trip #${result.trip_id} is assigned to ${result.driver_name}. Opening your active trip…`;

        showMessage(successText);
        window.setTimeout(() => {
            location.assign('/passenger/active-trip.html');
        }, 1100);
    } catch (error) {
        console.error('Cab booking failed:', error);
        showMessage(error.message || 'Unable to book this cab. Please try again.', true);
        button.disabled = false;
        button.textContent = scheduledFor ? 'Schedule this cab' : 'Book this cab';
    }
}

rideSearchForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!await passengerSessionReady) {
        return;
    }

    if (!rideSearchForm.reportValidity()) {
        return;
    }

    const formData = new FormData(rideSearchForm);
    const search = new URLSearchParams({
        pickup_location: formData.get('pickup_location').trim(),
        destination: formData.get('destination').trim()
    });

    searchButton.disabled = true;
    searchButton.textContent = 'Finding places…';
    searchMessage.classList.remove('visible', 'error');
    cabResults.replaceChildren();
    clearSearchMap();
    distanceSummary.textContent = 'Looking up pickup and destination places…';
    resultsDescription.textContent = 'Searching for available cabs…';
    resultCount.textContent = 'Searching…';
    resultCount.classList.remove('has-results');

    try {
        const response = await fetch(`/api/passenger/available-cabs?${search}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unable to search for cabs');
        }

        showSearchOnMap(result);
        renderCabs(result.vehicles, result.distance_km);
        resultsDescription.textContent =
            `${shortenLocation(result.pickup_location)} to ${shortenLocation(result.destination)} · ${result.distance_km} km straight-line`;

        if (result.vehicles.length) {
            showMessage('Fares are estimates based on the active fare rules. No cab has been booked.');
        } else {
            showMessage('There are no available cabs at the moment. No booking was created.');
        }
    } catch (error) {
        console.error('Cab search failed:', error);
        cabResults.replaceChildren();
        resultCount.textContent = 'Search failed';
        showMessage(error.message || 'Unable to search for cabs. Please try again.', true);
    } finally {
        searchButton.disabled = false;
        searchButton.textContent = 'Search available cabs';
    }
});

const scheduledInput = document.getElementById('scheduledFor');
if (scheduledInput) {
    const pad = n => String(n).padStart(2, '0');
    const updateMinScheduleTime = () => {
        const now = new Date(Date.now() + 5 * 60 * 1000);
        scheduledInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };
    updateMinScheduleTime();
    scheduledInput.addEventListener('focus', updateMinScheduleTime);
    scheduledInput.addEventListener('input', () => {
        const isScheduled = Boolean(scheduledInput.value);
        document.querySelectorAll('.book-cab-button').forEach(btn => {
            btn.textContent = isScheduled ? 'Schedule this cab' : 'Book this cab';
        });
    });
}

initializeMap();
