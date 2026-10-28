USE cab_booking;
-- Demo-only records. Password values are placeholders; do not use them for real authentication.
-- 12 users are needed so that each profile table can have five distinct users plus ADMIN/SUPER ADMIN.
INSERT INTO users (user_id,name,email,password,mobile,role,status) VALUES
(1,'Aarav Kumar','aarav@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000001','PASSENGER','ACTIVE'),
(2,'Diya Sharma','diya@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000002','PASSENGER','ACTIVE'),
(3,'Ishaan Rao','ishaan@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000003','PASSENGER','ACTIVE'),
(4,'Meera Iyer','meera@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000004','PASSENGER','ACTIVE'),
(5,'Kabir Das','kabir@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000005','PASSENGER','ACTIVE'),
(6,'Vikram Singh','vikram@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000006','DRIVER','ACTIVE'),
(7,'Ananya Nair','ananya@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000007','DRIVER','ACTIVE'),
(8,'Rahul Menon','rahul@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000008','DRIVER','ACTIVE'),
(9,'Priya Shah','priya@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000009','DRIVER','ACTIVE'),
(10,'Arjun Patel','arjun@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000010','DRIVER','ACTIVE'),
(11,'Admin Demo','admin@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000011','ADMIN','ACTIVE'),
(12,'Super Admin Demo','superadmin@example.com','DEMO_PASSWORD_NOT_FOR_LOGIN','9000000012','SUPER ADMIN','ACTIVE');

INSERT INTO passenger_profiles (passenger_id,user_id,default_address,emergency_contact) VALUES
(1,1,'Adyar, Chennai','9111111111'),(2,2,'Velachery, Chennai','9222222222'),
(3,3,'T Nagar, Chennai','9333333333'),(4,4,'Anna Nagar, Chennai','9444444444'),
(5,5,'Guindy, Chennai','9555555555');
INSERT INTO driver_profiles (driver_id,user_id,license_no,license_expiry,verification_status,rating) VALUES
(1,6,'TN-DL-10001','2028-05-31','APPROVED',4.80),(2,7,'TN-DL-10002','2029-02-28','APPROVED',4.60),
(3,8,'TN-DL-10003','2027-11-30','APPROVED',4.40),(4,9,'TN-DL-10004','2028-08-31','PENDING',4.20),
(5,10,'TN-DL-10005','2029-01-31','REJECTED',3.90);
INSERT INTO service_areas (area_id,area_name,city,state,status) VALUES
(1,'Adyar','Chennai','Tamil Nadu','ACTIVE'),(2,'Velachery','Chennai','Tamil Nadu','ACTIVE'),
(3,'T Nagar','Chennai','Tamil Nadu','ACTIVE'),(4,'Anna Nagar','Chennai','Tamil Nadu','ACTIVE'),
(5,'Tambaram','Chennai','Tamil Nadu','INACTIVE');
INSERT INTO fare_rules (fare_id,vehicle_type,base_fare,per_km_rate,per_minute_rate,cancellation_fee,status) VALUES
(1,'Mini',50.00,12.00,1.00,30.00,'ACTIVE'),(2,'Sedan',80.00,15.00,1.50,40.00,'ACTIVE'),
(3,'SUV',120.00,20.00,2.00,50.00,'ACTIVE'),(4,'Auto',30.00,9.00,0.50,20.00,'ACTIVE'),
(5,'Premium',150.00,25.00,2.50,60.00,'INACTIVE');
INSERT INTO vehicles (vehicle_id,driver_id,vehicle_number,vehicle_type,model,capacity,status) VALUES
(1,1,'TN01AB1001','Sedan','Maruti Dzire',4,'IN_USE'),(2,2,'TN01AB1002','Mini','Hyundai i10',4,'IN_USE'),
(3,3,'TN01AB1003','SUV','Kia Seltos',5,'AVAILABLE'),(4,4,'TN01AB1004','Auto','Bajaj RE',3,'OFFLINE'),
(5,5,'TN01AB1005','Premium','Honda City',4,'INACTIVE');
INSERT INTO ride_requests (request_id,passenger_id,pickup_location,destination,requested_at,estimated_fare,status) VALUES
(1,1,'IIT Madras, Chennai','Adyar, Chennai',NOW() - INTERVAL 15 MINUTE,245.00,'ACCEPTED'),
(2,2,'Velachery MRTS, Chennai','T Nagar, Chennai',NOW() - INTERVAL 10 MINUTE,310.00,'ACCEPTED'),
(3,3,'Anna University, Chennai','Guindy, Chennai',NOW() - INTERVAL 8 MINUTE,180.00,'ACCEPTED'),
(4,4,'Anna Nagar Tower, Chennai','Central Station, Chennai',NOW() - INTERVAL 2 DAY,420.00,'COMPLETED'),
(5,5,'Tambaram, Chennai','Pallavaram, Chennai',NOW() - INTERVAL 1 DAY,160.00,'CANCELLED');
INSERT INTO trips (trip_id,request_id,passenger_id,driver_id,vehicle_id,start_time,end_time,distance_km,fare,trip_status) VALUES
(1,1,1,1,1,NOW() - INTERVAL 10 MINUTE,NULL,12.50,NULL,'IN_PROGRESS'),
(2,2,2,2,2,NULL,NULL,NULL,NULL,'ASSIGNED'),
(3,3,3,3,3,NULL,NULL,NULL,NULL,'ASSIGNED'),
(4,4,4,4,4,NOW() - INTERVAL 2 DAY,NOW() - INTERVAL 2 DAY + INTERVAL 35 MINUTE,18.20,420.00,'COMPLETED'),
(5,5,5,5,5,NULL,NULL,NULL,NULL,'CANCELLED');
INSERT INTO payments (payment_id,trip_id,passenger_id,amount,payment_method,payment_status,paid_at) VALUES
(1,1,1,245.00,'UPI','PENDING',NULL),(2,2,2,310.00,'CARD','PENDING',NULL),
(3,3,3,180.00,'CASH','PENDING',NULL),(4,4,4,420.00,'UPI','PAID',NOW() - INTERVAL 2 DAY),
(5,5,5,160.00,'ONLINE','REFUNDED',NOW() - INTERVAL 1 DAY);
INSERT INTO ratings_reviews (review_id,trip_id,reviewer_id,reviewed_user_id,rating,comment) VALUES
(1,4,4,9,5,'Smooth and comfortable ride.'),(2,1,1,6,5,'Driver was polite.'),
(3,2,2,7,4,'Good experience.'),(4,3,3,8,4,'Arrived on time.'),(5,5,5,10,3,'Ride was cancelled.');
INSERT INTO admin_permissions (permission_id,admin_id,permission_name) VALUES
(1,11,'VIEW_DASHBOARD'),(2,11,'MANAGE_PASSENGERS'),(3,11,'MANAGE_DRIVERS'),
(4,11,'MANAGE_VEHICLES'),(5,11,'VIEW_REPORTS');
INSERT INTO system_logs (log_id,user_id,action,description,ip_address) VALUES
(1,11,'ADMIN_LOGIN','Demo admin signed in','127.0.0.1'),(2,11,'VIEW_BOOKINGS','Opened current bookings','127.0.0.1'),
(3,12,'PERMISSION_REVIEW','Reviewed admin permissions','127.0.0.1'),(4,11,'DRIVER_REVIEW','Reviewed driver verification queue','127.0.0.1'),
(5,12,'SYSTEM_CHECK','Checked system activity','127.0.0.1');
