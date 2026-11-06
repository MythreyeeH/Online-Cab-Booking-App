const loginForm = document.getElementById('loginForm');
const roleSelect = document.getElementById('role');
const formMessage = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');

const destinations = {
    PASSENGER: '/passenger/passenger-dashboard.html',
    DRIVER: '/driver-view/index.html',
    ADMIN: '/admin/admin-dashboard.html',
    'SUPER ADMIN': '/admin/admin-dashboard.html'
};

function showMessage(message) {
    formMessage.textContent = message;
    formMessage.classList.add('visible');
}

function redirectForRole(role) {
    if (destinations[role]) {
        location.replace(destinations[role]);
    }
}

async function checkExistingSession() {
    const requestedRole = new URLSearchParams(location.search).get('role');
    const selectableRoles = ['PASSENGER', 'DRIVER', 'ADMIN', 'SUPER ADMIN'];
    if (selectableRoles.includes(requestedRole)) {
        roleSelect.value = requestedRole;
    }

    try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
        if (!response.ok) return;
        const result = await response.json();
        if (result.authenticated) redirectForRole(result.role);
    } catch (error) {
        console.error('Unable to check sign-in session:', error);
    }
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;

    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Signing in…';
    formMessage.classList.remove('visible');

    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unable to sign in. Please try again.');
        }

        redirectForRole(result.role);
    } catch (error) {
        console.error('Sign-in request failed:', error);
        showMessage(error.message || 'Unable to sign in. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});

checkExistingSession();
