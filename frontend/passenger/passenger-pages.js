/* passenger-pages.js — CabFlow Passenger page logic
   Covers: dashboard, active-trip, trip-history, profile
   All communication via passengerApi() from passenger-common.js           */

const passengerPage = document.body.dataset.page;
const pageMessage = document.getElementById('pageMessage');

// Active-trip auto-poll interval handle (cleared on unload)
let activeTripPollingId = null;

// Trip-history debounce handle
let historySearchDebounce = null;

// Full trip-history data cache (for client-side filtering)
let cachedTripHistory = [];

/* ── Utility helpers ─────────────────────────────────────────── */

const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});

function showPageMessage(message, isError = false) {
    if (!pageMessage) return;
    pageMessage.textContent = message;
    pageMessage.classList.add('visible');
    pageMessage.classList.toggle('error', isError);
}

function clearPageMessage() {
    if (!pageMessage) return;
    pageMessage.textContent = '';
    pageMessage.classList.remove('visible', 'error');
}

function addTextElement(parent, tagName, className, text) {
    const el = document.createElement(tagName);
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
}

function formatDate(value) {
    if (!value) return 'Date unavailable';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleString();
}

function renderEmpty(container, message) {
    container.replaceChildren();
    addTextElement(container, 'p', 'empty-state', message);
}

/**
 * Shorten a full Nominatim display_name to a concise "Place, City" label.
 * e.g. "Vadapalani, Zone 10 Kodambakkam, Chennai, … Tamil Nadu, India"
 *   → "Vadapalani, Chennai"
 */
function shortenLocation(raw) {
    if (!raw) return raw;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 2) return raw;

    // Always keep the first part (neighbourhood / place name)
    const first = parts[0];

    // Find a short, recognisable city/district part:
    // skip numeric postcodes, skip parts that are substrings of the first part,
    // and pick the first remaining part that is ≤ 30 chars.
    const city = parts.slice(1).find(p =>
        !/^\d/.test(p) &&              // not a postcode
        p.toLowerCase() !== first.toLowerCase() &&
        p.length <= 30
    );

    return city ? `${first}, ${city}` : first;
}

/* ── Star-rating form builder ────────────────────────────────── */

/**
 * Build a star-rating widget using hidden radio inputs + styled labels.
 * Returns a <fieldset> element. Radio inputs are named "rating".
 */
function buildStarRating(tripId) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'star-rating';

    const legend = document.createElement('legend');
    legend.textContent = 'Rate your driver';
    fieldset.appendChild(legend);

    const starsWrap = document.createElement('div');
    starsWrap.className = 'star-rating-stars';

    // Render stars 5 → 1 (CSS reverses display order with flex-direction: row-reverse)
    for (let v = 5; v >= 1; v--) {
        const id = `star-${tripId}-${v}`;

        const input = document.createElement('input');
        input.type = 'radio';
        input.id = id;
        input.name = 'rating';
        input.value = String(v);
        input.required = true;
        input.className = 'star-input';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'star-label';
        label.title = `${v} ${v === 1 ? 'star' : 'stars'}`;
        label.textContent = '★';
        label.setAttribute('aria-label', `${v} ${v === 1 ? 'star' : 'stars'}`);

        starsWrap.appendChild(input);
        starsWrap.appendChild(label);
    }

    fieldset.appendChild(starsWrap);
    return fieldset;
}

/* ── Review form ─────────────────────────────────────────────── */

function createReviewForm(trip) {
    const form = document.createElement('form');
    form.className = 'review-form';

    // Star-rating widget (replaces old <select>)
    const starWidget = buildStarRating(trip.trip_id);
    form.appendChild(starWidget);

    // Comment textarea
    const commentLabel = document.createElement('label');
    const commentId = `trip-review-${trip.trip_id}`;
    commentLabel.htmlFor = commentId;
    commentLabel.textContent = 'Review (optional)';

    const comment = document.createElement('textarea');
    comment.id = commentId;
    comment.name = 'comment';
    comment.maxLength = 1000;
    comment.placeholder = 'Share a comment about your ride';

    const submit = document.createElement('button');
    submit.className = 'review-button';
    submit.type = 'submit';
    submit.textContent = 'Submit review';

    form.append(commentLabel, comment, submit);

    form.addEventListener('submit', async event => {
        event.preventDefault();

        // Validate rating selection
        const ratingInput = form.querySelector('input[name="rating"]:checked');
        if (!ratingInput) {
            showPageMessage('Please select a star rating before submitting.', true);
            return;
        }

        submit.disabled = true;
        submit.textContent = 'Submitting…';

        try {
            const result = await passengerApi(
                `/api/passenger/trips/${trip.trip_id}/review`,
                {
                    method: 'POST',
                    body: {
                        rating: Number(ratingInput.value),
                        comment: comment.value
                    }
                }
            );
            showPageMessage(result.message);
            await loadTripHistory();
        } catch (error) {
            if (error.message !== 'Please sign in to continue') {
                showPageMessage(error.message || 'Unable to submit your review.', true);
            }
            submit.disabled = false;
            submit.textContent = 'Submit review';
        }
    });

    return form;
}

/* ── Active trips ────────────────────────────────────────────── */

function renderActiveTrips(trips) {
    const container = document.getElementById('activeTrips');
    if (!container) return;
    container.replaceChildren();

    if (!trips.length) {
        renderEmpty(container, 'You have no active bookings.');
        return;
    }

    for (const trip of trips) {
        const isInProgress = trip.status === 'IN_PROGRESS';
        const card = document.createElement('article');
        card.className = isInProgress ? 'trip-card trip-card-pulse' : 'trip-card';

        // Header row
        const cardHeader = document.createElement('div');
        cardHeader.className = 'trip-card-header';

        const titleGroup = document.createElement('div');
        addTextElement(titleGroup, 'h3', '', `Trip #${trip.trip_id}`);
        addTextElement(titleGroup, 'p', 'trip-meta', `Requested ${formatDate(trip.requested_at)}`);
        if (trip.scheduled_for) {
            addTextElement(titleGroup, 'p', 'trip-meta trip-scheduled-badge', `Scheduled for: ${formatDate(trip.scheduled_for)}`);
        }

        const statusBadge = document.createElement('span');
        statusBadge.className = `trip-status ${String(trip.status).toLowerCase()}`;
        statusBadge.textContent = trip.status.replaceAll('_', ' ');

        cardHeader.append(titleGroup, statusBadge);

        // IN_PROGRESS pulse label
        if (isInProgress) {
            const inProgressNote = document.createElement('p');
            inProgressNote.className = 'trip-meta trip-in-progress-note';
            inProgressNote.textContent = 'Trip is currently in progress';
            titleGroup.appendChild(inProgressNote);
        }

        // Route
        const route = document.createElement('div');
        route.className = 'trip-route';
        addTextElement(route, 'div', 'trip-route-pickup', `Pickup: ${shortenLocation(trip.pickup_location)}`);
        addTextElement(route, 'div', 'trip-route-destination', `Destination: ${shortenLocation(trip.destination)}`);

        // Details
        const details = document.createElement('div');
        details.className = 'trip-details';
        addTextElement(details, 'span', '', `Driver: ${trip.driver_name}`);
        addTextElement(details, 'span', '', `Phone: ${trip.driver_mobile}`);
        addTextElement(details, 'span', '', `Vehicle: ${trip.vehicle_number} · ${trip.vehicle_type} ${trip.model}`);
        addTextElement(details, 'span', '', `Fare: ${money.format(Number(trip.fare) || 0)}`);

        card.append(cardHeader, route, details);

        if (trip.status === 'ASSIGNED') {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'cancel-button';
            cancelButton.type = 'button';
            cancelButton.textContent = 'Cancel booking';
            cancelButton.addEventListener('click', () => cancelTrip(trip.trip_id, cancelButton));
            card.appendChild(cancelButton);
        } else {
            addTextElement(card, 'p', 'trip-meta', 'This trip has started and can no longer be cancelled here.');
        }

        container.appendChild(card);
    }
}

async function loadActiveTrips() {
    clearPageMessage();
    const container = document.getElementById('activeTrips');
    if (!container) return;
    renderEmpty(container, 'Loading your active trips…');

    try {
        const trips = await passengerApi('/api/passenger/active-trips');
        renderActiveTrips(trips);
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            renderEmpty(container, 'Could not load active trips.');
            showPageMessage(error.message || 'Unable to load active trips.', true);
        }
    }
}

async function cancelTrip(tripId, button) {
    if (!window.confirm('Cancel this assigned booking? This cannot be undone.')) return;

    button.disabled = true;
    button.textContent = 'Cancelling…';

    try {
        const result = await passengerApi(`/api/passenger/bookings/${tripId}`, { method: 'DELETE' });
        await loadActiveTrips();
        showPageMessage(result.message);
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            showPageMessage(error.message || 'Unable to cancel this booking.', true);
        }
        button.disabled = false;
        button.textContent = 'Cancel booking';
    }
}

/* ── Trip history ────────────────────────────────────────────── */

function renderTripHistory(trips) {
    const container = document.getElementById('tripHistory');
    if (!container) return;
    container.replaceChildren();

    if (!trips.length) {
        renderEmpty(container, 'No trips match your search.');
        return;
    }

    for (const trip of trips) {
        const card = document.createElement('article');
        card.className = 'trip-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'trip-card-header';

        const titleGroup = document.createElement('div');
        addTextElement(titleGroup, 'h3', '', `Trip #${trip.trip_id}`);
        addTextElement(titleGroup, 'p', 'trip-meta', `Requested ${formatDate(trip.requested_at)}`);
        if (trip.scheduled_for) {
            addTextElement(titleGroup, 'p', 'trip-meta trip-scheduled-badge', `Scheduled for: ${formatDate(trip.scheduled_for)}`);
        }

        cardHeader.appendChild(titleGroup);
        addTextElement(
            cardHeader,
            'span',
            `trip-status ${String(trip.status).toLowerCase()}`,
            trip.status.replaceAll('_', ' ')
        );

        const route = document.createElement('div');
        route.className = 'trip-route';
        addTextElement(route, 'div', '', `Pickup: ${shortenLocation(trip.pickup_location)}`);
        addTextElement(route, 'div', '', `Destination: ${shortenLocation(trip.destination)}`);

        const details = document.createElement('div');
        details.className = 'trip-details';
        addTextElement(details, 'span', '', `Driver: ${trip.driver_name}`);
        addTextElement(details, 'span', '', `Vehicle: ${trip.vehicle_number} · ${trip.vehicle_type}`);
        addTextElement(
            details,
            'span',
            '',
            `Fare: ${trip.fare == null ? 'Not recorded' : money.format(trip.fare)}`
        );
        addTextElement(
            details,
            'span',
            '',
            `Distance: ${trip.distance_km == null ? 'Not recorded' : `${trip.distance_km} km`}`
        );

        card.append(cardHeader, route, details);

        if (trip.can_review) {
            card.appendChild(createReviewForm(trip));
        } else if (trip.passenger_rating != null) {
            addTextElement(
                card,
                'p',
                'trip-meta',
                `Your review: ${trip.passenger_rating}/5${trip.passenger_review ? ` · ${trip.passenger_review}` : ''}`
            );
        }

        container.appendChild(card);
    }
}

/** Client-side filter — called on every keystroke (debounced). */
function applyHistoryFilter(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        renderTripHistory(cachedTripHistory);
        return;
    }
    const filtered = cachedTripHistory.filter(trip =>
        (trip.pickup_location || '').toLowerCase().includes(q) ||
        (trip.destination || '').toLowerCase().includes(q)
    );
    renderTripHistory(filtered);
}

async function loadTripHistory() {
    clearPageMessage();
    const container = document.getElementById('tripHistory');
    if (!container) return;
    renderEmpty(container, 'Loading your trip history…');

    try {
        const trips = await passengerApi('/api/passenger/trip-history');
        cachedTripHistory = trips;

        // Apply any active filter value immediately after reload
        const searchEl = document.getElementById('historySearch');
        if (searchEl && searchEl.value.trim()) {
            applyHistoryFilter(searchEl.value);
        } else {
            renderTripHistory(trips);
        }
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            renderEmpty(container, 'Could not load trip history.');
            showPageMessage(error.message || 'Unable to load trip history.', true);
        }
    }
}

/* ── Dashboard recent trips ──────────────────────────────────── */

/**
 * Render up to 3 recent trips (across active + history) as mini cards
 * into the #recentTrips container.
 */
function renderRecentTrips(trips) {
    const container = document.getElementById('recentTrips');
    if (!container) return;
    container.replaceChildren();

    if (!trips.length) {
        renderEmpty(container, 'No trips yet — book your first ride!');
        return;
    }

    const recent = trips.slice(0, 3);

    for (const trip of recent) {
        const card = document.createElement('article');
        card.className = 'recent-trip-mini';

        const statusBadge = document.createElement('span');
        statusBadge.className = `trip-status ${String(trip.status).toLowerCase()}`;
        statusBadge.textContent = trip.status.replaceAll('_', ' ');

        const tripId = addTextElement(card, 'h3', 'recent-trip-id', `Trip #${trip.trip_id}`);
        card.insertBefore(statusBadge, tripId);

        addTextElement(card, 'p', 'recent-trip-route', `${shortenLocation(trip.pickup_location)} → ${shortenLocation(trip.destination)}`);
        const timeText = trip.scheduled_for
            ? `Scheduled: ${formatDate(trip.scheduled_for)}`
            : formatDate(trip.requested_at);
        addTextElement(card, 'p', 'trip-meta', timeText);

        if (trip.fare != null) {
            addTextElement(card, 'p', 'recent-trip-fare', money.format(Number(trip.fare) || 0));
        }

        container.appendChild(card);
    }
}

/* ── Dashboard ───────────────────────────────────────────────── */

async function loadDashboard() {
    clearPageMessage();

    try {
        const [activeTrips, history] = await Promise.all([
            passengerApi('/api/passenger/active-trips'),
            passengerApi('/api/passenger/trip-history')
        ]);

        const completedTrips = history.filter(t => t.status === 'COMPLETED');
        const completedFare = completedTrips.reduce((sum, t) => sum + (Number(t.fare) || 0), 0);

        document.getElementById('activeTripCount').textContent = String(activeTrips.length);
        document.getElementById('completedTripCount').textContent = String(completedTrips.length);
        document.getElementById('completedFareTotal').textContent = money.format(completedFare);

        // Merge active + history, sort newest first
        const allTrips = [
            ...activeTrips.map(t => ({ ...t, _sort: t.requested_at || '' })),
            ...history.map(t => ({ ...t, _sort: t.requested_at || '' }))
        ].sort((a, b) => (b._sort > a._sort ? 1 : b._sort < a._sort ? -1 : 0));

        renderRecentTrips(allTrips);
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            showPageMessage(error.message || 'Unable to load your passenger dashboard.', true);
        }
    }
}

/* ── Profile ─────────────────────────────────────────────────── */

function loadProfile(passenger) {
    const form = document.getElementById('profileForm');
    if (!form) return;

    // Populate editable fields
    form.elements.name.value = passenger.name || '';
    form.elements.email.value = passenger.email || '';
    form.elements.mobile.value = passenger.mobile || '';
    form.elements.default_address.value = passenger.default_address || '';
    form.elements.emergency_contact.value = passenger.emergency_contact || '';

    // Populate read-only Account ID field if present
    const accountIdEl = document.getElementById('profileAccountId');
    if (accountIdEl) accountIdEl.value = passenger.passenger_id ?? '';

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const submitButton = document.getElementById('saveProfileButton');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving…';
        clearPageMessage();

        try {
            const formData = new FormData(form);
            const result = await passengerApi('/api/passenger/profile', {
                method: 'PUT',
                body: Object.fromEntries(formData.entries())
            });

            // Update form with returned values
            form.elements.name.value = result.name;
            form.elements.mobile.value = result.mobile;
            form.elements.default_address.value = result.default_address || '';
            form.elements.emergency_contact.value = result.emergency_contact || '';

            // Update name displayed in the page header
            document.querySelectorAll('[data-passenger-name]').forEach(el => {
                el.textContent = result.name;
            });

            showPageMessage('Profile updated successfully.');
        } catch (error) {
            showPageMessage(error.message || 'Unable to save your profile.', true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save changes';
        }
    });
}

/* ── Page initialiser ────────────────────────────────────────── */

async function initializePassengerPage() {
    const passenger = await requirePassengerSession();
    if (!passenger) return;

    if (passengerPage === 'dashboard') {
        await loadDashboard();

    } else if (passengerPage === 'active-trip') {
        const refreshBtn = document.getElementById('refreshTripsButton');
        if (refreshBtn) refreshBtn.addEventListener('click', loadActiveTrips);

        await loadActiveTrips();

        // Auto-poll every 20 seconds
        activeTripPollingId = setInterval(loadActiveTrips, 20_000);

    } else if (passengerPage === 'trip-history') {
        const refreshBtn = document.getElementById('refreshTripsButton');
        if (refreshBtn) refreshBtn.addEventListener('click', loadTripHistory);

        // Wire up debounced search filter
        const searchEl = document.getElementById('historySearch');
        if (searchEl) {
            searchEl.addEventListener('input', () => {
                clearTimeout(historySearchDebounce);
                historySearchDebounce = setTimeout(
                    () => applyHistoryFilter(searchEl.value),
                    300
                );
            });
        }

        await loadTripHistory();

    } else if (passengerPage === 'profile') {
        loadProfile(passenger);
    }
}

// Clear auto-poll on page unload
window.addEventListener('beforeunload', () => {
    if (activeTripPollingId !== null) {
        clearInterval(activeTripPollingId);
        activeTripPollingId = null;
    }
});

initializePassengerPage();
