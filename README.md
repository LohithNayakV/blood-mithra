# 🩸 Blood Mithra — Community Blood Donor Network

A production-ready blood donor network platform: **React (Next.js App Router) + REST APIs (Node.js runtime) + PostgreSQL (Drizzle ORM)**. One platform for donors, volunteers, hospitals, blood banks, NGOs and administrators.

> Architecture: **React → REST APIs → Node.js (Next.js API Routes) → PostgreSQL**
> The REST API layer is implemented as versioned Next.js Route Handlers (`/api/v1/*`)
> running on the Node.js runtime — the same contract a standalone Express server would
> expose, ready for future Android/iOS apps to consume.

## ✨ Features

- **Public website**: Home (hero, live stats, trust, FAQ), Find Donors, Become a Donor, Emergency Request, Blood Camps, Organizations, About & Contact, Login — fully responsive, SEO-optimized (metadata, Open Graph, sitemap, robots).
- **Donor registration**: personal details, location (lat/lng), donation info, availability preferences, consent tracking, mobile OTP verification.
- **Health module**: private health declarations (illness, medications, surgeries, vaccination, pregnancy-related), screening status, and full health history — restricted to authorized roles.
- **Eligibility engine**: configurable donation intervals (Whole Blood M 90d / F 120d, Platelets 14d, Plasma 14d, Double Red 180d) stored in `system_settings` and editable from the admin dashboard.
- **Donor status rules**: ACTIVE, RECENTLY_DONATED, VERIFIED, REGULAR_DONOR, INACTIVE, TEMPORARILY_DEFERRED, UNDER_REVIEW — computed in the backend.
- **Activity score (0–100)**: profile completeness + verification + donation history + response rate + availability confirmations + recency.
- **Donor dashboard**: profile completion, eligibility, schedules (Today / Tomorrow / This Week / Upcoming / Overdue / Completed), emergency requests with accept/decline, donation history, certificates, notifications, availability confirmation (YES/NO).
- **Find donors**: search by blood group, city, district, pincode, GPS radius (haversine), availability, eligibility, status; funnel stats (Registered → Verified → Eligible → Active → Location match); masked public contacts.
- **Emergency requests**: urgency levels, hospital/location, required-by time; automatic **notification waves** (Wave 1: nearby eligible active donors → Wave 2: same city/district → Wave 3: larger pool); full lifecycle tracking (Created → Verification → Donors Notified → Responses → Confirmed → Collected → Fulfilled).
- **Donations & certificates**: per-donation record (type, units, hospital/bank/camp, verification) and certificate lifecycle (Pending → Generated → Issued → Received → Verified) with unique certificate numbers.
- **Volunteer management**: profiles, districts, assignments to donors/requests, dashboards with pending/completed follow-ups.
- **Blood camps**: camp directory, registrations, targets, organizers.
- **Project Control Dashboard (admin)**: summary cards (donors, volunteers, requests, donations, certificates, schedules, camps), donor management table (search/filter/sort/verify/status/assign), request tracking with wave escalation, certificate tracking, volunteer control, and analytics (growth, blood groups, district coverage, activity, donations).
- **Security**: JWT auth (jose), bcrypt password hashing, OTP verification, RBAC (8 roles), rate limiting, parameterized queries (Drizzle/pg — no raw string SQL), masked donor contacts, audit logging, consent management.

## 🗄️ Self-initializing database

On server start (`src/instrumentation.ts` → `src/db/init.ts`) the app:

1. Verifies the PostgreSQL connection.
2. Creates the `migrations` bookkeeping table.
3. Runs pending setup migrations exactly once (tracked in `migrations`).
4. Seeds: roles & permissions, a super admin, system settings (incl. eligibility rules), districts/cities, hospitals, blood banks, organizations, camps, volunteers, demo donors (with health/availability/schedules/donations/certificates) and a demo emergency request.

## 🚀 Quick start

```bash
npm install          # install dependencies
npx drizzle-kit push # create tables (schema: src/db/schema.ts)
npm run dev          # start — DB init + seed run automatically
```

Production:

```bash
npm run build
npm start
```

### Demo accounts

| Role  | Identifier                | Password   |
|-------|---------------------------|------------|
| Admin | admin@bloodmithra.org     | `admin123` |
| Donor | 9811111111 (any seeded)   | `donor123` |

In development, OTPs are returned in the API response (`demoOtp`) since no SMS gateway is configured.

## 🔌 REST API (`/api/v1`)

| Endpoint | Description |
|---|---|
| `POST /auth/register` | Donor registration (creates user, donor, health record, consent, OTP) |
| `POST /auth/login` | Password login (mobile/email) |
| `POST /auth/verify-otp` | OTP verification → session token |
| `GET /donors` | Search/list donors (filters, radius, funnel stats, masked contacts) |
| `GET/PATCH /donors/:id` | Donor profile (health visible to authorized roles only) |
| `GET/POST /donors/health` | Private health records + history (RBAC) |
| `GET/POST /donors/availability` | Availability confirmation (YES/NO) + history |
| `GET/PATCH /donors/schedules` | Schedules with Today/Tomorrow/This Week/Upcoming/Overdue buckets |
| `GET/POST /donations` | Donation tracking (auto-updates eligibility + certificate) |
| `GET/PATCH /certificates` | Certificate lifecycle management |
| `GET/POST /blood-requests` | Create (triggers notification waves) & search/track requests |
| `GET/PATCH /blood-requests/:id` | Lifecycle tracking; `?action=next-wave` escalates |
| `GET/PATCH /notifications` | Notification list / mark read |
| `POST /notifications/:id/respond` | Donor accepts/rejects an emergency request |
| `GET/POST /hospitals` | Hospital management |
| `GET/POST /organizations` | Organization directory |
| `GET/POST/PATCH /volunteers` | Volunteer management & assignments |
| `GET/POST /camps` | Blood camps + donor registration |
| `GET/POST/PATCH /follow-ups` | Follow-up tracking |
| `GET /users` · `POST/PATCH /users` | User management (admin) |
| `GET /admin` | Project Control Dashboard summary |
| `GET/PATCH /admin/donors` | Donor management table + admin actions |
| `GET /dashboard` | Donor dashboard payload |
| `GET /reports?type=` | Analytics: growth, bloodGroups, districts, activity, donations |
| `GET /api/health` | `{"status":"ok","database":"connected"}` |

All endpoints accept/return JSON and support `Authorization: Bearer <token>`.

## 🗃️ Database

PostgreSQL via Drizzle ORM (`src/db/schema.ts`). Tables: `users`, `roles`, `user_roles`, `donors`, `donor_profiles`, `donor_health_records`, `donor_health_history`, `donor_availability`, `donor_schedules`, `donations`, `donation_certificates`, `blood_requests`, `request_notifications`, `hospitals`, `blood_banks`, `organizations`, `volunteers`, `volunteer_assignments`, `blood_camps`, `camp_registrations`, `notifications`, `otp_verifications`, `consents`, `system_settings`, `districts`, `cities`, `audit_logs`, `follow_ups`, `migrations` — all with primary keys, foreign keys, indexes and timestamps.

## ⚙️ Environment (`.env`)

```
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=app_db
JWT_SECRET=change-me
OTP_EXPIRY_MINUTES=10
```

## 🧱 Project structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── page.tsx            # Home
│   ├── find-donors/        # Donor search
│   ├── become-donor/       # Registration
│   ├── emergency/          # Emergency request
│   ├── camps/ organizations/ about/ login/
│   ├── dashboard/          # Donor dashboard
│   ├── admin/              # Project Control Dashboard
│   ├── api/health/         # Health check
│   └── api/v1/...          # REST API (auth, donors, donations, requests, ...)
├── components/             # Navbar, Footer, Badge, StatCard
├── db/
│   ├── schema.ts           # Drizzle schema (all tables)
│   ├── init.ts             # Self-init: connection check, migrations, seed
│   └── index.ts            # Drizzle client
├── lib/
│   ├── auth.ts             # JWT + bcrypt + OTP helpers
│   ├── api.ts              # RBAC, rate limiting, audit, error handling
│   ├── eligibility.ts      # Donation interval & status rules
│   ├── activity.ts         # Donor activity score (0–100)
│   ├── geo.ts              # Haversine distance
│   └── client.ts           # Browser API client + session storage
└── instrumentation.ts      # Server-start DB bootstrap hook
```

## 🧪 Validation

```bash
npx next typegen     # generate route types
npx tsc --noEmit     # typecheck
npm run build        # production build
npm start            # production server (verifies /api/health)
```
