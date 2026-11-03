
const API = '/api/admin';

let allDrivers = [];
let allPassengers = [];

// Escape database values before inserting them into HTML
function safe(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

// Format dates
function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-IN');
}

// Format status labels
function statusBadge(value, type = 'account') {
    const status = String(value || '').toUpperCase();

    let cssClass = 'status-inactive';

    if (status === 'ACTIVE' || status === 'APPROVED') {
        cssClass = type === 'verification'
            ? 'status-approved'
            : 'status-active';
    } else if (status === 'PENDING' || status === 'INACTIVE') {
        cssClass = 'status-pending';
    } else if (status === 'BLOCKED' || status === 'REJECTED') {
        cssClass = type === 'verification'
            ? 'status-rejected'
            : 'status-blocked';
    }

    const className = type === 'verification'
        ? 'verification-status'
        : 'account-status';

    return `<span class="${className} ${cssClass}">
        ${safe(status)}
    </span>`;
}


// Render drivers
function renderDrivers() {
    const query = document
        .getElementById('driverSearch')
        .value.trim().toLowerCase();

    const filtered = allDrivers.filter(driver =>
        String(driver.name || '').toLowerCase().includes(query)
    );

    document.getElementById('driverCount').textContent =
        `${filtered.length} drivers`;

    const tbody = document.getElementById('driverRows');

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No drivers found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(driver => `
        <tr>
            <td>${safe(driver.driver_id)}</td>
            <td><strong>${safe(driver.name)}</strong></td>
            <td>${safe(driver.email)}</td>
            <td>${safe(driver.mobile)}</td>
            <td>${safe(driver.license_no)}</td>
            <td>${formatDate(driver.license_expiry)}</td>
            <td>${statusBadge(driver.verification_status, 'verification')}</td>
            <td>★ ${safe(driver.rating)}</td>
            <td>${statusBadge(driver.account_status)}</td>
        </tr>
    `).join('');
}


// Render passengers
function renderPassengers() {
    const query = document
        .getElementById('passengerSearch')
        .value.trim().toLowerCase();

    const filtered = allPassengers.filter(passenger =>
        String(passenger.name || '').toLowerCase().includes(query)
    );

    document.getElementById('passengerCount').textContent =
        `${filtered.length} passengers`;

    const tbody = document.getElementById('passengerRows');

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No passengers found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(passenger => `
        <tr>
            <td>${safe(passenger.passenger_id)}</td>
            <td><strong>${safe(passenger.name)}</strong></td>
            <td>${safe(passenger.email)}</td>
            <td>${safe(passenger.mobile)}</td>
            <td>${safe(passenger.default_address || '—')}</td>
            <td>${safe(passenger.emergency_contact || '—')}</td>
            <td>${statusBadge(passenger.account_status)}</td>
        </tr>
    `).join('');
}


// Fetch drivers and passengers
async function loadUsers() {
    const driverRows = document.getElementById('driverRows');
    const passengerRows = document.getElementById('passengerRows');

    try {
        const [driverResponse, passengerResponse] = await Promise.all([
            fetch(`${API}/drivers`),
            fetch(`${API}/passengers`)
        ]);

        if (!driverResponse.ok || !passengerResponse.ok) {
            throw new Error('Failed to fetch user details');
        }

        const [drivers, passengers] = await Promise.all([
            driverResponse.json(),
            passengerResponse.json()
        ]);

        allDrivers = drivers;
        allPassengers = passengers;

        renderDrivers();
        renderPassengers();

    } catch (error) {
        console.error('Error loading user details:', error);

        driverRows.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    Failed to load drivers. Check backend connection.
                </td>
            </tr>
        `;

        passengerRows.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Failed to load passengers. Check backend connection.
                </td>
            </tr>
        `;
    }
}


// Independent search listeners
document
    .getElementById('driverSearch')
    .addEventListener('input', renderDrivers);

document
    .getElementById('passengerSearch')
    .addEventListener('input', renderPassengers);


// Initial load
loadUsers();
