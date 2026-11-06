async function passengerApi(path, options = {}) {
    const requestOptions = {
        ...options,
        credentials: 'same-origin',
        headers: { ...(options.headers || {}) }
    };

    if (
        requestOptions.body &&
        typeof requestOptions.body !== 'string' &&
        !(requestOptions.body instanceof FormData)
    ) {
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(requestOptions.body);
    }

    const response = await fetch(path, requestOptions);
    const result = await response.json();

    if (response.status === 401) {
        const returnTo = location.pathname + location.search;
        location.replace(`/auth.html?role=PASSENGER&return_to=${encodeURIComponent(returnTo)}`);
        throw new Error('Please sign in to continue');
    }

    if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status})`);
    }

    return result;
}

async function requirePassengerSession() {
    try {
        const result = await passengerApi('/api/passenger/session');

        if (!result.authenticated) {
            const returnTo = location.pathname + location.search;
            location.replace(`/auth.html?role=PASSENGER&return_to=${encodeURIComponent(returnTo)}`);
            return null;
        }

        document.querySelectorAll('[data-passenger-name]').forEach(element => {
            element.textContent = result.passenger.name;
        });

        document.body.classList.remove('auth-pending');
        return result.passenger;
    } catch (error) {
        if (error.message !== 'Please sign in to continue') {
            console.error('Unable to verify passenger session:', error);
            const message = document.getElementById('pageMessage');
            if (message) {
                message.textContent = 'Could not verify your account. Check the server connection and refresh.';
                message.classList.add('visible', 'error');
            }
            document.body.classList.remove('auth-pending');
        }

        return null;
    }
}

async function signOutPassenger() {
    try {
        await passengerApi('/api/passenger/logout', { method: 'POST' });
        location.replace('/auth.html?role=PASSENGER');
    } catch (error) {
        console.error('Unable to sign out:', error);
    }
}

document.querySelectorAll('[data-sign-out]').forEach(button => {
    button.addEventListener('click', signOutPassenger);
});

window.passengerApi = passengerApi;
window.requirePassengerSession = requirePassengerSession;
