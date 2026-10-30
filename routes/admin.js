
const db = require('../db');
const crypto = require('crypto');

// Hash passwords without requiring an additional package.
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function required(value, field) {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`${field} is required`);
    }
    return String(value).trim();
}

function validRole(role) {
    return ['PASSENGER', 'DRIVER'].includes(role);
}

async function withTransaction(callback) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

async function getSummary() {
    const [[{ passengers }]] = await db.query(
        "SELECT COUNT(*) AS passengers FROM users WHERE role='PASSENGER'"
    );

    const [[{ drivers }]] = await db.query(
        "SELECT COUNT(*) AS drivers FROM driver_profiles WHERE verification_status='APPROVED'"
    );

    const [[{ activeTrips }]] = await db.query(
        "SELECT COUNT(*) AS activeTrips FROM trips WHERE trip_status IN ('ASSIGNED','IN_PROGRESS')"
    );

    const [[{ revenue }]] = await db.query(
        "SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE payment_status='PAID'"
    );

    return {
        passengers,
        drivers,
        activeTrips,
        revenue: Number(revenue)
    };
}

async function getBookings() {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            rr.request_id,
            pu.name AS passenger_name,
            du.name AS driver_name,
            rr.pickup_location,
            rr.destination,
            t.trip_status AS status,
            COALESCE(t.fare, rr.estimated_fare) AS fare,
            t.start_time,
            v.vehicle_number,
            v.vehicle_type
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN passenger_profiles pp ON pp.passenger_id = t.passenger_id
        JOIN users pu ON pu.user_id = pp.user_id
        JOIN driver_profiles dp ON dp.driver_id = t.driver_id
        JOIN users du ON du.user_id = dp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        ORDER BY
            FIELD(t.trip_status, 'IN_PROGRESS', 'ASSIGNED', 'COMPLETED', 'CANCELLED'),
            t.trip_id DESC
    `);

    return rows;
}

async function getMapVehicles() {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            t.trip_status AS status,
            du.name AS driver_name,
            v.vehicle_number,
            rr.pickup_location,
            rr.destination
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN driver_profiles dp ON dp.driver_id = t.driver_id
        JOIN users du ON du.user_id = dp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.trip_status IN ('ASSIGNED', 'IN_PROGRESS')
        ORDER BY t.trip_id
    `);

    // Demo coordinates only. Your schema does not store live GPS coordinates.
    const demoPoints = [
        { lat: 13.0067, lng: 80.2206 },
        { lat: 12.9756, lng: 80.2209 },
        { lat: 13.0108, lng: 80.2350 },
        { lat: 13.0358, lng: 80.2101 },
        { lat: 12.9345, lng: 80.2300 }
    ];

    return rows.map((row, index) => ({
        ...row,
        ...demoPoints[index % demoPoints.length],
        location_is_demo: true
    }));
}

// --------------------------------------------------
// DRIVER AND PASSENGER DETAILS
// --------------------------------------------------

async function getDrivers() {
    const [rows] = await db.query(`
        SELECT
            u.user_id,
            dp.driver_id,
            u.name,
            u.email,
            u.mobile,
            u.status AS account_status,
            dp.license_no,
            dp.license_expiry,
            dp.verification_status,
            dp.rating
        FROM driver_profiles dp
        JOIN users u ON u.user_id = dp.user_id
        ORDER BY u.name ASC
    `);

    return rows;
}

async function getPassengers() {
    const [rows] = await db.query(`
        SELECT
            u.user_id,
            pp.passenger_id,
            u.name,
            u.email,
            u.mobile,
            u.status AS account_status,
            pp.default_address,
            pp.emergency_contact
        FROM passenger_profiles pp
        JOIN users u ON u.user_id = pp.user_id
        ORDER BY u.name ASC
    `);

    return rows;
}

// --------------------------------------------------
// DRIVER CRUD
// --------------------------------------------------

async function listDrivers() {
    return getDrivers();
}

async function createDriver(data) {
    const name = required(data.name, 'Name');
    const email = required(data.email, 'Email');
    const mobile = required(data.mobile, 'Mobile');
    const password = required(data.password, 'Password');
    const licenseNo = required(data.license_no, 'License number');
    const licenseExpiry = required(data.license_expiry, 'License expiry');

    return withTransaction(async connection => {
        const [userResult] = await connection.query(`
            INSERT INTO users (name, email, mobile, password, role, status)
            VALUES (?, ?, ?, ?, 'DRIVER', ?)
        `, [
            name,
            email,
            mobile,
            hashPassword(password),
            data.account_status || 'ACTIVE'
        ]);

        const [profileResult] = await connection.query(`
            INSERT INTO driver_profiles
                (user_id, license_no, license_expiry, verification_status)
            VALUES (?, ?, ?, ?)
        `, [
            userResult.insertId,
            licenseNo,
            licenseExpiry,
            data.verification_status || 'PENDING'
        ]);

        return {
            user_id: userResult.insertId,
            driver_id: profileResult.insertId
        };
    });
}

async function updateDriver(driverId, data) {
    return withTransaction(async connection => {
        const [profiles] = await connection.query(
            'SELECT user_id FROM driver_profiles WHERE driver_id = ?',
            [driverId]
        );

        if (!profiles.length) throw new Error('Driver not found');

        const userId = profiles[0].user_id;

        await connection.query(`
            UPDATE users
            SET name = ?, email = ?, mobile = ?, status = ?
            WHERE user_id = ?
        `, [
            required(data.name, 'Name'),
            required(data.email, 'Email'),
            required(data.mobile, 'Mobile'),
            data.account_status || 'ACTIVE',
            userId
        ]);

        await connection.query(`
            UPDATE driver_profiles
            SET license_no = ?, license_expiry = ?, verification_status = ?
            WHERE driver_id = ?
        `, [
            required(data.license_no, 'License number'),
            required(data.license_expiry, 'License expiry'),
            data.verification_status || 'PENDING',
            driverId
        ]);

        if (data.password) {
            await connection.query(
                'UPDATE users SET password = ? WHERE user_id = ?',
                [hashPassword(data.password), userId]
            );
        }

        return { message: 'Driver updated successfully' };
    });
}

async function deleteDriver(driverId) {
    return withTransaction(async connection => {
        const [profiles] = await connection.query(
            'SELECT user_id FROM driver_profiles WHERE driver_id = ?',
            [driverId]
        );

        if (!profiles.length) throw new Error('Driver not found');

        const userId = profiles[0].user_id;

        // Delete the profile first. Related vehicles or trips may prevent deletion.
        await connection.query(
            'DELETE FROM driver_profiles WHERE driver_id = ?',
            [driverId]
        );

        await connection.query(
            'DELETE FROM users WHERE user_id = ?',
            [userId]
        );

        return { message: 'Driver deleted successfully' };
    });
}

// --------------------------------------------------
// PASSENGER CRUD
// --------------------------------------------------

async function listPassengers() {
    return getPassengers();
}

async function createPassenger(data) {
    const name = required(data.name, 'Name');
    const email = required(data.email, 'Email');
    const mobile = required(data.mobile, 'Mobile');
    const password = required(data.password, 'Password');

    return withTransaction(async connection => {
        const [userResult] = await connection.query(`
            INSERT INTO users (name, email, mobile, password, role, status)
            VALUES (?, ?, ?, ?, 'PASSENGER', ?)
        `, [
            name,
            email,
            mobile,
            hashPassword(password),
            data.account_status || 'ACTIVE'
        ]);

        const [profileResult] = await connection.query(`
            INSERT INTO passenger_profiles
                (user_id, default_address, emergency_contact)
            VALUES (?, ?, ?)
        `, [
            userResult.insertId,
            data.default_address || null,
            data.emergency_contact || null
        ]);

        return {
            user_id: userResult.insertId,
            passenger_id: profileResult.insertId
        };
    });
}

async function updatePassenger(passengerId, data) {
    return withTransaction(async connection => {
        const [profiles] = await connection.query(
            'SELECT user_id FROM passenger_profiles WHERE passenger_id = ?',
            [passengerId]
        );

        if (!profiles.length) throw new Error('Passenger not found');

        const userId = profiles[0].user_id;

        await connection.query(`
            UPDATE users
            SET name = ?, email = ?, mobile = ?, status = ?
            WHERE user_id = ?
        `, [
            required(data.name, 'Name'),
            required(data.email, 'Email'),
            required(data.mobile, 'Mobile'),
            data.account_status || 'ACTIVE',
            userId
        ]);

        await connection.query(`
            UPDATE passenger_profiles
            SET default_address = ?, emergency_contact = ?
            WHERE passenger_id = ?
        `, [
            data.default_address || null,
            data.emergency_contact || null,
            passengerId
        ]);

        if (data.password) {
            await connection.query(
                'UPDATE users SET password = ? WHERE user_id = ?',
                [hashPassword(data.password), userId]
            );
        }

        return { message: 'Passenger updated successfully' };
    });
}

async function deletePassenger(passengerId) {
    return withTransaction(async connection => {
        const [profiles] = await connection.query(
            'SELECT user_id FROM passenger_profiles WHERE passenger_id = ?',
            [passengerId]
        );

        if (!profiles.length) throw new Error('Passenger not found');

        const userId = profiles[0].user_id;

        await connection.query(
            'DELETE FROM passenger_profiles WHERE passenger_id = ?',
            [passengerId]
        );

        await connection.query(
            'DELETE FROM users WHERE user_id = ?',
            [userId]
        );

        return { message: 'Passenger deleted successfully' };
    });
}

// --------------------------------------------------
// VEHICLE CRUD
// --------------------------------------------------

async function listVehicles() {
    const [rows] = await db.query(`
        SELECT
            v.vehicle_id,
            v.driver_id,
            v.vehicle_number,
            v.vehicle_type,
            v.model,
            v.capacity,
            v.status,
            u.name AS driver_name
        FROM vehicles v
        LEFT JOIN driver_profiles dp ON dp.driver_id = v.driver_id
        LEFT JOIN users u ON u.user_id = dp.user_id
        ORDER BY v.vehicle_id DESC
    `);

    return rows;
}

async function getVehicleDrivers() {
    const [rows] = await db.query(`
        SELECT
            dp.driver_id,
            u.name,
            dp.verification_status
        FROM driver_profiles dp
        JOIN users u ON u.user_id = dp.user_id
        WHERE dp.verification_status = 'APPROVED'
          AND u.status = 'ACTIVE'
        ORDER BY u.name
    `);

    return rows;
}

async function createVehicle(data) {
    const [result] = await db.query(`
        INSERT INTO vehicles
            (driver_id, vehicle_number, vehicle_type, model, capacity, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        data.driver_id || null,
        required(data.vehicle_number, 'Vehicle number'),
        required(data.vehicle_type, 'Vehicle type'),
        required(data.model, 'Model'),
        Number(required(data.capacity, 'Capacity')),
        data.status || 'ACTIVE'
    ]);

    return { vehicle_id: result.insertId };
}

async function updateVehicle(vehicleId, data) {
    await db.query(`
        UPDATE vehicles
        SET driver_id = ?, vehicle_number = ?, vehicle_type = ?,
            model = ?, capacity = ?, status = ?
        WHERE vehicle_id = ?
    `, [
        data.driver_id || null,
        required(data.vehicle_number, 'Vehicle number'),
        required(data.vehicle_type, 'Vehicle type'),
        required(data.model, 'Model'),
        Number(required(data.capacity, 'Capacity')),
        data.status || 'ACTIVE',
        vehicleId
    ]);

    return { message: 'Vehicle updated successfully' };
}

async function deleteVehicle(vehicleId) {
    const [result] = await db.query(
        'DELETE FROM vehicles WHERE vehicle_id = ?',
        [vehicleId]
    );

    if (!result.affectedRows) throw new Error('Vehicle not found');

    return { message: 'Vehicle deleted successfully' };
}

// --------------------------------------------------
// COMBINED PASSENGER + DRIVER USER MANAGEMENT
// --------------------------------------------------

async function listUsers() {
    const [rows] = await db.query(`
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.mobile,
            u.role,
            u.status AS account_status,
            CASE
                WHEN u.role = 'DRIVER' THEN dp.driver_id
                WHEN u.role = 'PASSENGER' THEN pp.passenger_id
            END AS profile_id
        FROM users u
        LEFT JOIN driver_profiles dp ON dp.user_id = u.user_id
        LEFT JOIN passenger_profiles pp ON pp.user_id = u.user_id
        WHERE u.role IN ('PASSENGER', 'DRIVER')
        ORDER BY u.user_id DESC
    `);

    return rows;
}

async function updateUser(userId, data) {
    const role = required(data.role, 'Role').toUpperCase();

    if (!validRole(role)) {
        throw new Error('Only PASSENGER and DRIVER accounts can be managed here');
    }

    const fields = [
        required(data.name, 'Name'),
        required(data.email, 'Email'),
        required(data.mobile, 'Mobile'),
        data.account_status || 'ACTIVE',
        userId,
        role
    ];

    const [result] = await db.query(`
        UPDATE users
        SET name = ?, email = ?, mobile = ?, status = ?
        WHERE user_id = ? AND role = ?
    `, fields);

    if (!result.affectedRows) throw new Error('User not found');

    if (data.password) {
        await db.query(
            'UPDATE users SET password = ? WHERE user_id = ? AND role = ?',
            [hashPassword(data.password), userId, role]
        );
    }

    return { message: 'User updated successfully' };
}

// --------------------------------------------------
// SERVICE AREA MANAGEMENT
// --------------------------------------------------

async function listServiceAreas() {
    const [rows] = await db.query(`
        SELECT area_id, area_name, city, state, status
        FROM service_areas
        ORDER BY area_id DESC
    `);

    return rows;
}

async function createServiceArea(data) {
    const areaName = required(data.area_name, 'Area name');
    const city = required(data.city, 'City');
    const state = required(data.state, 'State');
    const status = data.status || 'ACTIVE';

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new Error('Invalid service area status');
    }

    const [result] = await db.query(`
        INSERT INTO service_areas (area_name, city, state, status)
        VALUES (?, ?, ?, ?)
    `, [areaName, city, state, status]);

    return {
        area_id: result.insertId,
        message: 'Service area created successfully'
    };
}

async function updateServiceArea(areaId, data) {
    const areaName = required(data.area_name, 'Area name');
    const city = required(data.city, 'City');
    const state = required(data.state, 'State');
    const status = data.status || 'ACTIVE';

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new Error('Invalid service area status');
    }

    const [result] = await db.query(`
        UPDATE service_areas
        SET area_name = ?, city = ?, state = ?, status = ?
        WHERE area_id = ?
    `, [areaName, city, state, status, areaId]);

    if (!result.affectedRows) {
        throw new Error('Service area not found');
    }

    return { message: 'Service area updated successfully' };
}

async function deleteServiceArea(areaId) {
    const [result] = await db.query(`
        DELETE FROM service_areas
        WHERE area_id = ?
    `, [areaId]);

    if (!result.affectedRows) {
        throw new Error('Service area not found');
    }

    return { message: 'Service area deleted successfully' };
}


// --------------------------------------------------
// FARE RULE MANAGEMENT
// --------------------------------------------------

async function listFareRules() {
    const [rows] = await db.query(`
        SELECT
            fare_id,
            vehicle_type,
            base_fare,
            per_km_rate,
            per_minute_rate,
            cancellation_fee,
            status
        FROM fare_rules
        ORDER BY fare_id ASC
    `);

    return rows;
}

async function updateFareRule(fareId, data) {
    const vehicleType = required(data.vehicle_type, 'Vehicle type');

    const baseFare = Number(data.base_fare);
    const perKmRate = Number(data.per_km_rate);
    const perMinuteRate = Number(data.per_minute_rate);
    const cancellationFee = Number(data.cancellation_fee);
    const status = data.status || 'ACTIVE';

    const amounts = [
        baseFare,
        perKmRate,
        perMinuteRate,
        cancellationFee
    ];

    if (amounts.some(value => !Number.isFinite(value) || value < 0)) {
        throw new Error('Fare values must be valid non-negative numbers');
    }

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new Error('Invalid fare rule status');
    }

    const [result] = await db.query(`
        UPDATE fare_rules
        SET
            vehicle_type = ?,
            base_fare = ?,
            per_km_rate = ?,
            per_minute_rate = ?,
            cancellation_fee = ?,
            status = ?
        WHERE fare_id = ?
    `, [
        vehicleType,
        baseFare,
        perKmRate,
        perMinuteRate,
        cancellationFee,
        status,
        fareId
    ]);

    if (!result.affectedRows) {
        throw new Error('Fare rule not found');
    }

    return { message: 'Fare rule updated successfully' };
}

async function deleteUser(userId) {
    return withTransaction(async connection => {
        const [users] = await connection.query(`
            SELECT user_id, role
            FROM users
            WHERE user_id = ? AND role IN ('PASSENGER', 'DRIVER')
        `, [userId]);

        if (!users.length) throw new Error('Passenger/driver user not found');

        const role = users[0].role;

        if (role === 'DRIVER') {
            await connection.query(
                'DELETE FROM driver_profiles WHERE user_id = ?',
                [userId]
            );
        } else {
            await connection.query(
                'DELETE FROM passenger_profiles WHERE user_id = ?',
                [userId]
            );
        }

        await connection.query('DELETE FROM users WHERE user_id = ?', [userId]);

        return { message: 'User deleted successfully' };
    });
}

module.exports = {
    getSummary,
    getBookings,
    getMapVehicles,
    getDrivers,
    getPassengers,

    listDrivers,
    createDriver,
    updateDriver,
    deleteDriver,

    listPassengers,
    createPassenger,
    updatePassenger,
    deletePassenger,

    listVehicles,
    getVehicleDrivers,
    createVehicle,
    updateVehicle,
    deleteVehicle,

    listUsers,
    updateUser,
    deleteUser,

    // Service areas
    listServiceAreas,
    createServiceArea,
    updateServiceArea,
    deleteServiceArea,

    // Fare rules
    listFareRules,
    updateFareRule
};
