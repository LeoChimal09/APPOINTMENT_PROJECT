# Cutting Edge Appointments

> A full-stack barber booking platform built with Next.js 16, React 19, TypeScript, Drizzle ORM, and MySQL — featuring real-time availability, multi-role auth, and an admin dashboard.

---

## Why This Matters

Scheduling in service businesses is still largely manual — phone calls, walk-ins, or clunky third-party tools that don't fit the brand. This project tackles that head-on by building a complete, self-hosted booking system where:

- **Customers** can browse staff, pick a service, and book a time slot in under a minute
- **Business owners** manage staff schedules, building hours, and appointment statuses from a dedicated admin panel
- **No third-party booking fees** — the business owns its data and workflow end to end

This is the kind of real-world problem full-stack skills are built for.

---

## Screenshots

### Home — hero with live "Your next visit" preview and business hours
![Home page](public/screenshots/home.png)

### Services — service menu with durations and staff cards showing real-time next-available slots
![Services and staff](public/screenshots/services.png)

### Testimonials & Social — review section and social proof footer
![Reviews and social](public/screenshots/home-reviews.png)

### Booking Flow — calendar + service/barber picker + available time slots in one view
![Booking flow](public/screenshots/booking.png)

### My Appointments — customer view with status badges, cancel, and book-again actions
![My appointments](public/screenshots/my-appointments.png)

### Admin — Appointment Requests — full workflow (Pending → Accepted → Completed), filter by barber/status
![Admin appointments](public/screenshots/admin-appointments.png)

### Admin — Staff Weekly Schedule — per-staff day-by-day schedule editor
![Staff weekly schedule](public/screenshots/admin-staff-schedule.png)

### Admin — Building Hours — business open/close hours that gate customer availability
![Building hours](public/screenshots/admin-building-hours.png)

---

## Features

**Customer Experience**
- Home page with upcoming visit summary and live staff cards
- Multi-step booking flow: pick a date → select a barber → choose a service → confirm a time
- Availability is computed in real time from staff schedules and business hours — no double-booking
- Guest mode with persisted draft contact info for returning visitors
- Appointments page with status filters, cancel, clear history, and book-again

**Admin / Owner**
- Admin dashboard with quick-nav to Appointments and Staff
- Staff roster management: add/remove staff, toggle active/inactive
- Per-staff weekly schedule editor
- Business hours configuration
- Appointment status management across all bookings

**Auth**
- Google OAuth via NextAuth.js
- Magic-link / email verification flow (passwordless sign-in)
- Rate-limited auth endpoints
- Admin role gated by server-side email allowlist

**Developer Experience**
- Dockerized MySQL with auto-init SQL — one command to spin up a full local DB
- Drizzle ORM with push-based schema sync for fast iteration
- Pre-commit secret scanner (`npm run security:staged`)
- TypeScript strict mode throughout; ESLint + type checks on CI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, HeroUI, MUI |
| Auth | NextAuth.js (Google OAuth + magic link) |
| ORM | Drizzle ORM |
| Database | MySQL via `mysql2` |
| Email | Resend |
| Payments | Stripe _(coming soon)_ |
| Containerization | Docker Compose |
| Testing | Vitest |

---

## Architecture

```
Browser (React / Next.js App Router)
        │
        │  RSC + Client Components
        ▼
Next.js API Routes  (/api/*)
        │
        │  Drizzle ORM (type-safe queries)
        ▼
MySQL Database (Docker / hosted)
```

**Key flows:**

1. **Booking** — Customer selects date/barber/service → client calls `/api/appointments/availability` (reads staff schedules + business hours) → confirmed slot is written to `appointments` table via `/api/appointments`
2. **Auth** — Sign-in triggers NextAuth; magic-link flow emails a hashed token via Resend → token is verified server-side and exchanged for a JWT session
3. **Admin** — Protected routes check session email against server-side admin allowlist; all mutations go through authenticated API routes

**Database schema highlights:** `appointments`, `customers`, `customer_email_verification_tokens`, `staff_members`, `staff_weekly_availability`, `business_weekly_hours`, `business_status`

---

## Getting Started

**Prerequisites:** Node.js 20+, Docker

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Start the local MySQL container
npm run db:up

# 4. Push the schema to the database
npm run db:push

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```bash
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB_NAME
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_ID=your-google-oauth-client-id
GOOGLE_SECRET=your-google-oauth-client-secret
ADMIN_EMAILS=you@example.com
RESEND_API_KEY=your-resend-api-key
```

### Useful Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run check        # lint + typecheck together
npm run test:run     # run Vitest tests
npm run db:up        # start MySQL container
npm run db:down      # stop MySQL container
npm run db:push      # sync Drizzle schema → DB
npm run db:studio    # open Drizzle Studio
```

---

## Coming Soon

- Stripe payment integration at checkout
- Customer notifications (email reminders before appointments)
- Screenshots and live demo link

---

## Deployment

Set all environment variables from `.env.example` on your host, ensure HTTPS is enabled, and run:

```bash
npm run build
npm run start
```
