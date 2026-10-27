
CREATE DATABASE IF NOT EXISTS cab_booking;
USE cab_booking;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN', 'SUPER ADMIN') NOT NULL,
    status ENUM('ACTIVE', 'BLOCKED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE passenger_profiles (
    passenger_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    default_address VARCHAR(255),
    emergency_contact VARCHAR(20),
    CONSTRAINT fk_passenger_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE driver_profiles (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    license_no VARCHAR(50) NOT NULL UNIQUE,
    license_expiry DATE NOT NULL,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED')
        NOT NULL DEFAULT 'PENDING',
    rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT chk_driver_rating CHECK (rating BETWEEN 0 AND 5),
    CONSTRAINT fk_driver_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE service_areas (
    area_id INT AUTO_INCREMENT PRIMARY KEY,
    area_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    UNIQUE (area_name, city, state)
);

CREATE TABLE fare_rules (
    fare_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_type VARCHAR(50) NOT NULL UNIQUE,
    base_fare DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    per_minute_rate DECIMAL(10,2) NOT NULL,
    cancellation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_base_fare CHECK (base_fare >= 0),
    CONSTRAINT chk_per_km CHECK (per_km_rate >= 0),
    CONSTRAINT chk_per_minute CHECK (per_minute_rate >= 0),
    CONSTRAINT chk_cancellation CHECK (cancellation_fee >= 0)
);

CREATE TABLE vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    status ENUM('AVAILABLE', 'IN_USE', 'OFFLINE', 'INACTIVE')
        NOT NULL DEFAULT 'OFFLINE',
    CONSTRAINT chk_vehicle_capacity CHECK (capacity > 0),
    CONSTRAINT fk_vehicle_driver
        FOREIGN KEY (driver_id) REFERENCES driver_profiles(driver_id)
);

CREATE TABLE ride_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    passenger_id INT NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_fare DECIMAL(10,2) NOT NULL,
    status ENUM(
        'PENDING', 'ACCEPTED', 'REJECTED',
        'CANCELLED', 'COMPLETED'
    ) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT chk_estimated_fare CHECK (estimated_fare >= 0),
    CONSTRAINT fk_request_passenger
        FOREIGN KEY (passenger_id)
        REFERENCES passenger_profiles(passenger_id)
);

CREATE TABLE trips (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL UNIQUE,
    passenger_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    distance_km DECIMAL(10,2),
    fare DECIMAL(10,2),
    trip_status ENUM(
        'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    ) NOT NULL DEFAULT 'ASSIGNED',
    CONSTRAINT chk_trip_distance
        CHECK (distance_km IS NULL OR distance_km >= 0),
    CONSTRAINT chk_trip_fare
        CHECK (fare IS NULL OR fare >= 0),
    CONSTRAINT chk_trip_times
        CHECK (end_time IS NULL OR start_time IS NULL
               OR end_time >= start_time),
    CONSTRAINT fk_trip_request
        FOREIGN KEY (request_id) REFERENCES ride_requests(request_id),
    CONSTRAINT fk_trip_passenger
        FOREIGN KEY (passenger_id) REFERENCES passenger_profiles(passenger_id),
    CONSTRAINT fk_trip_driver
        FOREIGN KEY (driver_id) REFERENCES driver_profiles(driver_id),
    CONSTRAINT fk_trip_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL UNIQUE,
    passenger_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('CASH', 'CARD', 'UPI', 'ONLINE') NOT NULL,
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')
        NOT NULL DEFAULT 'PENDING',
    paid_at DATETIME,
    CONSTRAINT chk_payment_amount CHECK (amount >= 0),
    CONSTRAINT fk_payment_trip
        FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    CONSTRAINT fk_payment_passenger
        FOREIGN KEY (passenger_id) REFERENCES passenger_profiles(passenger_id)
);

CREATE TABLE ratings_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    reviewed_user_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT uq_trip_reviewer UNIQUE (trip_id, reviewer_id),
    CONSTRAINT fk_review_trip
        FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    CONSTRAINT fk_review_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users(user_id),
    CONSTRAINT fk_review_reviewed
        FOREIGN KEY (reviewed_user_id) REFERENCES users(user_id)
);

CREATE TABLE admin_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_admin_permission
        UNIQUE (admin_id, permission_name),
    CONSTRAINT fk_permission_admin
        FOREIGN KEY (admin_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE system_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX idx_users_role_status
    ON users(role, status);

CREATE INDEX idx_requests_passenger_status
    ON ride_requests(passenger_id, status);

CREATE INDEX idx_trips_driver_status
    ON trips(driver_id, trip_status);

CREATE INDEX idx_trips_passenger
    ON trips(passenger_id);

CREATE INDEX idx_logs_created_at
    ON system_logs(created_at);
