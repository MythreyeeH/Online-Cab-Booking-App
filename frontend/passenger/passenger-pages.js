const passengerPage = document.body.dataset.page;
const pageMessage = document.getElementById('pageMessage');
const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});

function showPageMessage(message, isError = false) {
    if (!pageMessage) {
        return;
    }

    pageMessage.textContent = message;
    pageMessage.classList.add('visible');
    pageMessage.classList.toggle('error', isError);
}

function clearPageMessage() {
    if (pageMessage) {
        pageMessage.textContent = '';
        pageMessage.classList.remove('visible', 'error');
    }
}

function addTextElement(parent, tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    element.textContent = text;
    parent.appendChild(element);
    return element;
}

function formatDate(value) {
    if (!value) {
        return 'Date unavailable';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleString();
}

function renderEmpty(container, message) {
    container.replaceChildren();
    addTextElement(container, 'p', 'empty-state', message);
}

function renderActiveTrips(trips) {
    const container = document.getElementById('activeTrips');
    container.replaceChildren();

    if (!trips.length) {
        renderEmpty(container, 'You have no active bookings.');
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
        addTextElement(
            cardHeader,
            'span',
            `trip-status ${String(trip.status).toLowerCase()}`,
            trip.status.replaceAll('_', ' ')
        );
        cardHeader.prepend(titleGroup);

        const route = document.createElement('div');
        route.className = 'trip-route';
        addTextElement(route, 'div', '', `Pickup: ${trip.pickup_location}`);
        addTextElement(route, 'div', '', `Destination: ${trip.destination}`);

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
            addTextElement(
                card,
                'p',
                'trip-meta',
                'This trip has started and can no longer be cancelled here.'
            );
        }

        container.appendChild(card);
    }
}

async function loadActiveTrips() {
    clearPageMessage();
    const container = document.getElementById('activeTrips');
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
    if (!window.confirm('Cancel this assigned booking? This cannot be undone.')) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Cancelling…';

    try {
        const result = await passengerApi(`/api/passenger/bookings/${tripId}`, {
            method: 'DELETE'
        });
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

function createReviewForm(trip) {
    const form = document.createElement('form');
    form.className = 'review-form';

    const ratingLabel = document.createElement('label');
    const ratingId = `trip-rating-${trip.trip_id}`;
    ratingLabel.htmlFor = ratingId;
    ratingLabel.textContent = 'Rate your driver';

    const rating = document.createElement('select');
    rating.id = ratingId;
    rating.name = 'rating';
    rating.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a rating';
    placeholder.disabled = true;
    placeholder.selected = true;
    rating.appendChild(placeholder);

    for (let value = 5; value >= 1; value--) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = `${value} ${value === 1 ? 'star' : 'stars'}`;
        rating.appendChild(option);
    }

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

    form.append(ratingLabel, rating, commentLabel, comment, submit);
    form.addEventListener('submit', async event => {
        event.preventDefault();

        if (!form.reportValidity()) {
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
                        rating: Number(rating.value),
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

function renderTripHistory(trips) {
    const container = document.getElementById('tripHistory');
    container.replaceChildren();

    if (!trips.length) {
        renderEmpty(container, 'You do not have any completed or cancelled trips yet.');
        return;
    }

    for (const trip of trips) {
        const card = document.createElement('article');
        card.className = 'trip-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'trip-card-header';
        const titleGroup = document.createElement('div');
        addTextElement(titleGroup, 'h3', '', `Trip #${trip.trip_id}`);
        addTextElement(
            titleGroup,
            'p',
            'trip-meta',
            `Requested ${formatDate(trip.requested_at)}`
        );
        cardHeader.appendChild(titleGroup);
        addTextElement(
            cardHeader,
            'span',
            `trip-status ${String(trip.status).toLowerCase()}`,
            trip.status.replaceAll('_', ' ')
        );

        const route = document.createElement('div');
        route.className = 'trip-route';
        addTextElement(route, 'div', '', `Pickup: ${trip.pickup_location}`);
        addTextElement(route, 'div', '', `Destination: ${trip.destination}`);

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

async function loadTripHistory() {
    clearPageMessage();
    const container = document.getElementById('tripHistory');
    renderEmpty(container, 'Loading your trip history…');

    try {
        const trips = await passengerApi('/api/passenger/trip-history');
        renderTripHistory(trips);
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            renderEmpty(container, 'Could not load trip history.');
            showPageMessage(error.message || 'Unable to load trip history.', true);
        }
    }
}

async function loadDashboard() {
    clearPageMessage();

    try {
        const [activeTrips, history] = await Promise.all([
            passengerApi('/api/passenger/active-trips'),
            passengerApi('/api/passenger/trip-history')
        ]);
        const completedTrips = history.filter(trip => trip.status === 'COMPLETED');
        const completedFare = completedTrips.reduce(
            (total, trip) => total + (Number(trip.fare) || 0),
            0
        );

        document.getElementById('activeTripCount').textContent = String(activeTrips.length);
        document.getElementById('completedTripCount').textContent = String(completedTrips.length);
        document.getElementById('completedFareTotal').textContent = money.format(completedFare);
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            showPageMessage(error.message || 'Unable to load your passenger dashboard.', true);
        }
    }
}

async function loadProfile(passenger) {
    document.getElementById('profileName').textContent = passenger.name || 'Not provided';
    document.getElementById('profileEmail').textContent = passenger.email || 'Not provided';
    document.getElementById('profileMobile').textContent = passenger.mobile || 'Not provided';
    document.getElementById('profileAddress').textContent = passenger.default_address || 'Not provided';
    document.getElementById('profileEmergency').textContent = passenger.emergency_contact || 'Not provided';
}

async function initializePassengerPage() {
    const passenger = await requirePassengerSession();
    if (!passenger) {
        return;
    }

    if (passengerPage === 'dashboard') {
        await loadDashboard();
    } else if (passengerPage === 'active-trip') {
        document.getElementById('refreshTripsButton')
            .addEventListener('click', loadActiveTrips);
        await loadActiveTrips();
    } else if (passengerPage === 'trip-history') {
        document.getElementById('refreshTripsButton')
            .addEventListener('click', loadTripHistory);
        await loadTripHistory();
    } else if (passengerPage === 'profile') {
        await loadProfile(passenger);
    }
}

initializePassengerPage();
