const API = '/api/admin';

const featureConfigs = {
    drivers: {
        title: 'Manage Drivers',
        description: 'Create, update, and remove driver accounts.',
        endpoint: 'drivers',
        idField: 'driver_id',
        formPage: 'driver-form.html',
        columns: [
            { key: 'driver_id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'license_no', label: 'License' },
            { key: 'verification_status', label: 'Verification' },
            { key: 'account_status', label: 'Account' },
            { key: 'rating', label: 'Rating' }
        ]
    },
    passengers: {
        title: 'Manage Passengers',
        description: 'Create, update, and remove passenger accounts.',
        endpoint: 'passengers',
        idField: 'passenger_id',
        formPage: 'passenger-form.html',
        columns: [
            { key: 'passenger_id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'default_address', label: 'Address' },
            { key: 'emergency_contact', label: 'Emergency' },
            { key: 'account_status', label: 'Account' }
        ]
    },
    vehicles: {
        title: 'Manage Vehicles',
        description: 'Assign vehicles to approved drivers.',
        endpoint: 'vehicles',
        idField: 'vehicle_id',
        formPage: 'vehicle-form.html',
        columns: [
            { key: 'vehicle_id', label: 'ID' },
            { key: 'vehicle_number', label: 'Number' },
            { key: 'vehicle_type', label: 'Type' },
            { key: 'model', label: 'Model' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'status', label: 'Status' }
        ]
    },
    users: {
        title: 'Manage Users',
        description: 'Update passenger and driver login accounts.',
        endpoint: 'users',
        idField: 'user_id',
        formPage: 'user-form.html',
        createDisabled: true,
        columns: [
            { key: 'user_id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'role', label: 'Role' },
            { key: 'account_status', label: 'Account' },
            { key: 'profile_id', label: 'Profile ID' }
        ]
    }
};

const feature = document.body.dataset.feature;
const config = featureConfigs[feature];
const searchInput = document.getElementById('recordsSearch');
const messageElement = document.getElementById('recordsMessage');
const headElement = document.getElementById('recordsHead');
const bodyElement = document.getElementById('recordsBody');
const addButton = document.getElementById('addRecordBtn');

let records = [];

function safe(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

async function request(url, options = {}) {
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

function searchableText(record) {
    return config.columns
        .map(column => record[column.key])
        .concat([record[config.idField]])
        .join(' ')
        .toLowerCase();
}

function renderTable() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = records.filter(record => searchableText(record).includes(query));

    headElement.innerHTML = `
        <tr>
            ${config.columns.map(column => `<th>${safe(column.label)}</th>`).join('')}
            <th>Actions</th>
        </tr>
    `;

    if (!filtered.length) {
        bodyElement.innerHTML = `
            <tr>
                <td class="records-empty" colspan="${config.columns.length + 1}">
                    No records found.
                </td>
            </tr>
        `;
        return;
    }

    bodyElement.innerHTML = filtered.map(record => `
        <tr>
            ${config.columns.map(column => {
                const value = record[column.key];
                if (column.key === 'rating' && value != null) {
                    return `<td>${safe(Number(value).toFixed(2))}</td>`;
                }
                return `<td>${safe(value ?? '—')}</td>`;
            }).join('')}
            <td class="records-row-actions">
                <button type="button" class="records-button secondary" data-edit="${safe(record[config.idField])}">
                    Edit
                </button>
                <button type="button" class="records-button danger" data-delete="${safe(record[config.idField])}">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadRecords() {
    messageElement.textContent = '';
    bodyElement.innerHTML = `
        <tr>
            <td class="records-empty" colspan="${config.columns.length + 1}">Loading...</td>
        </tr>
    `;

    records = await request(`${API}/${config.endpoint}`);
    renderTable();
}

async function deleteRecord(id) {
    if (!window.confirm(`Delete this ${feature.slice(0, -1)} record?`)) {
        return;
    }

    try {
        await request(`${API}/${config.endpoint}/${id}`, { method: 'DELETE' });
        messageElement.textContent = 'Record deleted successfully.';
        await loadRecords();
    } catch (error) {
        messageElement.textContent = error.message;
    }
}

function initialise() {
    if (!config) {
        document.getElementById('recordsTitle').textContent = 'Unknown page';
        messageElement.textContent = 'This manage page is not configured.';
        return;
    }

    document.getElementById('recordsTitle').textContent = config.title;
    document.getElementById('recordsDescription').textContent = config.description;
    document.title = `${config.title} | Cab Booking Admin`;

    if (config.createDisabled) {
        addButton.style.display = 'none';
    } else {
        addButton.textContent = `Add ${config.title.replace('Manage ', '').replace(/s$/, '')}`;
        addButton.addEventListener('click', () => {
            window.location.href = config.formPage;
        });
    }

    searchInput.addEventListener('input', renderTable);

    bodyElement.addEventListener('click', event => {
        const editId = event.target.closest('[data-edit]')?.dataset.edit;
        const deleteId = event.target.closest('[data-delete]')?.dataset.delete;

        if (editId) {
            window.location.href = `${config.formPage}?id=${encodeURIComponent(editId)}`;
            return;
        }

        if (deleteId) {
            deleteRecord(deleteId);
        }
    });

    loadRecords().catch(error => {
        messageElement.textContent = error.message;
        bodyElement.innerHTML = `
            <tr>
                <td class="records-empty" colspan="${config.columns.length + 1}">
                    Could not load records.
                </td>
            </tr>
        `;
    });
}

initialise();
