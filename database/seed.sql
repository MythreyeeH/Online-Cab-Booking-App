USE cab_booking;

-- CabFlow Unified Seed Data
-- Demo passwords for all seeded accounts: Password1!
-- Scrypt hash format: salt:hash (scryptSync 64-byte key)
-- Generated with salt: a1b2c3d4e5f60718293a4b5c6d7e8f90

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE system_logs;
TRUNCATE TABLE admin_permissions;
TRUNCATE TABLE ratings_reviews;
TRUNCATE TABLE payments;
TRUNCATE TABLE trips;
TRUNCATE TABLE ride_requests;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE fare_rules;
TRUNCATE TABLE service_areas;
TRUNCATE TABLE driver_profiles;
TRUNCATE TABLE passenger_profiles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users
INSERT INTO users (user_id, name, email, password, mobile, role, status) VALUES
(1, 'Aarav Kumar', 'aarav@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000001', 'PASSENGER', 'ACTIVE'),
(2, 'Diya Sharma', 'diya@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000002', 'PASSENGER', 'ACTIVE'),
(3, 'Ishaan Rao', 'ishaan@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000003', 'PASSENGER', 'ACTIVE'),
(4, 'Meera Iyer', 'meera@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000004', 'PASSENGER', 'ACTIVE'),
(5, 'Kabir Das', 'kabir@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000005', 'PASSENGER', 'ACTIVE'),
(6, 'Sneha Pillai', 'sneha@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000006', 'PASSENGER', 'ACTIVE'),
(7, 'Rohan Verma', 'rohan@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000007', 'PASSENGER', 'ACTIVE'),
(8, 'Deepa Krishnan', 'deepa@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000008', 'PASSENGER', 'ACTIVE'),
(9, 'Vikram Singh', 'vikram@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000009', 'DRIVER', 'ACTIVE'),
(10, 'Ananya Nair', 'ananya@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000010', 'DRIVER', 'ACTIVE'),
(11, 'Rahul Menon', 'rahul@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000011', 'DRIVER', 'ACTIVE'),
(12, 'Priya Shah', 'priya@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000012', 'DRIVER', 'ACTIVE'),
(13, 'Arjun Patel', 'arjun@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000013', 'DRIVER', 'ACTIVE'),
(14, 'Karthik Raja', 'karthik@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000014', 'DRIVER', 'ACTIVE'),
(15, 'Admin Demo', 'admin@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000015', 'ADMIN', 'ACTIVE'),
(16, 'Super Admin Demo', 'superadmin@example.com', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:1ce9268cac6583cca3227e492c02dc9d87687d9b74a4727684c713b43ef9b57277ac2531ae90df859bcb35ce6660182664333c202b96a378d3fd1d8b28f29ebd', '9000000016', 'SUPER ADMIN', 'ACTIVE');

-- 2. Passenger Profiles
INSERT INTO passenger_profiles (passenger_id, user_id, default_address, emergency_contact) VALUES
(1, 1, 'Adyar, Chennai, Tamil Nadu', '9111111111'),
(2, 2, 'Velachery, Chennai, Tamil Nadu', '9222222222'),
(3, 3, 'T Nagar, Chennai, Tamil Nadu', '9333333333'),
(4, 4, 'Anna Nagar, Chennai, Tamil Nadu', '9444444444'),
(5, 5, 'Guindy, Chennai, Tamil Nadu', '9555555555'),
(6, 6, 'Mylapore, Chennai, Tamil Nadu', '9666666666'),
(7, 7, 'Porur, Chennai, Tamil Nadu', '9777777777'),
(8, 8, 'Thiruvanmiyur, Chennai, Tamil Nadu', '9888888888');

-- 3. Driver Profiles
INSERT INTO driver_profiles (driver_id, user_id, license_no, license_expiry, verification_status, rating) VALUES
(1, 9, 'TN-DL-10001', '2028-05-31', 'APPROVED', 4.85),
(2, 10, 'TN-DL-10002', '2029-02-28', 'APPROVED', 4.70),
(3, 11, 'TN-DL-10003', '2027-11-30', 'APPROVED', 4.60),
(4, 12, 'TN-DL-10004', '2028-08-31', 'APPROVED', 4.50),
(5, 13, 'TN-DL-10005', '2029-01-31', 'APPROVED', 4.40),
(6, 14, 'TN-DL-10006', '2028-12-31', 'APPROVED', 4.75);

-- 4. Service Areas
INSERT INTO service_areas (area_id, area_name, city, state, status) VALUES
(1, 'Adyar', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(2, 'Velachery', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(3, 'T Nagar', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(4, 'Anna Nagar', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(5, 'Guindy', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(6, 'OMR', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(7, 'Tambaram', 'Chennai', 'Tamil Nadu', 'ACTIVE'),
(8, 'Mylapore', 'Chennai', 'Tamil Nadu', 'INACTIVE');

-- 5. Fare Rules
INSERT INTO fare_rules (fare_id, vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status) VALUES
(1, 'Mini', 50.00, 12.00, 1.00, 30.00, 'ACTIVE'),
(2, 'Sedan', 80.00, 15.00, 1.50, 40.00, 'ACTIVE'),
(3, 'SUV', 120.00, 20.00, 2.00, 50.00, 'ACTIVE'),
(4, 'Auto', 30.00, 9.00, 0.50, 20.00, 'ACTIVE'),
(5, 'Premium', 150.00, 25.00, 2.50, 60.00, 'ACTIVE');

-- 6. Vehicles
INSERT INTO vehicles (vehicle_id, driver_id, vehicle_number, vehicle_type, model, capacity, status) VALUES
(1, 1, 'TN01AB1001', 'Sedan', 'Maruti Dzire', 4, 'AVAILABLE'),
(2, 2, 'TN01AB1002', 'Mini', 'Hyundai i10', 4, 'AVAILABLE'),
(3, 3, 'TN01AB1003', 'SUV', 'Kia Seltos', 5, 'IN_USE'),
(4, 4, 'TN01AB1004', 'Auto', 'Bajaj RE Auto', 3, 'AVAILABLE'),
(5, 5, 'TN01AB1005', 'Premium', 'Honda City', 4, 'AVAILABLE'),
(6, 6, 'TN01AB1006', 'Sedan', 'Hyundai Verna', 4, 'AVAILABLE');

-- 7. Ride Requests
INSERT INTO ride_requests (request_id, passenger_id, pickup_location, destination, requested_at, scheduled_for, estimated_fare, status) VALUES
(1, 1, 'IIT Madras, Adyar, Chennai', 'Phoenix Marketcity, Velachery, Chennai', NOW() - INTERVAL 25 MINUTE, NULL, 280.00, 'ACCEPTED'),
(2, 2, 'Velachery MRTS, Chennai', 'T Nagar, Chennai', NOW() - INTERVAL 10 MINUTE, NULL, 220.00, 'ACCEPTED'),
(3, 1, 'Adyar, Chennai', 'Chennai International Airport, Meenambakkam', NOW() - INTERVAL 2 HOUR, NOW() + INTERVAL 1 DAY, 420.00, 'ACCEPTED'),
(4, 2, 'T Nagar, Chennai', 'Chennai Central Railway Station, Chennai', NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 4 HOUR, 310.00, 'ACCEPTED'),
(5, 1, 'Adyar, Chennai', 'Marina Beach, Triplicane, Chennai', NOW() - INTERVAL 3 DAY, NULL, 215.00, 'COMPLETED'),
(6, 1, 'Guindy, Chennai', 'Anna Nagar, Chennai', NOW() - INTERVAL 2 DAY, NULL, 340.00, 'COMPLETED'),
(7, 1, 'Adyar, Chennai', 'T Nagar Bus Stand, Chennai', NOW() - INTERVAL 1 DAY, NULL, 185.00, 'COMPLETED'),
(8, 2, 'Velachery, Chennai', 'Besant Nagar Beach, Chennai', NOW() - INTERVAL 4 DAY, NULL, 190.00, 'COMPLETED'),
(9, 3, 'Anna University, Guindy, Chennai', 'Central Station, Chennai', NOW() - INTERVAL 5 DAY, NULL, 295.00, 'COMPLETED'),
(10, 1, 'Porur, Chennai', 'Vadapalani, Chennai', NOW() - INTERVAL 6 DAY, NULL, 160.00, 'CANCELLED'),
(11, 4, 'Tambaram, Chennai', 'Pallavaram, Chennai', NOW() - INTERVAL 7 DAY, NULL, 130.00, 'CANCELLED');

-- 8. Trips
INSERT INTO trips (trip_id, request_id, passenger_id, driver_id, vehicle_id, start_time, end_time, distance_km, fare, trip_status) VALUES
(1, 1, 1, 3, 3, NOW() - INTERVAL 15 MINUTE, NULL, 8.00, 280.00, 'IN_PROGRESS'),
(2, 2, 2, 1, 1, NULL, NULL, 9.50, 220.00, 'ASSIGNED'),
(3, 3, 1, 2, 2, NULL, NULL, 16.00, 420.00, 'ASSIGNED'),
(4, 4, 2, 4, 4, NULL, NULL, 12.00, 310.00, 'ASSIGNED'),
(5, 5, 1, 1, 1, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY + INTERVAL 30 MINUTE, 9.00, 215.00, 'COMPLETED'),
(6, 6, 1, 5, 5, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 45 MINUTE, 14.50, 340.00, 'COMPLETED'),
(7, 7, 1, 6, 6, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY + INTERVAL 25 MINUTE, 7.00, 185.00, 'COMPLETED'),
(8, 8, 2, 2, 2, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY + INTERVAL 28 MINUTE, 8.50, 190.00, 'COMPLETED'),
(9, 9, 3, 1, 1, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY + INTERVAL 40 MINUTE, 13.00, 295.00, 'COMPLETED'),
(10, 10, 1, 1, 1, NULL, NULL, NULL, NULL, 'CANCELLED'),
(11, 11, 4, 4, 4, NULL, NULL, NULL, NULL, 'CANCELLED');

-- 9. Payments
INSERT INTO payments (payment_id, trip_id, passenger_id, amount, payment_method, payment_status, paid_at) VALUES
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
(11, 11, 4, 130.00, 'ONLINE', 'REFUNDED', NOW() - INTERVAL 7 DAY);

-- 10. Ratings & Reviews
INSERT INTO ratings_reviews (review_id, trip_id, reviewer_id, reviewed_user_id, rating, comment) VALUES
(1, 5, 1, 9, 5, 'Excellent driving and very polite! The car was clean.'),
(2, 6, 1, 13, 4, 'Comfortable sedan ride, arrived promptly at pickup.'),
(3, 8, 2, 10, 5, 'Smooth and safe trip, appreciated the friendly driver.'),
(4, 9, 3, 9, 5, 'Great experience, reached my destination ahead of schedule.');

-- 11. Admin Permissions
INSERT INTO admin_permissions (permission_id, admin_id, permission_name) VALUES
(1, 15, 'VIEW_DASHBOARD'),
(2, 15, 'MANAGE_PASSENGERS'),
(3, 15, 'MANAGE_DRIVERS'),
(4, 15, 'MANAGE_VEHICLES'),
(5, 15, 'VIEW_REPORTS'),
(6, 16, 'MANAGE_ADMINS'),
(7, 16, 'SYSTEM_SETTINGS'),
(8, 16, 'ALL_PERMISSIONS');

-- 12. System Logs
INSERT INTO system_logs (log_id, user_id, action, description, ip_address) VALUES
(1, 15, 'ADMIN_LOGIN', 'Admin signed in to dashboard', '127.0.0.1'),
(2, 15, 'VIEW_BOOKINGS', 'Reviewed active bookings overview', '127.0.0.1'),
(3, 16, 'SYSTEM_CHECK', 'Super admin verified system permissions and health', '127.0.0.1'),
(4, 1, 'PASSENGER_LOGIN', 'Passenger Aarav Kumar signed in', '127.0.0.1'),
(5, 1, 'BOOK_RIDE', 'Booked ride from IIT Madras to Phoenix Marketcity', '127.0.0.1');
