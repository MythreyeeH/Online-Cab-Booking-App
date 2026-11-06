const accountMessage = document.getElementById('accountMessage');
const accountHeading = document.getElementById('accountHeading');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');

function showAccountMessage(message, isError = false) {
    accountMessage.textContent = message;
    accountMessage.classList.add('visible');
    accountMessage.classList.toggle('error', isError);
}

function showAccountMode(mode) {
    const showLogin = mode === 'login';
    loginForm.hidden = !showLogin;
    registerForm.hidden = showLogin;
    loginTab.classList.toggle('active', showLogin);
    loginTab.setAttribute('aria-selected', String(showLogin));
    registerTab.classList.toggle('active', !showLogin);
    registerTab.setAttribute('aria-selected', String(!showLogin));
    accountHeading.textContent = showLogin ? 'Welcome back' : 'Create your account';
    accountMessage.classList.remove('visible', 'error');
}

function getReturnPath() {
    const requestedPath = new URLSearchParams(location.search).get('return_to');

    if (
        requestedPath &&
        requestedPath.startsWith('/passenger/') &&
        !requestedPath.startsWith('//') &&
        !requestedPath.startsWith('/passenger/account.html')
    ) {
        return requestedPath;
    }

    return '/passenger/passenger-dashboard.html';
}

async function submitAccountForm(form, endpoint) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Please wait…';
    accountMessage.classList.remove('visible', 'error');

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unable to access your account');
        }

        location.replace(getReturnPath());
    } catch (error) {
        console.error('Passenger account request failed:', error);
        showAccountMessage(error.message || 'Unable to access your account. Please try again.', true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

loginTab.addEventListener('click', () => showAccountMode('login'));
registerTab.addEventListener('click', () => showAccountMode('register'));

if (new URLSearchParams(location.search).get('mode') === 'register') {
    showAccountMode('register');
}

loginForm.addEventListener('submit', event => {
    event.preventDefault();
    if (loginForm.reportValidity()) {
        submitAccountForm(loginForm, '/api/passenger/login');
    }
});

registerForm.addEventListener('submit', event => {
    event.preventDefault();
    if (registerForm.reportValidity()) {
        submitAccountForm(registerForm, '/api/passenger/register');
    }
});
