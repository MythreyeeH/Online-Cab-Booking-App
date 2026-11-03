CANONICAL PROJECT STRUCTURE

This project uses the ROOT directory as the Node.js backend:
- server.js
- db.js
- routes/admin.js
- package.json
- database/schema.sql and database/seed.sql
- frontend/...

There is intentionally no nested backend/ directory. The previous nested backend/
contained only a redundant package.json. Do not run a second server from there.

Run from the project root:
  npm install
  npm start

The server serves frontend/ and reads .env from the project root.
Copy .env.example to .env and set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
DB_NAME, and PORT for your local MySQL installation.

Implemented pages:
- /admin/pages/fares-areas.html
- /admin/pages/start-trip.html
- /admin/pages/reports.html

The fare/service-area APIs existed in routes/admin.js and server.js; this update
adds their frontend pages, restores missing trip functions, and adds report APIs.
Reports use Chart.js from its CDN, so the reports charts need an internet connection.

Database assumptions follow database/schema.sql. No schema migration is required
for these three features. Test against your own MySQL database before submission.
