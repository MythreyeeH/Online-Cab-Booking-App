const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const admin = require('./routes/admin');
const passenger = require('./routes/passenger');
const passengerAuth = require('./routes/passenger-auth');
const auth = require('./routes/auth');
const driver = require('./routes/driver');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND = path.join(__dirname, 'frontend');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
};

// Send JSON response
function sendJson(res, status, data, headers = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        ...headers
    });

    res.end(JSON.stringify(data));
}

// Read JSON request body
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk;

            if (body.length > 1_000_000) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });

        req.on('end', () => {
            if (!body) {
                return resolve({});
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Invalid JSON request body'));
            }
        });

        req.on('error', reject);
    });
}

// Serve frontend files
function serveStatic(pathname, res) {
    let requested;

    try {
        requested = decodeURIComponent(pathname);
    } catch {
        res.writeHead(400);
        return res.end('Invalid URL');
    }

    if (requested === '/') {
        requested = '/index.html';
    }

    const filePath = path.resolve(FRONTEND, `.${requested}`);

    if (
        !filePath.startsWith(FRONTEND + path.sep) &&
        filePath !== FRONTEND
    ) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, {
                'Content-Type': 'text/plain; charset=utf-8'
            });

            return res.end('Page not found');
        }

        res.writeHead(200, {
            'Content-Type':
                MIME[path.extname(filePath).toLowerCase()] ||
                'application/octet-stream'
        });

        res.end(content);
    });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        return res.end();
    }

    const url = new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
    );

    const pathname = url.pathname;

    try {
        if (req.method === 'POST' && pathname === '/api/auth/login') {
            const body = await readBody(req);
            const result = await auth.login(body, req);

            return sendJson(
                res,
                200,
                { role: result.role, user: result.user },
                { 'Set-Cookie': result.cookies }
            );
        }

        if (req.method === 'GET' && pathname === '/api/auth/session') {
            const currentSession = await auth.getSession(req);
            return sendJson(res, 200, {
                authenticated: Boolean(currentSession),
                role: currentSession ? currentSession.role : null,
                user: currentSession ? currentSession.user : null
            });
        }

        if (req.method === 'POST' && pathname === '/api/auth/logout') {
            return sendJson(
                res,
                200,
                { message: 'Signed out successfully' },
                { 'Set-Cookie': auth.logout(req) }
            );
        }

        if (pathname.startsWith('/api/admin/')) {
            const currentUser = await auth.getRoleSession(req);

            if (!currentUser) {
                return sendJson(res, 401, { error: 'Please sign in as an administrator' });
            }

            if (!['ADMIN', 'SUPER ADMIN'].includes(currentUser.role)) {
                return sendJson(res, 403, { error: 'Administrator access is required' });
            }
        }

        if (pathname.startsWith('/admin/')) {
            const currentSession = await auth.getSession(req);

            if (!currentSession || !['ADMIN', 'SUPER ADMIN'].includes(currentSession.role)) {
                const destination = currentSession
                    ? currentSession.role === 'DRIVER'
                        ? '/driver-view/index.html'
                        : '/passenger/passenger-dashboard.html'
                    : '/auth.html?role=ADMIN';
                res.writeHead(302, { Location: destination, 'Cache-Control': 'no-store' });
                return res.end();
            }
        }

        // ==========================================
        // PASSENGER ACCOUNT ENDPOINTS
        // ==========================================

        if (
            req.method === 'POST' &&
            pathname === '/api/passenger/register'
        ) {
            const body = await readBody(req);
            const result = await passengerAuth.register(body);

            return sendJson(
                res,
                201,
                { passenger: result.passenger },
                { 'Set-Cookie': [result.cookie, auth.clearRoleSessionCookie()] }
            );
        }

        if (
            req.method === 'POST' &&
            pathname === '/api/passenger/login'
        ) {
            const body = await readBody(req);
            const result = await passengerAuth.login(
                body,
                req.socket.remoteAddress || 'unknown'
            );

            return sendJson(
                res,
                200,
                { passenger: result.passenger },
                { 'Set-Cookie': [result.cookie, auth.clearRoleSessionCookie()] }
            );
        }

        if (
            req.method === 'POST' &&
            pathname === '/api/passenger/logout'
        ) {
            return sendJson(
                res,
                200,
                { message: 'Signed out successfully' },
                { 'Set-Cookie': passengerAuth.logout(req) }
            );
        }

        if (
            req.method === 'GET' &&
            pathname === '/api/passenger/session'
        ) {
            const currentPassenger = await passengerAuth.getSession(req);

            return sendJson(res, 200, {
                authenticated: Boolean(currentPassenger),
                passenger: currentPassenger
            });
        }

        // PASSENGER RIDE SEARCH ENDPOINTS
        // ==========================================

        if (
            req.method === 'GET' &&
            pathname === '/api/passenger/available-cabs'
        ) {
            return sendJson(
                res,
                200,
                await passenger.searchAvailableCabs({
                    pickup_location: url.searchParams.get('pickup_location'),
                    destination: url.searchParams.get('destination')
                })
            );
        }

        if (pathname.startsWith('/api/passenger/')) {
            const currentPassenger = await passengerAuth.getSession(req);

            if (!currentPassenger) {
                return sendJson(res, 401, {
                    error: 'Please sign in to access your passenger account'
                });
            }

            if (
                req.method === 'POST' &&
                pathname === '/api/passenger/bookings'
            ) {
                const body = await readBody(req);

                return sendJson(
                    res,
                    201,
                    await passenger.createBooking(
                        currentPassenger.passenger_id,
                        body
                    )
                );
            }

            if (
                req.method === 'GET' &&
                pathname === '/api/passenger/active-trips'
            ) {
                return sendJson(
                    res,
                    200,
                    await passenger.listActiveTrips(
                        currentPassenger.passenger_id
                    )
                );
            }

            if (
                req.method === 'GET' &&
                pathname === '/api/passenger/trip-history'
            ) {
                return sendJson(
                    res,
                    200,
                    await passenger.listTripHistory(
                        currentPassenger.passenger_id,
                        currentPassenger.user_id
                    )
                );
            }

            if (
                req.method === 'PUT' &&
                pathname === '/api/passenger/profile'
            ) {
                const body = await readBody(req);
                return sendJson(
                    res,
                    200,
                    await passenger.updateProfile(
                        currentPassenger.passenger_id,
                        currentPassenger.user_id,
                        body
                    )
                );
            }

            let passengerMatch = pathname.match(
                /^\/api\/passenger\/bookings\/(\d+)$/
            );

            if (passengerMatch && req.method === 'DELETE') {
                return sendJson(
                    res,
                    200,
                    await passenger.cancelBooking(
                        currentPassenger.passenger_id,
                        Number(passengerMatch[1])
                    )
                );
            }

            passengerMatch = pathname.match(
                /^\/api\/passenger\/trips\/(\d+)\/review$/
            );

            if (passengerMatch && req.method === 'POST') {
                const body = await readBody(req);

                return sendJson(
                    res,
                    201,
                    await passenger.reviewTrip(
                        currentPassenger.passenger_id,
                        currentPassenger.user_id,
                        Number(passengerMatch[1]),
                        body
                    )
                );
            }

            return sendJson(res, 404, {
                error: 'Passenger API endpoint not found'
            });
        }


        // ==========================================
        // DRIVER ENDPOINTS
        // ==========================================

        if (pathname.startsWith('/api/driver/')) {
            const currentUser = await auth.getRoleSession(req);

            if (!currentUser || currentUser.role !== 'DRIVER') {
                return sendJson(res, 401, {
                    error: 'Please sign in as a driver'
                });
            }

            const driverId = await driver.requireDriverId(currentUser);

            if (req.method === 'GET' && pathname === '/api/driver/dashboard') {
                return sendJson(res, 200, await driver.getDashboard(driverId));
            }

            if (req.method === 'GET' && pathname === '/api/driver/requests') {
                return sendJson(res, 200, await driver.listIncomingRequests(driverId));
            }

            if (req.method === 'GET' && pathname === '/api/driver/trips') {
                return sendJson(res, 200, await driver.listMyTrips(driverId));
            }

            if (req.method === 'PUT' && pathname === '/api/driver/availability') {
                const body = await readBody(req);
                return sendJson(
                    res,
                    200,
                    await driver.setAvailability(driverId, Boolean(body.online))
                );
            }

            let driverMatch = pathname.match(/^\/api\/driver\/trips\/(\d+)\/accept$/);
            if (driverMatch && req.method === 'PUT') {
                return sendJson(
                    res,
                    200,
                    await driver.acceptTrip(driverId, Number(driverMatch[1]))
                );
            }

            driverMatch = pathname.match(/^\/api\/driver\/trips\/(\d+)\/reject$/);
            if (driverMatch && req.method === 'PUT') {
                return sendJson(
                    res,
                    200,
                    await driver.rejectTrip(driverId, Number(driverMatch[1]))
                );
            }

            driverMatch = pathname.match(/^\/api\/driver\/trips\/(\d+)\/complete$/);
            if (driverMatch && req.method === 'PUT') {
                return sendJson(
                    res,
                    200,
                    await driver.completeTrip(driverId, Number(driverMatch[1]))
                );
            }

            return sendJson(res, 404, { error: 'Driver API endpoint not found' });
        }

        // ==========================================
        // DASHBOARD ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/summary') {
            return sendJson(res, 200, await admin.getSummary());
        }

        if (req.method === 'GET' && pathname === '/api/admin/bookings') {
            return sendJson(res, 200, await admin.getBookings());
        }

        if (req.method === 'GET' && pathname === '/api/admin/map-vehicles') {
            return sendJson(res, 200, await admin.getMapVehicles());
        }


        // ==========================================
        // DRIVER ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/drivers') {
            return sendJson(res, 200, await admin.listDrivers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/drivers') {
            const body = await readBody(req);

            return sendJson(
                res,
                201,
                await admin.createDriver(body)
            );
        }

        let match = pathname.match(/^\/api\/admin\/drivers\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateDriver(Number(match[1]), body)
            );
        }

        if (match && req.method === 'DELETE') {
            return sendJson(
                res,
                200,
                await admin.deleteDriver(Number(match[1]))
            );
        }


        // ==========================================
        // PASSENGER ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/passengers') {
            return sendJson(res, 200, await admin.listPassengers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/passengers') {
            const body = await readBody(req);

            return sendJson(
                res,
                201,
                await admin.createPassenger(body)
            );
        }

        match = pathname.match(/^\/api\/admin\/passengers\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updatePassenger(Number(match[1]), body)
            );
        }

        if (match && req.method === 'DELETE') {
            return sendJson(
                res,
                200,
                await admin.deletePassenger(Number(match[1]))
            );
        }


        // ==========================================
        // VEHICLE ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/vehicles') {
            return sendJson(res, 200, await admin.listVehicles());
        }

        if (req.method === 'GET' && pathname === '/api/admin/vehicle-drivers') {
            return sendJson(res, 200, await admin.getVehicleDrivers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/vehicles') {
            const body = await readBody(req);

            return sendJson(
                res,
                201,
                await admin.createVehicle(body)
            );
        }

        match = pathname.match(/^\/api\/admin\/vehicles\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateVehicle(Number(match[1]), body)
            );
        }

        if (match && req.method === 'DELETE') {
            return sendJson(
                res,
                200,
                await admin.deleteVehicle(Number(match[1]))
            );
        }


        // ==========================================
        // USER MANAGEMENT ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/users') {
            return sendJson(res, 200, await admin.listUsers());
        }

        match = pathname.match(/^\/api\/admin\/users\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateUser(Number(match[1]), body)
            );
        }

        if (match && req.method === 'DELETE') {
            return sendJson(
                res,
                200,
                await admin.deleteUser(Number(match[1]))
            );
        }


        // ==========================================
        // SERVICE AREA ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/service-areas') {
            return sendJson(res, 200, await admin.listServiceAreas());
        }

        if (req.method === 'POST' && pathname === '/api/admin/service-areas') {
            const body = await readBody(req);

            return sendJson(
                res,
                201,
                await admin.createServiceArea(body)
            );
        }

        const areaMatch = pathname.match(
            /^\/api\/admin\/service-areas\/(\d+)$/
        );

        if (areaMatch && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateServiceArea(Number(areaMatch[1]), body)
            );
        }

        if (areaMatch && req.method === 'DELETE') {
            return sendJson(
                res,
                200,
                await admin.deleteServiceArea(Number(areaMatch[1]))
            );
        }


        // ==========================================
        // FARE RULE ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/fare-rules') {
            return sendJson(res, 200, await admin.listFareRules());
        }

        const fareMatch = pathname.match(
            /^\/api\/admin\/fare-rules\/(\d+)$/
        );

        if (fareMatch && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateFareRule(Number(fareMatch[1]), body)
            );
        }


        // ==========================================
        // START / COMPLETE TRIP ENDPOINTS
        // ==========================================

        if (req.method === 'GET' && pathname === '/api/admin/ongoing-trips') {
            return sendJson(
                res,
                200,
                await admin.listOngoingTrips()
            );
        }

        if (req.method === 'GET' && pathname === '/api/admin/trip-form-options') {
            return sendJson(
                res,
                200,
                await admin.getTripFormOptions()
            );
        }

        if (req.method === 'POST' && pathname === '/api/admin/trips') {
            const body = await readBody(req);

            return sendJson(
                res,
                201,
                await admin.createTrip(body)
            );
        }

        const tripMatch = pathname.match(
            /^\/api\/admin\/trips\/(\d+)\/complete$/
        );

        if (tripMatch && req.method === 'PUT') {
            return sendJson(
                res,
                200,
                await admin.completeTrip(Number(tripMatch[1]))
            );
        }

        // ==========================================
        // REPORT ENDPOINTS
        // ==========================================

        const reportMatch = pathname.match(
            /^\/api\/admin\/reports\/(revenue|trips|drivers|passengers)$/
        );

        if (reportMatch && req.method === 'GET') {

            const days = Number(url.searchParams.get('days') || 30);

            if (![7, 30].includes(days)) {
                return sendJson(res, 400, {
                    error: 'Invalid report period'
                });
            }

            let result;

            switch (reportMatch[1]) {

                case 'revenue':
                    result = await admin.getRevenueReport(days);
                    break;

                case 'trips':
                    result = await admin.getTripReport(days);
                    break;

                case 'drivers':
                    result = await admin.getDriverReport(days);
                    break;

                case 'passengers':
                    result = await admin.getPassengerReport(days);
                    break;
            }

            return sendJson(res, 200, result);
        }

                // ==========================================
                // UNKNOWN API ROUTE
                // ==========================================

                if (pathname.startsWith('/api/')) {
                    return sendJson(res, 404, {
                        error: 'API endpoint not found'
                    });
                }


        // ==========================================
        // SERVE FRONTEND
        // ==========================================

        return serveStatic(pathname, res);

    } catch (error) {

        console.error('Request error:', error);

        const duplicate = error.code === 'ER_DUP_ENTRY';

        const foreignKey = [
            'ER_ROW_IS_REFERENCED_2',
            'ER_NO_REFERENCED_ROW_2'
        ].includes(error.code);

        const status = error.statusCode ||
            (duplicate || foreignKey ? 409 : error.code ? 500 : 400);

        return sendJson(res, status, {
            error: duplicate
                ? 'A record with this email, mobile number, license number or vehicle number already exists.'
                : foreignKey
                    ? 'This operation conflicts with a related database record. Check the linked records.'
                    : error.message || 'Server/database error.'
        });
    }
});


// ==========================================
// START SERVER
// ==========================================

server.listen(PORT, () => {
    console.log(`Cab Booking app running at http://localhost:${PORT}`);
});