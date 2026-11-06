# Online-Cab-Booking-App
Webtech CIA 2 Project

## Passenger ride search

Open `/passenger/book-ride.html` to enter pickup/destination place names and compare available cabs. When the passenger submits the form, the backend looks up each place once with OpenStreetMap Nominatim, displays the returned points on the Leaflet map, and calculates straight-line distance using the Haversine formula. This is not road-route distance.

Estimated fares use the active fare rule for each vehicle type:

`base fare + (per-kilometer rate × estimated distance)`

The map uses OpenStreetMap tiles and needs an internet connection. Place lookups happen only when the passenger submits the form (there is no autocomplete); results are cached in memory and requests are rate-limited to at most one per second per server process. `GEOCODING_URL` can be set in `.env` to switch to a compatible service. Place searches are sent to the configured geocoding service; do not enter personal or confidential details. When using public Nominatim, follow its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). Searching does not create a booking.

## Passenger accounts and trips

Start the app with `npm start`, open `/passenger/account.html`, then register or sign in. Passenger pages use an HTTP-only session cookie; sessions are held in server memory, so restarting the server signs passengers out.

After signing in, passengers can update their profile, book an available cab, see assigned driver and vehicle details, cancel a booking only before it starts, and review completed trips. Booking, profile, and review data is scoped to the signed-in passenger. Reviews are limited to one per completed trip.

Passenger API routes:

- `POST /api/passenger/register`, `POST /api/passenger/login`, `POST /api/passenger/logout`
- `GET /api/passenger/session`
- `GET /api/passenger/available-cabs` (pickup/destination query parameters)
- `PUT /api/passenger/profile`
- `POST /api/passenger/bookings`, `GET /api/passenger/active-trips`
- `DELETE /api/passenger/bookings/:tripId`
- `GET /api/passenger/trip-history`, `POST /api/passenger/trips/:tripId/review`

## Role-based sign in

Open `/` or `/auth.html` to sign in. Select Passenger, Driver, Admin, or Super admin; the selected role must match the account in the database, and a successful sign-in opens the corresponding dashboard. Passenger registration is available from the sign-in page; drivers and administrators must already have an account. Drivers must be approved before they can sign in. Admin and Super admin currently share the administrator dashboard.

Administrator pages and `/api/admin/*` endpoints require an active administrator session. Role-based sessions use HTTP-only cookies and are kept in server memory, so restarting the server signs users out. `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout` provide the shared sign-in session API.

## Demo accounts

After loading `database/schema.sql` and `database/seed.sql`, run:

```bash
node scripts/reset-demo-passwords.js
```

All seeded demo users then use password `Password1!` (for example `aarav@example.com` passenger, `vikram@example.com` approved driver, `admin@example.com` admin).

## Driver portal

Open `/driver-view/index.html` after signing in as an approved driver. The portal loads assigned trips from MySQL, lets the driver start or decline a trip, complete an in-progress trip (marks payment paid), and toggle vehicle availability.

Driver API routes:

- `GET /api/driver/dashboard`, `GET /api/driver/requests`, `GET /api/driver/trips`
- `PUT /api/driver/availability`
- `PUT /api/driver/trips/:id/accept|reject|complete`
