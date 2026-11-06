/**
 * scripts/seed.js
 * Unified database seeder for CabFlow Online Cab Booking System.
 * Sets up complete schema and comprehensive seed data for all roles.
 * Run: node scripts/seed.js
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

// Stable scrypt password hash for "Password1!"
// Format: salt:hash (salt is 16 bytes hex, hash is 64 bytes hex)
const DEMO_SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const DEMO_PASSWORD_HASH = `${DEMO_SALT}:${crypto.scryptSync('Password1!', DEMO_SALT, 64).toString('hex')}`;

async function main() {
    console.log('🌱 Starting unified database seed for CabFlow...');
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Ensure scheduled_for column exists in ride_requests
        const [colCheck] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ride_requests' AND COLUMN_NAME = 'scheduled_for'
        `, [process.env.DB_NAME || 'cab_booking']);

        if (!colCheck.length) {
            console.log('➕ Adding scheduled_for column to ride_requests...');
            await conn.query(`
                ALTER TABLE ride_requests
                ADD COLUMN scheduled_for DATETIME NULL DEFAULT NULL AFTER requested_at
            `);
        }

        // 2. Clear existing data in reverse foreign key order
        console.log('🧹 Clearing old tables...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        const tables = [
            'system_logs',
            'admin_permissions',
            'ratings_reviews',
            'payments',
            'trips',
            'ride_requests',
            'vehicles',
            'fare_rules',
            'service_areas',
            'driver_profiles',
            'passenger_profiles',
            'users'
        ];
        for (const t of tables) {
            await conn.query(`TRUNCATE TABLE ${t}`);
        }
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // 3. Seed Users
        // Users 1-8: Passengers
        // Users 9-14: Drivers
        // User 15: Admin
        // User 16: Super Admin
        console.log('👤 Seeding users...');
        const users = [
            // Passengers
            [1, 'Aarav Kumar', 'aarav@example.com', DEMO_PASSWORD_HASH, '9000000001', 'PASSENGER', 'ACTIVE'],
            [2, 'Diya Sharma', 'diya@example.com', DEMO_PASSWORD_HASH, '9000000002', 'PASSENGER', 'ACTIVE'],
            [3, 'Ishaan Rao', 'ishaan@example.com', DEMO_PASSWORD_HASH, '9000000003', 'PASSENGER', 'ACTIVE'],
            [4, 'Meera Iyer', 'meera@example.com', DEMO_PASSWORD_HASH, '9000000004', 'PASSENGER', 'ACTIVE'],
            [5, 'Kabir Das', 'kabir@example.com', DEMO_PASSWORD_HASH, '9000000005', 'PASSENGER', 'ACTIVE'],
            [6, 'Sneha Pillai', 'sneha@example.com', DEMO_PASSWORD_HASH, '9000000006', 'PASSENGER', 'ACTIVE'],
            [7, 'Rohan Verma', 'rohan@example.com', DEMO_PASSWORD_HASH, '9000000007', 'PASSENGER', 'ACTIVE'],
            [8, 'Deepa Krishnan', 'deepa@example.com', DEMO_PASSWORD_HASH, '9000000008', 'PASSENGER', 'ACTIVE'],

            // Drivers
            [9, 'Vikram Singh', 'vikram@example.com', DEMO_PASSWORD_HASH, '9000000009', 'DRIVER', 'ACTIVE'],
            [10, 'Ananya Nair', 'ananya@example.com', DEMO_PASSWORD_HASH, '9000000010', 'DRIVER', 'ACTIVE'],
            [11, 'Rahul Menon', 'rahul@example.com', DEMO_PASSWORD_HASH, '9000000011', 'DRIVER', 'ACTIVE'],
            [12, 'Priya Shah', 'priya@example.com', DEMO_PASSWORD_HASH, '9000000012', 'DRIVER', 'ACTIVE'],
            [13, 'Arjun Patel', 'arjun@example.com', DEMO_PASSWORD_HASH, '9000000013', 'DRIVER', 'ACTIVE'],
            [14, 'Karthik Raja', 'karthik@example.com', DEMO_PASSWORD_HASH, '9000000014', 'DRIVER', 'ACTIVE'],

            // Administrators
            [15, 'Admin Demo', 'admin@example.com', DEMO_PASSWORD_HASH, '9000000015', 'ADMIN', 'ACTIVE'],
            [16, 'Super Admin Demo', 'superadmin@example.com', DEMO_PASSWORD_HASH, '9000000016', 'SUPER ADMIN', 'ACTIVE']
        ];
        await conn.query(`
            INSERT INTO users (user_id, name, email, password, mobile, role, status)
            VALUES ?
        `, [users]);

        // 4. Passenger Profiles (passenger_id 1-8)
        console.log('🎒 Seeding passenger profiles...');
        const passengerProfiles = [
            [1, 1, 'Adyar, Chennai, Tamil Nadu', '9111111111'],
            [2, 2, 'Velachery, Chennai, Tamil Nadu', '9222222222'],
            [3, 3, 'T Nagar, Chennai, Tamil Nadu', '9333333333'],
            [4, 4, 'Anna Nagar, Chennai, Tamil Nadu', '9444444444'],
            [5, 5, 'Guindy, Chennai, Tamil Nadu', '9555555555'],
            [6, 6, 'Mylapore, Chennai, Tamil Nadu', '9666666666'],
            [7, 7, 'Porur, Chennai, Tamil Nadu', '9777777777'],
            [8, 8, 'Thiruvanmiyur, Chennai, Tamil Nadu', '9888888888']
        ];
        await conn.query(`
            INSERT INTO passenger_profiles (passenger_id, user_id, default_address, emergency_contact)
            VALUES ?
        `, [passengerProfiles]);

        // 5. Driver Profiles (driver_id 1-6)
        console.log('🚘 Seeding driver profiles...');
        const driverProfiles = [
            [1, 9, 'TN-DL-10001', '2028-05-31', 'APPROVED', 4.85],
            [2, 10, 'TN-DL-10002', '2029-02-28', 'APPROVED', 4.70],
            [3, 11, 'TN-DL-10003', '2027-11-30', 'APPROVED', 4.60],
            [4, 12, 'TN-DL-10004', '2028-08-31', 'APPROVED', 4.50],
            [5, 13, 'TN-DL-10005', '2029-01-31', 'APPROVED', 4.40],
            [6, 14, 'TN-DL-10006', '2028-12-31', 'APPROVED', 4.75]
        ];
        await conn.query(`
            INSERT INTO driver_profiles (driver_id, user_id, license_no, license_expiry, verification_status, rating)
            VALUES ?
        `, [driverProfiles]);

        // 6. Service Areas
        console.log('🗺️ Seeding service areas...');
        const serviceAreas = [
            [1, 'Adyar', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [2, 'Velachery', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [3, 'T Nagar', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [4, 'Anna Nagar', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [5, 'Guindy', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [6, 'OMR', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [7, 'Tambaram', 'Chennai', 'Tamil Nadu', 'ACTIVE'],
            [8, 'Mylapore', 'Chennai', 'Tamil Nadu', 'INACTIVE']
        ];
        await conn.query(`
            INSERT INTO service_areas (area_id, area_name, city, state, status)
            VALUES ?
        `, [serviceAreas]);

        // 7. Fare Rules
        console.log('💵 Seeding fare rules...');
        const fareRules = [
            [1, 'Mini', 50.00, 12.00, 1.00, 30.00, 'ACTIVE'],
            [2, 'Sedan', 80.00, 15.00, 1.50, 40.00, 'ACTIVE'],
            [3, 'SUV', 120.00, 20.00, 2.00, 50.00, 'ACTIVE'],
            [4, 'Auto', 30.00, 9.00, 0.50, 20.00, 'ACTIVE'],
            [5, 'Premium', 150.00, 25.00, 2.50, 60.00, 'ACTIVE']
        ];
        await conn.query(`
            INSERT INTO fare_rules (fare_id, vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status)
            VALUES ?
        `, [fareRules]);

        // 8. Vehicles
        console.log('🚗 Seeding vehicles...');
        const vehicles = [
            [1, 1, 'TN01AB1001', 'Sedan', 'Maruti Dzire', 4, 'AVAILABLE'],
            [2, 2, 'TN01AB1002', 'Mini', 'Hyundai i10', 4, 'AVAILABLE'],
            [3, 3, 'TN01AB1003', 'SUV', 'Kia Seltos', 5, 'IN_USE'],
            [4, 4, 'TN01AB1004', 'Auto', 'Bajaj RE Auto', 3, 'AVAILABLE'],
            [5, 5, 'TN01AB1005', 'Premium', 'Honda City', 4, 'AVAILABLE'],
            [6, 6, 'TN01AB1006', 'Sedan', 'Hyundai Verna', 4, 'AVAILABLE']
        ];
        await conn.query(`
            INSERT INTO vehicles (vehicle_id, driver_id, vehicle_number, vehicle_type, model, capacity, status)
            VALUES ?
        `, [vehicles]);

        // 9. Ride Requests & Trips
        // Mix of:
        // - IN_PROGRESS active trip (Trip 1)
        // - ASSIGNED active trip (Trip 2)
        // - Scheduled upcoming trips (Trips 3 & 4)
        // - Completed past trips with reviews (Trips 5, 6, 8, 9)
        // - Completed trip without review for testing review flow (Trip 7)
        // - Cancelled trips (Trips 10 & 11)
        console.log('📍 Seeding ride requests and trips...');

        // Ride requests (request_id, passenger_id, pickup_location, destination, requested_at, scheduled_for, estimated_fare, status)
        await conn.query(`
            INSERT INTO ride_requests (request_id, passenger_id, pickup_location, destination, requested_at, scheduled_for, estimated_fare, status)
            VALUES
            -- 1. Active ongoing ride (Passenger 1)
            (1, 1, 'IIT Madras, Adyar, Chennai', 'Phoenix Marketcity, Velachery, Chennai', NOW() - INTERVAL 25 MINUTE, NULL, 280.00, 'ACCEPTED'),

            -- 2. Active assigned ride (Passenger 2)
            (2, 2, 'Velachery MRTS, Chennai', 'T Nagar, Chennai', NOW() - INTERVAL 10 MINUTE, NULL, 220.00, 'ACCEPTED'),

            -- 3. Scheduled trip for Passenger 1 (tomorrow morning)
            (3, 1, 'Adyar, Chennai', 'Chennai International Airport, Meenambakkam', NOW() - INTERVAL 2 HOUR, NOW() + INTERVAL 1 DAY, 420.00, 'ACCEPTED'),

            -- 4. Scheduled trip for Passenger 2 (in 4 hours)
            (4, 2, 'T Nagar, Chennai', 'Chennai Central Railway Station, Chennai', NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 4 HOUR, 310.00, 'ACCEPTED'),

            -- 5. Completed trip for Passenger 1 (3 days ago)
            (5, 1, 'Adyar, Chennai', 'Marina Beach, Triplicane, Chennai', NOW() - INTERVAL 3 DAY, NULL, 215.00, 'COMPLETED'),

            -- 6. Completed trip for Passenger 1 (2 days ago)
            (6, 1, 'Guindy, Chennai', 'Anna Nagar, Chennai', NOW() - INTERVAL 2 DAY, NULL, 340.00, 'COMPLETED'),

            -- 7. Completed trip for Passenger 1 (yesterday) - unreviewed!
            (7, 1, 'Adyar, Chennai', 'T Nagar Bus Stand, Chennai', NOW() - INTERVAL 1 DAY, NULL, 185.00, 'COMPLETED'),

            -- 8. Completed trip for Passenger 2 (4 days ago)
            (8, 2, 'Velachery, Chennai', 'Besant Nagar Beach, Chennai', NOW() - INTERVAL 4 DAY, NULL, 190.00, 'COMPLETED'),

            -- 9. Completed trip for Passenger 3 (5 days ago)
            (9, 3, 'Anna University, Guindy, Chennai', 'Central Station, Chennai', NOW() - INTERVAL 5 DAY, NULL, 295.00, 'COMPLETED'),

            -- 10. Cancelled trip for Passenger 1 (last week)
            (10, 1, 'Porur, Chennai', 'Vadapalani, Chennai', NOW() - INTERVAL 6 DAY, NULL, 160.00, 'CANCELLED'),

            -- 11. Cancelled trip for Passenger 4 (last week)
            (11, 4, 'Tambaram, Chennai', 'Pallavaram, Chennai', NOW() - INTERVAL 7 DAY, NULL, 130.00, 'CANCELLED')
        `);

        // Trips (trip_id, request_id, passenger_id, driver_id, vehicle_id, start_time, end_time, distance_km, fare, trip_status)
        await conn.query(`
            INSERT INTO trips (trip_id, request_id, passenger_id, driver_id, vehicle_id, start_time, end_time, distance_km, fare, trip_status)
            VALUES
            -- 1. Active ongoing trip
            (1, 1, 1, 3, 3, NOW() - INTERVAL 15 MINUTE, NULL, 8.00, 280.00, 'IN_PROGRESS'),

            -- 2. Active assigned trip
            (2, 2, 2, 1, 1, NULL, NULL, 9.50, 220.00, 'ASSIGNED'),

            -- 3. Scheduled trip (Passenger 1)
            (3, 3, 1, 2, 2, NULL, NULL, 16.00, 420.00, 'ASSIGNED'),

            -- 4. Scheduled trip (Passenger 2)
            (4, 4, 2, 4, 4, NULL, NULL, 12.00, 310.00, 'ASSIGNED'),

            -- 5. Completed trip 1
            (5, 5, 1, 1, 1, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY + INTERVAL 30 MINUTE, 9.00, 215.00, 'COMPLETED'),

            -- 6. Completed trip 2
            (6, 6, 1, 5, 5, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 45 MINUTE, 14.50, 340.00, 'COMPLETED'),

            -- 7. Completed trip 3 (unreviewed)
            (7, 7, 1, 6, 6, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY + INTERVAL 25 MINUTE, 7.00, 185.00, 'COMPLETED'),

            -- 8. Completed trip 4
            (8, 8, 2, 2, 2, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY + INTERVAL 28 MINUTE, 8.50, 190.00, 'COMPLETED'),

            -- 9. Completed trip 5
            (9, 9, 3, 1, 1, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY + INTERVAL 40 MINUTE, 13.00, 295.00, 'COMPLETED'),

            -- 10. Cancelled trip 1
            (10, 10, 1, 1, 1, NULL, NULL, NULL, NULL, 'CANCELLED'),

            -- 11. Cancelled trip 2
            (11, 11, 4, 4, 4, NULL, NULL, NULL, NULL, 'CANCELLED')
        `);

        // 10. Payments
        console.log('💳 Seeding payments...');
        await conn.query(`
            INSERT INTO payments (payment_id, trip_id, passenger_id, amount, payment_method, payment_status, paid_at)
            VALUES
            (1, 1, 1, 280.00, 'UPI', 'PENDING', NULL),
            (2, 2, 2, 220.00, 'CASH', 'PENDING', NULL),
            (3, 3, 1, 420.00, 'UPI', 'PENDING', NULL),
            (4, 4, 2, 310.00, 'CARD', 'PENDING', NULL),
            (5, 5, 1, 215.00, 'UPI', 'PAID', NOW() - INTERVAL 3 DAY),
            (6, 6, 1, 340.00, 'CARD', 'PAID', NOW() - INTERVAL 2 DAY),
            (7, 7, 1, 185.00, 'CASH', 'PAID', NOW() - INTERVAL 1 DAY),
            (8, 8, 2, 190.00, 'UPI', 'PAID', NOW() - INTERVAL 4 DAY),
            (9, 9, 3, 295.00, 'ONLINE', 'PAID', NOW() - INTERVAL 5 DAY),
            (10, 10, 1, 160.00, 'CASH', 'REFUNDED', NOW() - INTERVAL 6 DAY),
            (11, 11, 4, 130.00, 'ONLINE', 'REFUNDED', NOW() - INTERVAL 7 DAY)
        `);

        // 11. Ratings & Reviews
        // Reviewed users correspond to the driver's user_id:
        // Driver 1 (Vikram) -> user_id 9
        // Driver 2 (Ananya) -> user_id 10
        // Driver 5 (Arjun)  -> user_id 13
        console.log('⭐ Seeding reviews...');
        await conn.query(`
            INSERT INTO ratings_reviews (review_id, trip_id, reviewer_id, reviewed_user_id, rating, comment)
            VALUES
            (1, 5, 1, 9, 5, 'Excellent driving and very polite! The car was clean.'),
            (2, 6, 1, 13, 4, 'Comfortable sedan ride, arrived promptly at pickup.'),
            (3, 8, 2, 10, 5, 'Smooth and safe trip, appreciated the friendly driver.'),
            (4, 9, 3, 9, 5, 'Great experience, reached my destination ahead of schedule.')
        `);

        // 12. Admin Permissions & System Logs
        console.log('🛡️ Seeding admin permissions & system logs...');
        await conn.query(`
            INSERT INTO admin_permissions (permission_id, admin_id, permission_name)
            VALUES
            (1, 15, 'VIEW_DASHBOARD'),
            (2, 15, 'MANAGE_PASSENGERS'),
            (3, 15, 'MANAGE_DRIVERS'),
            (4, 15, 'MANAGE_VEHICLES'),
            (5, 15, 'VIEW_REPORTS'),
            (6, 16, 'MANAGE_ADMINS'),
            (7, 16, 'SYSTEM_SETTINGS'),
            (8, 16, 'ALL_PERMISSIONS')
        `);

        await conn.query(`
            INSERT INTO system_logs (log_id, user_id, action, description, ip_address)
            VALUES
            (1, 15, 'ADMIN_LOGIN', 'Admin signed in to dashboard', '127.0.0.1'),
            (2, 15, 'VIEW_BOOKINGS', 'Reviewed active bookings overview', '127.0.0.1'),
            (3, 16, 'SYSTEM_CHECK', 'Super admin verified system permissions and health', '127.0.0.1'),
            (4, 1, 'PASSENGER_LOGIN', 'Passenger Aarav Kumar signed in', '127.0.0.1'),
            (5, 1, 'BOOK_RIDE', 'Booked ride from IIT Madras to Phoenix Marketcity', '127.0.0.1')
        `);

        await conn.commit();
        console.log('\n✅ All data successfully seeded and unified!');
        console.log('----------------------------------------------------');
        console.log('Demo Login Credentials (all passwords: Password1!):');
        console.log('• Passenger:   aarav@example.com (or diya@example.com)');
        console.log('• Driver:      vikram@example.com');
        console.log('• Admin:       admin@example.com');
        console.log('• Super Admin: superadmin@example.com');
        console.log('----------------------------------------------------');
    } catch (error) {
        await conn.rollback();
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        conn.release();
        await db.end();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

