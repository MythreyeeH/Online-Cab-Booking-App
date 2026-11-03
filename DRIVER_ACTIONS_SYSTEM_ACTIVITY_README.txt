DRIVER APPROVAL/BLOCKING AND SYSTEM ACTIVITY

Files added/changed:
- routes/admin.js: driver verification/account status functions and system log query
- server.js: PUT driver status endpoints and GET /api/admin/system-logs
- frontend/admin/manage-records.js: separate pending driver table and current driver actions
- frontend/admin/manage-records.css: action styles
- frontend/admin/admin.js: System Activity Monitoring sidebar entry
- frontend/admin/pages/system-activity.html
- frontend/admin/system-activity.js
- frontend/admin/system-activity.css

The manage-drivers page already loads ../manage-records.js, which resolves to frontend/admin/manage-records.js.
System logs are fetched as stored using SELECT * FROM system_logs ORDER BY created_at DESC, log_id DESC. Driver action log user_id is NULL because this project does not currently authenticate admin sessions. IP address is taken from the request socket.

Run from project root: npm start
Driver actions: PUT /api/admin/drivers/:id/verification {"verification_status":"APPROVED"|"REJECTED"}
Driver account: PUT /api/admin/drivers/:id/status {"status":"ACTIVE"|"BLOCKED"}
Activity: GET /api/admin/system-logs
