const accountMessage = document.getElementById('accountMessage');
const registerForm = document.getElementById('registerForm');

function showAccountMessage(message, isError = false) {
    if (!accountMessage) return;
    accountMessage.textContent = message;
    accountMessage.classList.add('visible');
    accountMessage.classList.toggle('error', isError);
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

registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!registerForm.reportValidity()) return;

    const submitButton = registerForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Creating account…';
    if (accountMessage) accountMessage.classList.remove('visible', 'error');

    const formData = new FormData(registerForm);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/passenger/register', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unable to create your account');
        }

        showAccountMessage('Account created successfully! Redirecting…');
        setTimeout(() => {
            location.replace(getReturnPath());
        }, 800);
    } catch (error) {
        console.error('Registration failed:', error);
        showAccountMessage(error.message || 'Unable to register. Please check your details and try again.', true);
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});
