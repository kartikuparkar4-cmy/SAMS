# Smart Hospital Appointment Management System

A browser-based appointment booking and administration application for the fictional Northstar Medical Center. Visitors can browse active providers, request a time, and check a booking reference. Administrators can authenticate, review appointments, update statuses, and see live totals. The application stores only the contact and scheduling details needed to manage an appointment; it is not a clinical-records system.

## Technology

- Frontend: semantic HTML5, CSS3, responsive Grid/Flexbox, Vanilla JavaScript, Fetch API.
- Backend: Node.js 20+, Express 4, REST APIs.
- Database: MongoDB with Mongoose models and indexes.
- Security: bcrypt password hashing, signed JWT in an HTTP-only SameSite cookie, role checks, Helmet, allowlisted CORS, bounded JSON requests, and login/status rate limits.
- Tests: Node.js test runner, Supertest, and MongoDB Memory Server.

## Features

- Public provider/service listing, weekday availability, booking, and limited status lookup.
- Cryptographically random `NS-` booking references.
- Race-safe active reservations enforced by a unique MongoDB index. Pending and Confirmed occupy a slot; Cancelled and Completed release it.
- Admin dashboard with status totals, bounded pagination, search by name/reference, and provider/date/status filters.
- Administrator login/logout with no public account-registration route.
- Responsive public pages, booking form, staff login, and management dashboard.

## Project structure

```text
client/
  index.html
  book.html
  admin-login.html
  admin-dashboard.html
  css/style.css
  js/{common,public,booking,auth,admin}.js
server/
  app.js, server.js
  config/       environment and MongoDB connection
  models/       Provider, Appointment, Admin
  routes/       REST route modules
  controllers/  API behavior
  middleware/   authentication and error handling
  validators/   server-side request checks
  scripts/      demo provider seed and first-admin creation
  tests/        HTTP/Mongoose integration tests
docs/
  requirements-traceability.md
  ui-plan.md
```

## Prerequisites and setup

Install Node.js 20 or later and npm. Run MongoDB locally or create a MongoDB Atlas database. From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set `MONGODB_URI` to your local or Atlas connection string. Generate a signing key (do not use the placeholder in a deployment):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the resulting value in `JWT_SECRET`. Keep `.env` private; it is ignored by Git. For a local MongoDB server, the example URI is `mongodb://127.0.0.1:27017/smart-hospital-appointments`.

`FRONTEND_ORIGINS` is a comma-separated exact-origin allowlist. The frontend is served by Express on the same origin by default. If using another port or separately hosting the static client, add that exact origin. In production, deploy behind HTTPS and use `COOKIE_SECURE=true`.

## Seed providers and create the first administrator

Seed six fictional demo providers (this does not add patient or appointment records):

```powershell
npm run seed
```

There is deliberately no public admin-registration endpoint. For the first administrator, temporarily add these values to the ignored local `.env` file:

```dotenv
ADMIN_NAME=Clinic Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
```

Then run:

```powershell
npm run admin:create
```

The script normalizes the email, hashes the password with bcrypt cost 12, and refuses an already-used email. Remove the three `ADMIN_*` values from `.env` after creation. No demo administrator credentials are configured in source.

## Run locally

```powershell
npm start
```

Open `http://localhost:3000`. For automatic restart during development, use `npm run dev`. The application refuses to start when the database URI or a sufficiently long JWT secret is missing. `GET /api/health` reports whether MongoDB is connected.

## API

JSON requests use `Content-Type: application/json`. Admin authentication is an HTTP-only cookie set at login; browser requests are same-origin. Public status endpoints return only the booking reference, provider/service, date/time, and status.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Application and database readiness |
| `GET` | `/api/providers` | Public | Active providers and basic schedule |
| `GET` | `/api/providers/:providerId/availability?date=YYYY-MM-DD` | Public | Free scheduled slots for a date |
| `POST` | `/api/appointments` | Public | Validate and create an appointment; returns the reference |
| `GET` | `/api/appointments/status/:referenceCode` | Public, rate-limited | Limited status lookup |
| `GET` | `/api/appointments?reference=NS-...` | Public, rate-limited | SRS-compatible limited status lookup |
| `POST` | `/api/auth/login` | Public, rate-limited | Validate credentials and set the admin cookie |
| `POST` | `/api/auth/logout` | Administrator | Clear the admin cookie |
| `GET` | `/api/appointments` | Administrator | Search/filter/paginate records |
| `PATCH` | `/api/appointments/:id/status` | Administrator | Set `Pending`, `Confirmed`, `Completed`, or `Cancelled` |
| `GET` | `/api/dashboard/summary` | Administrator | Database-derived status totals |

Appointment list query parameters: `search` (name or reference), `providerId`, `date` (`YYYY-MM-DD`), `status`, `page` (default 1), and `limit` (default 10, maximum 50). Invalid filters return `400`; a full slot returns `409`; missing resources return `404`; unauthenticated and insufficient-role requests return `401` and `403` respectively.

The SRS uses `GET /api/appointments/` for public status and administrator listing. These are disambiguated by the `reference` query parameter: reference present means a limited public lookup; without it the route requires administrator authentication. The clearer `/status/:referenceCode` path is also supported.

## Data and scheduling assumptions

- `Appointment` includes the required fields plus `providerName` (a booking-time display snapshot), `appointmentDay` (a stable calendar-date key), and `activeSlotKey` (the indexed reservation key).
- `Provider` stores active state and a weekday/slot schedule. Demo providers use weekdays and 24-hour times.
- `Admin.email` is lowercase and unique; password hashes are excluded from normal queries and never returned.
- Appointment dates are calendar-date strings normalized to UTC midnight for storage. Slot labels are interpreted in the clinic server's local timezone; configure the server to the clinic timezone.
- Patients do not need accounts. Notes are optional and limited to 500 characters; no medical history or clinical record is collected.

## Tests and results

Run the automated API/database suite with:

```powershell
npm test
```

The suite uses MongoDB Memory Server, so the first test run may download a MongoDB binary and requires network access. It covers valid creation, missing/invalid fields, inactive and missing providers, service mismatch, sequential and concurrent double booking, public-data privacy, valid/invalid login, missing/insufficient authorization, status updates and invalid statuses, search/filtering, missing appointments, slot release, and summary counts.

The automated suite includes more than five negative/error paths: missing fields, invalid contact, past date, unscheduled time, invalid notes type, missing provider, inactive provider, service mismatch, duplicate slot, invalid credentials, unauthenticated access, insufficient role, invalid status, invalid query, and missing appointment. Verified locally on Node.js 22: `npm test` passed all 16 integration tests (including the MongoDB concurrency case).

### Manual responsive and UI checks

1. Start MongoDB, seed providers, create an admin, and start the app using the setup steps above.
2. At desktop width, open the home page; confirm providers/services load, submit a booking, and retain the generated reference.
3. Check the reference on the home page; confirm only status, provider/service, date, and time appear. Try a malformed or unknown reference and confirm a clear error.
4. Sign in as admin; search by name/reference, filter by provider/date/status, change appointment status, refresh, and sign out.
5. Repeat at 390px and 768px viewport widths. Confirm no clipped form fields, navigation works by keyboard, and the table can be horizontally scrolled on mobile.
6. Repeat the public booking and admin flows in current Chrome, Edge, and Firefox.

### Screenshots and demo recording

Capture and add screenshots under `docs/screenshots/` for the home page, completed booking confirmation (use fictional data), login, and dashboard. Do not capture real patient details, secrets, or production records. To record a short demo, show the provider list, submit a fictional appointment, check its reference, sign in, filter the new appointment, change its status, and show the updated totals. Stop recording before displaying credentials or `.env`.

## Troubleshooting

- `Server startup failed: Missing or invalid environment configuration`: copy `.env.example`, set `MONGODB_URI`, and replace `JWT_SECRET` with at least 32 characters.
- Mongo connection timeout: verify MongoDB is running, the URI/database name is correct, and Atlas network access permits your client.
- Browser CORS error: use the Express-served client or add the exact browser origin to `FRONTEND_ORIGINS` and restart the server.
- No available appointment times: providers are seeded weekdays only; choose a future weekday and a slot listed for that provider.
- `409` while booking: another request reserved the slot first; choose a different time.
- Test MongoDB binary download failure: check network/proxy access, then rerun `npm test` after the binary is available.

## Requirements traceability

The FR-01–FR-12, NFR-01–NFR-07, security, acceptance, and deliverable mappings are maintained in [docs/requirements-traceability.md](docs/requirements-traceability.md). The responsive interface plan is in [docs/ui-plan.md](docs/ui-plan.md).