
const activityRows = document.getElementById('activityRows');
const activityMessage = document.getElementById('activityMessage');
const refreshButton = document.getElementById('refreshLogs');

// Fetch system logs from the backend
async function loadSystemActivity() {

    activityRows.innerHTML = `
        <tr>
            <td colspan="6" class="empty-row">
                Loading activity records...
            </td>
        </tr>
    `;

    try {

        const response = await fetch('/api/admin/system-logs', {
            credentials: 'same-origin'
        });

        const logs = await response.json();

        if (!response.ok) {
            throw new Error(logs.error || 'Failed to fetch system logs');
        }

        if (!Array.isArray(logs)) {
            throw new Error('Invalid response from server');
        }

        if (logs.length === 0) {

            activityRows.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-row">
                        No activity records found.
                    </td>
                </tr>
            `;

            activityMessage.textContent = 'No records available.';
            return;
        }

        // Display database records without changing their values
        activityRows.innerHTML = logs.map(log => `
            <tr>
                <td>${escapeHTML(log.log_id)}</td>

                <td>
                    ${log.user_id === null
                        ? '—'
                        : escapeHTML(log.user_id)}
                </td>

                <td>${escapeHTML(log.action)}</td>

                <td>${escapeHTML(log.description)}</td>

                <td>
                    ${log.ip_address
                        ? escapeHTML(log.ip_address)
                        : '—'}
                </td>

                <td>${escapeHTML(log.created_at)}</td>
            </tr>
        `).join('');

        activityMessage.textContent =
            `${logs.length} activity record(s) fetched from database.`;

    } catch (error) {

        console.error('System activity error:', error);

        activityRows.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    Unable to load system activity.
                </td>
            </tr>
        `;

        activityMessage.textContent = error.message;
    }
}

// Escape values before inserting database content into HTML
function escapeHTML(value) {

    return String(value ?? '').replace(/[&<>"']/g, character => {

        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return entities[character];
    });
}

// Refresh button
refreshButton.addEventListener('click', loadSystemActivity);

// Initial load
loadSystemActivity();
