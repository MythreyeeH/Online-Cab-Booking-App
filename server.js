
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const admin = require('./routes/admin');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND = path.resolve(__dirname, '../frontend');

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

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
    });

    res.end(JSON.stringify(data));
}

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
            if (!body) return resolve({});

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Invalid JSON request body'));
            }
        });

        req.on('error', reject);
    });
}

function serveStatic(pathname, res) {
    let requested;

    try {
        requested = decodeURIComponent(pathname);
    } catch {
        res.writeHead(400);
        return res.end('Invalid URL');
    }

    if (requested === '/') requested = '/index.html';

    const filePath = path.resolve(FRONTEND, `.${requested}`);

    if (!filePath.startsWith(FRONTEND + path.sep) && filePath !== FRONTEND) {
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
            'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream'
        });

        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
        // Dashboard endpoints
        if (req.method === 'GET' && pathname === '/api/admin/summary') {
            return sendJson(res, 200, await admin.getSummary());
        }

        if (req.method === 'GET' && pathname === '/api/admin/bookings') {
            return sendJson(res, 200, await admin.getBookings());
        }

        if (req.method === 'GET' && pathname === '/api/admin/map-vehicles') {
            return sendJson(res, 200, await admin.getMapVehicles());
        }

        // Driver endpoints
        if (req.method === 'GET' && pathname === '/api/admin/drivers') {
            return sendJson(res, 200, await admin.listDrivers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/drivers') {
            const body = await readBody(req);
            return sendJson(res, 201, await admin.createDriver(body));
        }

        let match = pathname.match(/^\/api\/admin\/drivers\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);
            return sendJson(res, 200, await admin.updateDriver(Number(match[1]), body));
        }

        if (match && req.method === 'DELETE') {
            return sendJson(res, 200, await admin.deleteDriver(Number(match[1])));
        }

        // Passenger endpoints
        if (req.method === 'GET' && pathname === '/api/admin/passengers') {
            return sendJson(res, 200, await admin.listPassengers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/passengers') {
            const body = await readBody(req);
            return sendJson(res, 201, await admin.createPassenger(body));
        }

        match = pathname.match(/^\/api\/admin\/passengers\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);
            return sendJson(res, 200, await admin.updatePassenger(Number(match[1]), body));
        }

        if (match && req.method === 'DELETE') {
            return sendJson(res, 200, await admin.deletePassenger(Number(match[1])));
        }

        // Vehicle endpoints
        if (req.method === 'GET' && pathname === '/api/admin/vehicles') {
            return sendJson(res, 200, await admin.listVehicles());
        }

        if (req.method === 'GET' && pathname === '/api/admin/vehicle-drivers') {
            return sendJson(res, 200, await admin.getVehicleDrivers());
        }

        if (req.method === 'POST' && pathname === '/api/admin/vehicles') {
            const body = await readBody(req);
            return sendJson(res, 201, await admin.createVehicle(body));
        }

        match = pathname.match(/^\/api\/admin\/vehicles\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);
            return sendJson(res, 200, await admin.updateVehicle(Number(match[1]), body));
        }

        if (match && req.method === 'DELETE') {
            return sendJson(res, 200, await admin.deleteVehicle(Number(match[1])));
        }

        // Combined passenger + driver user management
        if (req.method === 'GET' && pathname === '/api/admin/users') {
            return sendJson(res, 200, await admin.listUsers());
        }

        match = pathname.match(/^\/api\/admin\/users\/(\d+)$/);

        if (match && req.method === 'PUT') {
            const body = await readBody(req);
            return sendJson(res, 200, await admin.updateUser(Number(match[1]), body));
        }

        if (match && req.method === 'DELETE') {
            return sendJson(res, 200, await admin.deleteUser(Number(match[1])));
        }

        // --------------------------------------------------
// SERVICE AREA ENDPOINTS
// --------------------------------------------------

if (req.method === 'GET' && pathname === '/api/admin/service-areas') {
    return sendJson(res, 200, await admin.listServiceAreas());
}

if (req.method === 'POST' && pathname === '/api/admin/service-areas') {
    const body = await readBody(req);
    return sendJson(res, 201, await admin.createServiceArea(body));
}

let areaMatch = pathname.match(/^\/api\/admin\/service-areas\/(\d+)$/);

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


        // --------------------------------------------------
        // FARE RULE ENDPOINTS
        // --------------------------------------------------

        if (req.method === 'GET' && pathname === '/api/admin/fare-rules') {
            return sendJson(res, 200, await admin.listFareRules());
        }

        const fareMatch = pathname.match(/^\/api\/admin\/fare-rules\/(\d+)$/);

        if (fareMatch && req.method === 'PUT') {
            const body = await readBody(req);

            return sendJson(
                res,
                200,
                await admin.updateFareRule(Number(fareMatch[1]), body)
            );
        }

        if (pathname.startsWith('/api/')) {
            return sendJson(res, 404, { error: 'API endpoint not found' });
        }

        return serveStatic(pathname, res);
    } catch (error) {
        console.error(error);

        const duplicate = error.code === 'ER_DUP_ENTRY';
        const foreignKey = error.code === 'ER_ROW_IS_REFERENCED_2';

        const status = duplicate ? 409 : foreignKey ? 409 : 400;

        return sendJson(res, status, {
            error: duplicate
                ? 'A record with this email, mobile number, license number or vehicle number already exists.'
                : foreignKey
                    ? 'This record is linked to existing trips or other records and cannot be deleted.'
                    : error.message || 'Server/database error.'
        });
    }
});

server.listen(PORT, () => {
    console.log(`Cab Booking app running at http://localhost:${PORT}`);
});
