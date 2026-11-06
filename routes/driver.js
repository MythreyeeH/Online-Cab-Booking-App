const db = require('../db');

function driverError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function requireDriverId(user) {
    if (!user || !user.driver_id) {
        throw driverError('Driver account required', 403);
    }

    return user.driver_id;
}

async function getDashboard(driverId) {
    const [[stats]] = await db.query(`
        SELECT
            (
                SELECT COUNT(*)
                FROM trips
                WHERE driver_id = ?
                    AND trip_status = 'COMPLETED'
                    AND DATE(COALESCE(end_time, start_time)) = CURDATE()
            ) AS todays_trips,
            (
                SELECT COALESCE(SUM(COALESCE(fare, 0)), 0)
                FROM trips
                WHERE driver_id = ?
                    AND trip_status = 'COMPLETED'
                    AND DATE(COALESCE(end_time, start_time)) = CURDATE()
            ) AS todays_earnings,
            (
                SELECT v.status
                FROM vehicles v
                WHERE v.driver_id = ?
                ORDER BY FIELD(v.status, 'AVAILABLE', 'IN_USE', 'OFFLINE', 'INACTIVE'), v.vehicle_id
                LIMIT 1
            ) AS vehicle_status
    `, [driverId, driverId, driverId]);

    const [[profile]] = await db.query(`
        SELECT
            dp.rating,
            dp.license_no,
            dp.license_expiry,
            dp.verification_status,
            u.name,
            u.email,
            u.mobile
        FROM driver_profiles dp
        JOIN users u ON u.user_id = dp.user_id
        WHERE dp.driver_id = ?
    `, [driverId]);

    const [[vehicle]] = await db.query(`
        SELECT
            vehicle_id,
            vehicle_number,
            vehicle_type,
            model,
            capacity,
            status
        FROM vehicles
        WHERE driver_id = ?
        LIMIT 1
    `, [driverId]);

    return {
        todays_trips: Number(stats?.todays_trips || 0),
        todays_earnings: Number(stats?.todays_earnings || 0),
        online: String(stats?.vehicle_status || 'OFFLINE') === 'AVAILABLE' ||
            String(stats?.vehicle_status || '') === 'IN_USE',
        vehicle_status: stats?.vehicle_status || 'OFFLINE',
        rating: profile ? Number(profile.rating || 0) : null,
        license_no: profile ? profile.license_no : null,
        verification_status: profile ? profile.verification_status : null,
        vehicle: vehicle || null
    };
}

async function listIncomingRequests(driverId) {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            rr.request_id,
            rr.pickup_location,
            rr.destination,
            rr.requested_at,
            rr.scheduled_for,
            COALESCE(t.fare, rr.estimated_fare) AS fare,
            t.distance_km,
            t.trip_status AS status,
            pu.name AS passenger_name,
            pu.mobile AS passenger_mobile,
            v.vehicle_number,
            v.vehicle_type
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN passenger_profiles pp ON pp.passenger_id = t.passenger_id
        JOIN users pu ON pu.user_id = pp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.driver_id = ?
            AND t.trip_status = 'ASSIGNED'
        ORDER BY rr.requested_at DESC, t.trip_id DESC
    `, [driverId]);

    return rows.map(row => ({
        ...row,
        fare: row.fare == null ? null : Number(row.fare),
        distance_km: row.distance_km == null ? null : Number(row.distance_km)
    }));
}

async function listMyTrips(driverId) {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            rr.request_id,
            rr.pickup_location,
            rr.destination,
            rr.requested_at,
            rr.scheduled_for,
            t.start_time,
            t.end_time,
            COALESCE(t.fare, rr.estimated_fare) AS fare,
            t.distance_km,
            t.trip_status AS status,
            pu.name AS passenger_name,
            pu.mobile AS passenger_mobile,
            v.vehicle_number,
            v.vehicle_type
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN passenger_profiles pp ON pp.passenger_id = t.passenger_id
        JOIN users pu ON pu.user_id = pp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.driver_id = ?
            AND t.trip_status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')
        ORDER BY
            FIELD(t.trip_status, 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
            COALESCE(t.start_time, rr.requested_at) DESC,
            t.trip_id DESC
        LIMIT 40
    `, [driverId]);

    return rows.map(row => ({
        ...row,
        fare: row.fare == null ? null : Number(row.fare),
        distance_km: row.distance_km == null ? null : Number(row.distance_km)
    }));
}

async function acceptTrip(driverId, tripId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(`
            SELECT trip_id, request_id, trip_status
            FROM trips
            WHERE trip_id = ? AND driver_id = ?
            FOR UPDATE
        `, [tripId, driverId]);

        if (!rows.length) {
            throw driverError('Trip not found', 404);
        }

        if (rows[0].trip_status !== 'ASSIGNED') {
            throw driverError('Only assigned trips can be started', 409);
        }

        await connection.query(`
            UPDATE trips
            SET trip_status = 'IN_PROGRESS', start_time = NOW()
            WHERE trip_id = ? AND driver_id = ? AND trip_status = 'ASSIGNED'
        `, [tripId, driverId]);

        await connection.query(`
            UPDATE ride_requests
            SET status = 'ACCEPTED'
            WHERE request_id = ?
        `, [rows[0].request_id]);

        await connection.commit();

        return {
            trip_id: tripId,
            status: 'IN_PROGRESS',
            message: 'Trip started successfully'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function rejectTrip(driverId, tripId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(`
            SELECT trip_id, request_id, vehicle_id, trip_status
            FROM trips
            WHERE trip_id = ? AND driver_id = ?
            FOR UPDATE
        `, [tripId, driverId]);

        if (!rows.length) {
            throw driverError('Trip not found', 404);
        }

        if (rows[0].trip_status !== 'ASSIGNED') {
            throw driverError('Only assigned trips can be declined', 409);
        }

        const trip = rows[0];

        await connection.query(`
            UPDATE trips
            SET trip_status = 'CANCELLED'
            WHERE trip_id = ? AND driver_id = ? AND trip_status = 'ASSIGNED'
        `, [tripId, driverId]);

        await connection.query(`
            UPDATE ride_requests
            SET status = 'REJECTED'
            WHERE request_id = ?
        `, [trip.request_id]);

        await connection.query(`
            UPDATE vehicles AS v
            SET status = 'AVAILABLE'
            WHERE v.vehicle_id = ?
                AND NOT EXISTS (
                    SELECT 1
                    FROM trips active_trip
                    WHERE active_trip.vehicle_id = v.vehicle_id
                        AND active_trip.trip_status IN ('ASSIGNED', 'IN_PROGRESS')
                )
        `, [trip.vehicle_id]);

        await connection.commit();

        return {
            trip_id: tripId,
            status: 'CANCELLED',
            message: 'Trip declined successfully'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function completeTrip(driverId, tripId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(`
            SELECT
                t.trip_id,
                t.request_id,
                t.vehicle_id,
                t.passenger_id,
                t.trip_status,
                COALESCE(t.fare, rr.estimated_fare) AS fare
            FROM trips t
            JOIN ride_requests rr ON rr.request_id = t.request_id
            WHERE t.trip_id = ? AND t.driver_id = ?
            FOR UPDATE
        `, [tripId, driverId]);

        if (!rows.length) {
            throw driverError('Trip not found', 404);
        }

        if (rows[0].trip_status !== 'IN_PROGRESS') {
            throw driverError('Only in-progress trips can be completed', 409);
        }

        const trip = rows[0];
        const fare = Number(trip.fare || 0);

        await connection.query(`
            UPDATE trips
            SET trip_status = 'COMPLETED',
                end_time = NOW(),
                fare = ?
            WHERE trip_id = ? AND driver_id = ? AND trip_status = 'IN_PROGRESS'
        `, [fare, tripId, driverId]);

        await connection.query(`
            UPDATE ride_requests
            SET status = 'COMPLETED'
            WHERE request_id = ?
        `, [trip.request_id]);

        await connection.query(`
            UPDATE vehicles AS v
            SET status = 'AVAILABLE'
            WHERE v.vehicle_id = ?
                AND NOT EXISTS (
                    SELECT 1
                    FROM trips active_trip
                    WHERE active_trip.vehicle_id = v.vehicle_id
                        AND active_trip.trip_status IN ('ASSIGNED', 'IN_PROGRESS')
                )
        `, [trip.vehicle_id]);

        const [payments] = await connection.query(`
            SELECT payment_id
            FROM payments
            WHERE trip_id = ?
            LIMIT 1
            FOR UPDATE
        `, [tripId]);

        if (payments.length) {
            await connection.query(`
                UPDATE payments
                SET amount = ?,
                    payment_status = 'PAID',
                    paid_at = NOW()
                WHERE trip_id = ?
            `, [fare, tripId]);
        } else {
            await connection.query(`
                INSERT INTO payments
                    (trip_id, passenger_id, amount, payment_method, payment_status, paid_at)
                VALUES (?, ?, ?, 'CASH', 'PAID', NOW())
            `, [tripId, trip.passenger_id, fare]);
        }

        await connection.commit();

        return {
            trip_id: tripId,
            status: 'COMPLETED',
            fare,
            message: 'Trip completed successfully'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function setAvailability(driverId, online) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [vehicles] = await connection.query(`
            SELECT vehicle_id, status
            FROM vehicles
            WHERE driver_id = ?
            ORDER BY vehicle_id
            FOR UPDATE
        `, [driverId]);

        if (!vehicles.length) {
            throw driverError('No vehicle is linked to your driver account', 409);
        }

        if (online) {
            const busy = vehicles.some(vehicle => vehicle.status === 'IN_USE');

            if (busy) {
                await connection.commit();
                return {
                    online: true,
                    vehicle_status: 'IN_USE',
                    message: 'You already have an active trip'
                };
            }

            await connection.query(`
                UPDATE vehicles
                SET status = 'AVAILABLE'
                WHERE driver_id = ?
                    AND status IN ('AVAILABLE', 'OFFLINE')
            `, [driverId]);

            await connection.commit();
            return {
                online: true,
                vehicle_status: 'AVAILABLE',
                message: 'You are online and available for rides'
            };
        }

        const busy = vehicles.some(vehicle => vehicle.status === 'IN_USE');
        if (busy) {
            throw driverError('Finish your active trip before going offline', 409);
        }

        await connection.query(`
            UPDATE vehicles
            SET status = 'OFFLINE'
            WHERE driver_id = ?
                AND status IN ('AVAILABLE', 'OFFLINE')
        `, [driverId]);

        await connection.commit();
        return {
            online: false,
            vehicle_status: 'OFFLINE',
            message: 'You are offline'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function listDriverReviews(driverId) {
    const [rows] = await db.query(`
        SELECT
            rr.review_id,
            rr.rating,
            rr.comment,
            rr.created_at,
            u.name AS passenger_name,
            t.trip_id
        FROM ratings_reviews rr
        JOIN driver_profiles dp ON dp.user_id = rr.reviewed_user_id
        JOIN users u ON u.user_id = rr.reviewer_id
        LEFT JOIN trips t ON t.trip_id = rr.trip_id
        WHERE dp.driver_id = ?
        ORDER BY rr.created_at DESC, rr.review_id DESC
    `, [driverId]);

    return rows;
}

async function getDriverVehicle(driverId) {
    const [rows] = await db.query(`
        SELECT vehicle_id, driver_id, vehicle_number, vehicle_type, model, capacity, status
        FROM vehicles
        WHERE driver_id = ?
        LIMIT 1
    `, [driverId]);

    return rows[0] || null;
}

async function updateDriverVehicle(driverId, data) {
    if (!data.vehicle_number || !data.vehicle_type || !data.model) {
        throw driverError('Vehicle number, vehicle type, and model are required', 400);
    }

    const [vehicles] = await db.query(
        'SELECT vehicle_id FROM vehicles WHERE driver_id = ? LIMIT 1',
        [driverId]
    );

    if (vehicles.length) {
        await db.query(`
            UPDATE vehicles
            SET vehicle_number = ?,
                vehicle_type = ?,
                model = ?,
                capacity = ?
            WHERE vehicle_id = ? AND driver_id = ?
        `, [
            String(data.vehicle_number).trim(),
            String(data.vehicle_type).trim(),
            String(data.model).trim(),
            Number(data.capacity || 4),
            vehicles[0].vehicle_id,
            driverId
        ]);

        return { message: 'Vehicle details updated successfully' };
    } else {
        await db.query(`
            INSERT INTO vehicles (driver_id, vehicle_number, vehicle_type, model, capacity, status)
            VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
        `, [
            driverId,
            String(data.vehicle_number).trim(),
            String(data.vehicle_type).trim(),
            String(data.model).trim(),
            Number(data.capacity || 4)
        ]);

        return { message: 'Vehicle registered successfully' };
    }
}

module.exports = {
    requireDriverId,
    getDashboard,
    listIncomingRequests,
    listMyTrips,
    acceptTrip,
    rejectTrip,
    completeTrip,
    setAvailability,
    listDriverReviews,
    getDriverVehicle,
    updateDriverVehicle
};
