
const API = '/api/admin';

const formConfigs = {
    driver: {
        title: 'Driver',
        endpoint: 'drivers',
        idField: 'driver_id',
        fields: [
            { name: 'name', label: 'Full Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'mobile', label: 'Mobile Number', required: true },
            {
                name: 'password',
                label: 'Password',
                type: 'password',
                requiredOnCreate: true,
                help: 'Leave blank when editing to keep the existing password.'
            },
            { name: 'license_no', label: 'License Number', required: true },
            { name: 'license_expiry', label: 'License Expiry', type: 'date', required: true },
            {
                name: 'verification_status',
                label: 'Verification Status',
                type: 'select',
                options: ['PENDING', 'APPROVED', 'REJECTED'],
                defaultValue: 'PENDING'
            },
            {
                name: 'account_status',
                label: 'Account Status',
                type: 'select',
                options: ['ACTIVE', 'BLOCKED', 'INACTIVE'],
                defaultValue: 'ACTIVE'
            }
        ]
    },

    passenger: {
        title: 'Passenger',
        endpoint: 'passengers',
        idField: 'passenger_id',
        fields: [
            { name: 'name', label: 'Full Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'mobile', label: 'Mobile Number', required: true },
            {
                name: 'password',
                label: 'Password',
                type: 'password',
                requiredOnCreate: true,
                help: 'Leave blank when editing to keep the existing password.'
            },
            {
                name: 'default_address',
                label: 'Default Address',
                type: 'textarea'
            },
            { name: 'emergency_contact', label: 'Emergency Contact' },
            {
                name: 'account_status',
                label: 'Account Status',
                type: 'select',
                options: ['ACTIVE', 'BLOCKED', 'INACTIVE'],
                defaultValue: 'ACTIVE'
            }
        ]
    },

    vehicle: {
        title: 'Vehicle',
        endpoint: 'vehicles',
        idField: 'vehicle_id',
        fields: [
            { name: 'vehicle_number', label: 'Vehicle Number', required: true },
            { name: 'vehicle_type', label: 'Vehicle Type', required: true },
            { name: 'model', label: 'Model', required: true },
            { name: 'capacity', label: 'Capacity', type: 'number', required: true },
            {
                name: 'driver_id',
                label: 'Assigned Driver',
                type: 'driver-select'
            },
            {
                name: 'status',
                label: 'Vehicle Status',
                type: 'select',
                options: ['ACTIVE', 'INACTIVE'],
                defaultValue: 'ACTIVE'
            }
        ]
    },

    user: {
        title: 'User',
        endpoint: 'users',
        idField: 'user_id',
        fields: [
            { name: 'name', label: 'Full Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'mobile', label: 'Mobile Number', required: true },
            {
                name: 'role',
                label: 'Role',
                type: 'select',
                options: ['PASSENGER', 'DRIVER'],
                required: true
            },
            {
                name: 'account_status',
                label: 'Account Status',
                type: 'select',
                options: ['ACTIVE', 'BLOCKED', 'INACTIVE'],
                defaultValue: 'ACTIVE'
            },
            {
                name: 'password',
                label: 'New Password',
                type: 'password',
                help: 'Leave blank to keep the existing password.'
            }
        ]
    }
};

const formType = document.body.dataset.form;
const config = formConfigs[formType];

const form = document.getElementById('recordForm');
const fieldsContainer = document.getElementById('formFields');
const titleElement = document.getElementById('formTitle');
const descriptionElement = document.getElementById('formDescription');
const messageElement = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');
const isEditing = Boolean(recordId);

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
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

function renderFields() {
    fieldsContainer.innerHTML = config.fields.map(field => {
        const required = field.required || (field.requiredOnCreate && !isEditing);
        const requiredAttribute = required ? 'required' : '';
        const value = field.defaultValue ?? '';

        let control = '';

        if (field.type === 'select') {
            control = `
                <select id="${field.name}" name="${field.name}" ${requiredAttribute}>
                    ${field.options.map(option => `
                        <option value="${safe(option)}"
                            ${option === value ? 'selected' : ''}>
                            ${safe(option.replaceAll('_', ' '))}
                        </option>
                    `).join('')}
                </select>
            `;
        } else if (field.type === 'textarea') {
            control = `
                <textarea id="${field.name}" name="${field.name}"
                    ${requiredAttribute}></textarea>
            `;
        } else if (field.type === 'driver-select') {
            control = `
                <select id="${field.name}" name="${field.name}">
                    <option value="">Unassigned</option>
                </select>
            `;
        } else {
            control = `
                <input
                    id="${field.name}"
                    name="${field.name}"
                    type="${field.type || 'text'}"
                    ${requiredAttribute}
                    ${field.type === 'number' ? 'min="1"' : ''}
                >
            `;
        }

        return `
            <div class="form-field">
                <label for="${field.name}">${safe(field.label)}</label>
                ${control}
                ${field.help ? `<small class="form-help">${safe(field.help)}</small>` : ''}
            </div>
        `;
    }).join('');
}

function setFormValues(record) {
    for (const field of config.fields) {
        const input = form.elements[field.name];
        if (!input) continue;

        if (field.type === 'date' && record[field.name]) {
            input.value = String(record[field.name]).slice(0, 10);
        } else {
            input.value = record[field.name] ?? field.defaultValue ?? '';
        }
    }
}

async function loadDriverOptions() {
    const select = form.elements.driver_id;
    if (!select) return;

    const drivers = await request(`${API}/vehicle-drivers`);

    drivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.driver_id;
        option.textContent = `${driver.name} (${driver.verification_status})`;
        select.appendChild(option);
    });
}

async function loadExistingRecord() {
    if (!isEditing) return;

    const rows = await request(`${API}/${config.endpoint}`);
    const record = rows.find(item =>
        String(item[config.idField]) === String(recordId)
    );

    if (!record) throw new Error(`${config.title} record not found`);

    setFormValues(record);
}

async function initialise() {
    if (!config) {
        messageElement.textContent = 'Invalid form page.';
        submitButton.disabled = true;
        return;
    }

    titleElement.textContent = `${isEditing ? 'Edit' : 'Add'} ${config.title}`;
    descriptionElement.textContent = isEditing
        ? `Update the ${config.title.toLowerCase()} details below.`
        : `Enter the details to create a new ${config.title.toLowerCase()} record.`;

    submitButton.textContent = isEditing ? 'Save Changes' : 'Create Record';

    renderFields();

    try {
        if (form.elements.driver_id) await loadDriverOptions();
        await loadExistingRecord();
    } catch (error) {
        messageElement.textContent = error.message;
        submitButton.disabled = true;
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    messageElement.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());

    if (formType === 'vehicle') {
        data.capacity = Number(data.capacity);
        data.driver_id = data.driver_id || null;
    }

    if (formType === 'user' && !isEditing) {
        messageElement.textContent =
            'New accounts should be created from Manage Drivers or Manage Passengers.';
        return;
    }

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        const url = isEditing
            ? `${API}/${config.endpoint}/${recordId}`
            : `${API}/${config.endpoint}`;

        await request(url, {
            method: isEditing ? 'PUT' : 'POST',
            body: JSON.stringify(data)
        });

        window.alert(`${config.title} ${isEditing ? 'updated' : 'created'} successfully.`);

        window.location.href = `manage-${config.endpoint}.html`;
    } catch (error) {
        messageElement.textContent = error.message;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = isEditing ? 'Save Changes' : 'Create Record';
    }
});

initialise();
