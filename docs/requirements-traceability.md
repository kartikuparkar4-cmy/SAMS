# Requirements Traceability Checklist

Status is marked complete only after implementation and the corresponding checks have run. Browser-only visual checks are identified separately from automated API tests.

## Functional requirements

| ID | Requirement | Implementation | Verification |
| --- | --- | --- | --- |
| FR-01 | Public landing page with hospital identity and navigation | `client/index.html`, `client/css/style.css` | Manual: open home page at desktop/mobile widths |
| FR-02 | Browse active providers, services, and availability | `GET /api/providers`, `client/js/public.js` | API integration tests; manual provider display |
| FR-03 | Submit appointment with required patient contact and optional notes | `POST /api/appointments`, `Appointment` model, `client/book.html` | Valid and invalid booking tests |
| FR-04 | Choose provider, date, and available time slot | provider schedules and availability endpoint | Provider/schedule API tests; manual form flow |
| FR-05 | Show a unique booking reference after successful booking | cryptographically random reference, unique index | Creation/reference tests |
| FR-06 | Retrieve limited booking status by reference | `GET /api/appointments/status/:referenceCode` | Privacy and not-found tests |
| FR-07 | Administrator login and logout | `POST /api/auth/login`, `POST /api/auth/logout` | Valid/invalid login and cookie tests |
| FR-08 | Admin list, search, filter, and paginate appointments | `GET /api/appointments` | Search/filter integration test |
| FR-09 | Admin confirms, cancels, or completes appointments | `PATCH /api/appointments/:id/status` | Valid/invalid status and conflict-release tests |
| FR-10 | Dashboard totals for supported statuses | `GET /api/dashboard/summary` | Summary aggregation test |
| FR-11 | Protect all management operations by administrator role | auth middleware and HTTP-only cookie | Unauthenticated/role denial tests |
| FR-12 | Persist providers, appointments, and admins in MongoDB | Mongoose models and indexes | In-memory MongoDB integration suite; local Mongo instructions |

## Non-functional requirements

| ID | Requirement | Implementation | Verification |
| --- | --- | --- | --- |
| NFR-01 | Responsive and accessible UI | semantic HTML, CSS Grid/Flexbox/media queries | Manual viewport and keyboard checklist |
| NFR-02 | Common API requests respond promptly | indexed lookup fields, bounded pagination | Automated API suite; performance not load-tested |
| NFR-03 | Server-side validation and slot integrity | validators, unique active-slot index | Negative and concurrent booking tests |
| NFR-04 | Current Chrome, Edge, and Firefox compatibility | standard HTML/CSS/Vanilla JS APIs | Manual browser smoke test instructions |
| NFR-05 | Modular, maintainable application | separated routes, controllers, models, middleware | Structure review and test suite |
| NFR-06 | Collect only booking-required personal data | name and contact only; public status is minimized | API response privacy test |
| NFR-07 | Setup and operations understandable for student use | `README.md`, `.env.example`, scripts | Follow documented setup and test commands |

## Security requirements

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Password hashing and no plaintext storage | bcryptjs cost 12, Admin `passwordHash` only | Login tests; response shape assertion |
| Secrets externalized | dotenv, `.env.example`, `.gitignore` | Configuration review |
| Admin-only management | signed JWT in HTTP-only, same-site cookie; role middleware | Unauthorized and insufficient-role tests |
| Validation and normalized input | request validators, normalized email, bounded strings | Invalid input tests |
| Narrow CORS and production HTTPS cookie | configured origin allowlist; secure cookie in production | CORS/config review |
| Login abuse and request-size limits | login rate limiter, JSON body limit, Helmet | middleware/config review |
| No public admin registration | environment-driven one-time CLI script | route inventory and documentation review |
| No sensitive public status leakage | whitelisted status response | privacy test |

## Acceptance criteria

| Criterion | Implementation / test evidence |
| --- | --- |
| Booking succeeds with reference | integration creation test |
| Invalid booking rejected clearly | missing, contact/date, provider tests |
| Conflicts blocked, including concurrent requests | unique active-slot index plus concurrency test |
| Admin login works and protected APIs reject anonymous callers | auth integration tests |
| Admin search and filters work | list query integration test |
| Status changes are constrained | status integration tests |
| Dashboard totals match stored records | summary aggregation test |
| Desktop/mobile UI usable | manual responsive instructions; not browser-automated in this environment |
| MongoDB persistence | Mongoose models; tested against in-memory MongoDB; local setup documented |

## Deliverables

| Deliverable | Location |
| --- | --- |
| Complete Vanilla JS client and Express API | `client/`, `server/` |
| Database models, seeds, and first-admin process | `server/models/`, `server/scripts/`, `README.md` |
| API and setup documentation | `README.md` |
| Automated negative-path results | `npm test` and README test section |
| Manual UI, screenshot, and video instructions | `README.md` |
| Screenshots | Capture steps are documented; binary screenshots are not generated by the current tool environment |