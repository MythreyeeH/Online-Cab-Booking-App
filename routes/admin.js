const db = require('../db');

async function getSummary() {
  const [[{ passengers }]] = await db.query("SELECT COUNT(*) AS passengers FROM users WHERE role='PASSENGER'");
  const [[{ drivers }]] = await db.query("SELECT COUNT(*) AS drivers FROM driver_profiles WHERE verification_status='APPROVED'");
  const [[{ activeTrips }]] = await db.query("SELECT COUNT(*) AS activeTrips FROM trips WHERE trip_status IN ('ASSIGNED','IN_PROGRESS')");
  const [[{ revenue }]] = await db.query("SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE payment_status='PAID'");
  return { passengers, drivers, activeTrips, revenue: Number(revenue) };
}

async function getBookings() {
  const [rows] = await db.query(`
    SELECT t.trip_id, rr.request_id, pu.name AS passenger_name, du.name AS driver_name,
           rr.pickup_location, rr.destination, t.trip_status AS status,
           COALESCE(t.fare, rr.estimated_fare) AS fare, t.start_time,
           v.vehicle_number, v.vehicle_type
    FROM trips t
    JOIN ride_requests rr ON rr.request_id = t.request_id
    JOIN passenger_profiles pp ON pp.passenger_id = t.passenger_id
    JOIN users pu ON pu.user_id = pp.user_id
    JOIN driver_profiles dp ON dp.driver_id = t.driver_id
    JOIN users du ON du.user_id = dp.user_id
    JOIN vehicles v ON v.vehicle_id = t.vehicle_id
    ORDER BY FIELD(t.trip_status,'IN_PROGRESS','ASSIGNED','COMPLETED','CANCELLED'), t.trip_id DESC
  `);
  return rows;
}

// The schema has no driver latitude/longitude fields. These are demo map positions only.
async function getMapVehicles() {
  const [rows] = await db.query(`
    SELECT t.trip_id, t.trip_status AS status, du.name AS driver_name,
           v.vehicle_number, rr.pickup_location, rr.destination
    FROM trips t
    JOIN ride_requests rr ON rr.request_id=t.request_id
    JOIN driver_profiles dp ON dp.driver_id=t.driver_id
    JOIN users du ON du.user_id=dp.user_id
    JOIN vehicles v ON v.vehicle_id=t.vehicle_id
    WHERE t.trip_status IN ('ASSIGNED','IN_PROGRESS')
    ORDER BY t.trip_id
  `);
  const demoPoints = [
    { lat: 13.0067, lng: 80.2206 }, { lat: 12.9756, lng: 80.2209 },
    { lat: 13.0108, lng: 80.2350 }, { lat: 13.0358, lng: 80.2101 },
    { lat: 12.9345, lng: 80.2300 }
  ];
  return rows.map((row, i) => ({ ...row, ...demoPoints[i % demoPoints.length], location_is_demo: true }));
}

module.exports = { getSummary, getBookings, getMapVehicles };
