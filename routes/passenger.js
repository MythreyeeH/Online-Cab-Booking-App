const db = require('../db');
const geocodingEndpoint =
    process.env.GEOCODING_URL || 'https://nominatim.openstreetmap.org/search';
const geocodingCache = new Map();
const pendingGeocodes = new Map();
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;
const GEOCODING_CACHE_LIMIT = 500;
const GEOCODING_REQUEST_INTERVAL_MS = 1000;

function required(value, field) {
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`${field} is required`);
    }

    return String(value).trim();
}

function coordinate(value, field, minimum, maximum) {
    const number = Number(required(value, field));

    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        throw new Error(`${field} must be between ${minimum} and ${maximum}`);
    }

    return number;
}

function geocodingError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function cacheGeocode(key, result) {
    if (geocodingCache.size >= GEOCODING_CACHE_LIMIT) {
        const oldestKey = geocodingCache.keys().next().value;
        geocodingCache.delete(oldestKey);
    }

    geocodingCache.set(key, result);
}

function geocodePlace(query, field) {
    const cacheKey = query.toLocaleLowerCase();

    if (geocodingCache.has(cacheKey)) {
        return Promise.resolve(geocodingCache.get(cacheKey));
    }

    if (pendingGeocodes.has(cacheKey)) {
        return pendingGeocodes.get(cacheKey);
    }

    const lookup = geocodingQueue.then(async () => {
        const waitMs = Math.max(
            0,
            GEOCODING_REQUEST_INTERVAL_MS - (Date.now() - lastGeocodingRequestAt)
        );

        if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }

        lastGeocodingRequestAt = Date.now();

        const url = new URL(geocodingEndpoint);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        url.searchParams.set('countrycodes', 'in');

        let response;

        try {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'CabFlow-Online-Cab-Booking-App/1.0 (https://github.com/MythreyeeH/Online-Cab-Booking-App)'
                },
                signal: AbortSignal.timeout(10000)
            });
        } catch (error) {
            throw geocodingError(
                `Could not look up the ${field} location. Check your internet connection and try again.`,
                502
            );
        }

        if (response.status === 429) {
            throw geocodingError(
                'Location search is temporarily busy. Please wait a moment and try again.',
                503
            );
        }

        if (!response.ok) {
            throw geocodingError(
                'The location search service is temporarily unavailable. Please try again.',
                502
            );
        }

        let results;

        try {
            results = await response.json();
        } catch (error) {
            throw geocodingError(
                'The location search service returned an invalid response. Please try again.',
                502
            );
        }

        const result = Array.isArray(results) && results.length
            ? {
                display_name: String(results[0].display_name || query),
                latitude: Number(results[0].lat),
                longitude: Number(results[0].lon)
            }
            : null;

        if (
            result &&
            (!Number.isFinite(result.latitude) ||
                !Number.isFinite(result.longitude) ||
                result.latitude < -90 ||
                result.latitude > 90 ||
                result.longitude < -180 ||
                result.longitude > 180)
        ) {
            throw geocodingError(
                'The location search service returned invalid coordinates. Please try again.',
                502
            );
        }

        cacheGeocode(cacheKey, result);
        return result;
    });

    geocodingQueue = lookup.then(
        () => undefined,
        () => undefined
    );
    pendingGeocodes.set(cacheKey, lookup);
    lookup.then(
        () => pendingGeocodes.delete(cacheKey),
        () => pendingGeocodes.delete(cacheKey)
    );

    return lookup;
}

async function searchAvailableCabs(search) {
    const pickupLocation = required(search.pickup_location, 'Pickup location');
    const destination = required(search.destination, 'Destination');

    if (pickupLocation.length > 255) {
        throw new Error('Pickup location must be 255 characters or fewer');
    }

    if (destination.length > 255) {
        throw new Error('Destination must be 255 characters or fewer');
    }

    const pickup = await geocodePlace(pickupLocation, 'pickup');
    if (!pickup) {
        throw geocodingError(
            'Could not find the pickup place. Add a city or nearby landmark and try again.',
            422
        );
    }

    const destinationResult = await geocodePlace(destination, 'destination');
    if (!destinationResult) {
        throw geocodingError(
            'Could not find the destination. Add a city or nearby landmark and try again.',
            422
        );
    }

    const pickupLatitude = coordinate(pickup.latitude, 'Pickup latitude', -90, 90);
    const pickupLongitude = coordinate(pickup.longitude, 'Pickup longitude', -180, 180);
    const destinationLatitude = coordinate(destinationResult.latitude, 'Destination latitude', -90, 90);
    const destinationLongitude = coordinate(destinationResult.longitude, 'Destination longitude', -180, 180);

    const toRadians = degrees => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(destinationLatitude - pickupLatitude);
    const longitudeDifference = toRadians(destinationLongitude - pickupLongitude);
    const haversine = Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(toRadians(pickupLatitude)) *
        Math.cos(toRadians(destinationLatitude)) *
        Math.sin(longitudeDifference / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(
        Math.sqrt(haversine),
        Math.sqrt(1 - haversine)
    );

    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 500) {
        throw new Error('Pickup and destination must be different and no more than 500 km apart');
    }

    const roundedDistanceKm = Math.round(distanceKm * 100) / 100;

    const [rows] = await db.query(`
        SELECT
            v.vehicle_id,
            v.vehicle_number,
            v.vehicle_type,
            v.model,
            v.capacity,
            dp.driver_id,
            u.name AS driver_name,
            dp.rating AS driver_rating,
            fr.base_fare,
            fr.per_km_rate,
            ROUND(fr.base_fare + (fr.per_km_rate * ?), 2) AS estimated_fare
        FROM vehicles v
        JOIN driver_profiles dp ON dp.driver_id = v.driver_id
        JOIN users u ON u.user_id = dp.user_id
        JOIN fare_rules fr
            ON LOWER(fr.vehicle_type) = LOWER(v.vehicle_type)
            AND fr.status = 'ACTIVE'
        WHERE v.status = 'AVAILABLE'
            AND dp.verification_status = 'APPROVED'
            AND u.status = 'ACTIVE'
            AND NOT EXISTS (
                SELECT 1
                FROM trips t
                WHERE t.vehicle_id = v.vehicle_id
                    AND t.trip_status IN ('ASSIGNED', 'IN_PROGRESS')
            )
        ORDER BY estimated_fare ASC, v.vehicle_id ASC
    `, [roundedDistanceKm]);

    return {
        pickup_location: pickup.display_name,
        destination: destinationResult.display_name,
        pickup_coordinates: {
            latitude: pickupLatitude,
            longitude: pickupLongitude
        },
        destination_coordinates: {
            latitude: destinationLatitude,
            longitude: destinationLongitude
        },
        distance_km: roundedDistanceKm,
        vehicles: rows.map(vehicle => ({
            ...vehicle,
            driver_rating: Number(vehicle.driver_rating),
            base_fare: Number(vehicle.base_fare),
            per_km_rate: Number(vehicle.per_km_rate),
            estimated_fare: Number(vehicle.estimated_fare)
        }))
    };
}

async function createBooking(passengerId, data) {
    const pickupLocation = required(data.pickup_location, 'Pickup location');
    const destination = required(data.destination, 'Destination');
    const vehicleId = Number(data.vehicle_id);

    if (pickupLocation.length > 255 || destination.length > 255) {
        throw new Error('Pickup and destination must be 255 characters or fewer');
    }

    if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) {
        throw new Error('Select a valid cab');
    }

    const pickup = await geocodePlace(pickupLocation, 'pickup');
    if (!pickup) {
        throw geocodingError(
            'Could not find the pickup place. Add a city or nearby landmark and try again.',
            422
        );
    }

    const destinationResult = await geocodePlace(destination, 'destination');
    if (!destinationResult) {
        throw geocodingError(
            'Could not find the destination. Add a city or nearby landmark and try again.',
            422
        );
    }

    const pickupLatitude = coordinate(pickup.latitude, 'Pickup latitude', -90, 90);
    const pickupLongitude = coordinate(pickup.longitude, 'Pickup longitude', -180, 180);
    const destinationLatitude = coordinate(destinationResult.latitude, 'Destination latitude', -90, 90);
    const destinationLongitude = coordinate(destinationResult.longitude, 'Destination longitude', -180, 180);
    const toRadians = degrees => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(destinationLatitude - pickupLatitude);
    const longitudeDifference = toRadians(destinationLongitude - pickupLongitude);
    const haversine = Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(toRadians(pickupLatitude)) *
        Math.cos(toRadians(destinationLatitude)) *
        Math.sin(longitudeDifference / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(
        Math.sqrt(haversine),
        Math.sqrt(1 - haversine)
    );

    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 500) {
        throw new Error('Pickup and destination must be different and no more than 500 km apart');
    }

    const roundedDistanceKm = Math.round(distanceKm * 100) / 100;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [vehicles] = await connection.query(`
            SELECT
                v.vehicle_id,
                v.driver_id,
                v.vehicle_type,
                dp.user_id AS driver_user_id,
                u.name AS driver_name,
                fr.base_fare,
                fr.per_km_rate
            FROM vehicles v
            JOIN driver_profiles dp ON dp.driver_id = v.driver_id
            JOIN users u ON u.user_id = dp.user_id
            JOIN fare_rules fr
                ON LOWER(fr.vehicle_type) = LOWER(v.vehicle_type)
                AND fr.status = 'ACTIVE'
            WHERE v.vehicle_id = ?
                AND v.status = 'AVAILABLE'
                AND dp.verification_status = 'APPROVED'
                AND u.status = 'ACTIVE'
            FOR UPDATE
        `, [vehicleId]);

        if (!vehicles.length) {
            const error = new Error('That cab is no longer available. Search again to see available cabs.');
            error.statusCode = 409;
            throw error;
        }

        const vehicle = vehicles[0];
        const [activeTrips] = await connection.query(`
            SELECT trip_id
            FROM trips
            WHERE vehicle_id = ?
                AND trip_status IN ('ASSIGNED', 'IN_PROGRESS')
            LIMIT 1
            FOR UPDATE
        `, [vehicleId]);

        if (activeTrips.length) {
            const error = new Error('That cab is already assigned to another trip. Search again.');
            error.statusCode = 409;
            throw error;
        }

        const fare = Math.round(
            (Number(vehicle.base_fare) + Number(vehicle.per_km_rate) * roundedDistanceKm) * 100
        ) / 100;

        const [requestResult] = await connection.query(`
            INSERT INTO ride_requests
                (passenger_id, pickup_location, destination, estimated_fare, status)
            VALUES (?, ?, ?, ?, 'ACCEPTED')
        `, [
            passengerId,
            pickup.display_name,
            destinationResult.display_name,
            fare
        ]);

        const [tripResult] = await connection.query(`
            INSERT INTO trips
                (request_id, passenger_id, driver_id, vehicle_id,
                    distance_km, fare, trip_status)
            VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNED')
        `, [
            requestResult.insertId,
            passengerId,
            vehicle.driver_id,
            vehicleId,
            roundedDistanceKm,
            fare
        ]);

        await connection.query(`
            UPDATE vehicles
            SET status = 'IN_USE'
            WHERE vehicle_id = ?
        `, [vehicleId]);

        await connection.commit();

        return {
            trip_id: tripResult.insertId,
            request_id: requestResult.insertId,
            pickup_location: pickup.display_name,
            destination: destinationResult.display_name,
            driver_name: vehicle.driver_name,
            distance_km: roundedDistanceKm,
            fare,
            status: 'ASSIGNED',
            message: 'Cab booked successfully'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function listActiveTrips(passengerId) {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            rr.request_id,
            rr.pickup_location,
            rr.destination,
            rr.requested_at,
            t.trip_status AS status,
            t.distance_km,
            COALESCE(t.fare, rr.estimated_fare) AS fare,
            du.name AS driver_name,
            du.mobile AS driver_mobile,
            dp.rating AS driver_rating,
            v.vehicle_number,
            v.vehicle_type,
            v.model
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN driver_profiles dp ON dp.driver_id = t.driver_id
        JOIN users du ON du.user_id = dp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.passenger_id = ?
            AND t.trip_status IN ('ASSIGNED', 'IN_PROGRESS')
        ORDER BY t.trip_id DESC
    `, [passengerId]);

    return rows;
}

async function cancelBooking(passengerId, tripId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(`
            SELECT trip_id, request_id, vehicle_id, trip_status
            FROM trips
            WHERE trip_id = ?
                AND passenger_id = ?
            FOR UPDATE
        `, [tripId, passengerId]);

        if (!rows.length) {
            const error = new Error('Booking not found');
            error.statusCode = 404;
            throw error;
        }

        const trip = rows[0];

        if (trip.trip_status !== 'ASSIGNED') {
            const error = new Error('Only assigned bookings that have not started can be cancelled');
            error.statusCode = 409;
            throw error;
        }

        await connection.query(`
            UPDATE trips
            SET trip_status = 'CANCELLED'
            WHERE trip_id = ?
                AND passenger_id = ?
                AND trip_status = 'ASSIGNED'
        `, [tripId, passengerId]);

        await connection.query(`
            UPDATE ride_requests
            SET status = 'CANCELLED'
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
            message: 'Booking cancelled successfully'
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function listTripHistory(passengerId, userId) {
    const [rows] = await db.query(`
        SELECT
            t.trip_id,
            rr.request_id,
            rr.pickup_location,
            rr.destination,
            rr.requested_at,
            t.start_time,
            t.end_time,
            t.distance_km,
            COALESCE(t.fare, rr.estimated_fare) AS fare,
            t.trip_status AS status,
            du.name AS driver_name,
            v.vehicle_number,
            v.vehicle_type,
            review.review_id,
            review.rating AS passenger_rating,
            review.comment AS passenger_review
        FROM trips t
        JOIN ride_requests rr ON rr.request_id = t.request_id
        JOIN driver_profiles dp ON dp.driver_id = t.driver_id
        JOIN users du ON du.user_id = dp.user_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        LEFT JOIN ratings_reviews review
            ON review.trip_id = t.trip_id
            AND review.reviewer_id = ?
        WHERE t.passenger_id = ?
            AND t.trip_status IN ('COMPLETED', 'CANCELLED')
        ORDER BY COALESCE(t.end_time, rr.requested_at) DESC, t.trip_id DESC
    `, [userId, passengerId]);

    return rows.map(trip => ({
        ...trip,
        fare: trip.fare == null ? null : Number(trip.fare),
        distance_km: trip.distance_km == null ? null : Number(trip.distance_km),
        can_review: trip.status === 'COMPLETED' && trip.review_id == null
    }));
}

async function reviewTrip(passengerId, userId, tripId, data) {
    const rating = Number(data.rating);
    const comment = data.comment == null ? '' : String(data.comment).trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be a whole number from 1 to 5');
    }

    if (comment.length > 1000) {
        throw new Error('Review must be 1000 characters or fewer');
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [trips] = await connection.query(`
            SELECT t.trip_id, dp.user_id AS driver_user_id
            FROM trips t
            JOIN driver_profiles dp ON dp.driver_id = t.driver_id
            WHERE t.trip_id = ?
                AND t.passenger_id = ?
                AND t.trip_status = 'COMPLETED'
            FOR UPDATE
        `, [tripId, passengerId]);

        if (!trips.length) {
            const error = new Error('Completed trip not found');
            error.statusCode = 404;
            throw error;
        }

        const trip = trips[0];
        const [existingReviews] = await connection.query(`
            SELECT review_id
            FROM ratings_reviews
            WHERE trip_id = ?
                AND reviewer_id = ?
            LIMIT 1
            FOR UPDATE
        `, [tripId, userId]);

        if (existingReviews.length) {
            const error = new Error('You have already reviewed this trip');
            error.statusCode = 409;
            throw error;
        }

        await connection.query(`
            INSERT INTO ratings_reviews
                (trip_id, reviewer_id, reviewed_user_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `, [
            tripId,
            userId,
            trip.driver_user_id,
            rating,
            comment || null
        ]);

        await connection.query(`
            UPDATE driver_profiles
            SET rating = (
                SELECT COALESCE(AVG(rating), 0)
                FROM ratings_reviews
                WHERE reviewed_user_id = ?
            )
            WHERE user_id = ?
        `, [trip.driver_user_id, trip.driver_user_id]);

        await connection.commit();

        return {
            trip_id: tripId,
            rating,
            message: 'Review submitted successfully'
        };
    } catch (error) {
        await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY') {
            const duplicateReview = new Error('You have already reviewed this trip');
            duplicateReview.statusCode = 409;
            throw duplicateReview;
        }

        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    searchAvailableCabs,
    createBooking,
    listActiveTrips,
    cancelBooking,
    listTripHistory,
    reviewTrip
};
