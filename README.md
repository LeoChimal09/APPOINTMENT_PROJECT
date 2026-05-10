# Cutting Edge Appointment Project

Customer-facing barber booking experience built with Next.js App Router, React, Tailwind CSS v4, Drizzle ORM, and MySQL.

## Features

- Customer home page with upcoming-visit summary and live staff/team cards
- Booking flow with date, barber, service, and time selection based on staff + building hours
- Confirmation flow with persisted draft contact info and guest-mode support
- Customer appointments page with status filters, cancel, clear history, and book-again actions
- Admin dashboard with hover quick-links (Appointments and Staff)
- Admin staff management for roster, weekly schedules, active/inactive control, and building hours
- API-backed appointment persistence via MySQL + Drizzle

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Drizzle ORM
- MySQL (`mysql2`)

## Environment Variables

Create a local env file such as `.env.local` and set:

```bash
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB_NAME
OWNER_DASHBOARD_TOKEN=replace-with-a-long-random-secret
```

Notes:

- `DATABASE_URL` is required for server-side appointment APIs.
- `OWNER_DASHBOARD_TOKEN` protects owner-only appointment endpoints.
- Do not commit real env files or secrets.

You can start from `.env.example`.

## Local MySQL with Docker

This repo includes a local MySQL container for development and DBeaver access.

Start MySQL:

```bash
npm run db:up
```

Stop MySQL:

```bash
npm run db:down
```

The container listens on `127.0.0.1:3308` by default and initializes the `appointments` table automatically on first startup from [docker/mysql/init/01-create-appointments.sql](docker/mysql/init/01-create-appointments.sql).

Docker setup files:

- [docker-compose.yml](docker-compose.yml)
- [docker/mysql/init/01-create-appointments.sql](docker/mysql/init/01-create-appointments.sql)
- [.env.example](.env.example)

## DBeaver Connection

Use these values in DBeaver:

- Host: `127.0.0.1`
- Port: `3308`
- Database: `appointmentproject`
- Username: `appointmentproject`
- Password: `appointmentproject`

Or use your overridden values from `.env.local` if you changed them.

## Drizzle and Schema Sync

The Docker init SQL creates the initial `appointments` table so the app can run immediately.

After you change the Drizzle schema in [server/db/schema.ts](server/db/schema.ts), sync the database with:

```bash
npm run db:push
```

If you want a fresh local database after changing init SQL:

```bash
docker compose down -v
npm run db:up
```

## Getting Started

Install dependencies:

```bash
npm install
```

If you use Bun in this project, you can also run:

```bash
bun install
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run check
npm run db:up
npm run db:down
npm run db:push
npm run test:run
npm run security:staged
```

## Owner Dashboard Access

The owner dashboard is available at `/owner/appointments`.

To load owner data:

1. Set `OWNER_DASHBOARD_TOKEN` on the server.
2. Open the owner dashboard.
3. Paste the same token into the owner access field.

The token is stored in `sessionStorage` only for the current browser session and is sent as `x-owner-token` when requesting protected owner APIs.

## Security Notes

- Owner-scoped appointment endpoints are token-protected.
- Customer UI still uses browser storage for some local UX state such as confirmation drafts and client-side history views.
- Server persistence is handled through authenticated API routes and the database connection string from env.
- Run `npm run security:staged` before committing to scan staged files for likely secrets.

## Repository Hygiene

This repository ignores:

- dependency folders
- Next.js build output
- env files
- editor folders
- temporary files and caches

## Pre-Commit Recommendation

Before committing, run:

```bash
npm run check
npm run security:staged
```

If you use Bun, equivalent checks are:

```bash
bun run check
bun run security:staged
```

## Current Product Gaps

These are not all security issues, but they are important before production:

- Customer identity is not authenticated yet.
- Owner access currently uses a shared token, not full user auth.
- Some customer pages still read local browser data for UI convenience, which can drift from server data.
- Rate limiting and audit logging are not implemented yet.

## Risk Checklist Before Commit

- Ensure no local env files are staged (`.env.local`, `.env.development.local`, etc.)
- Run type and lint checks (`npm run check` or `bun run check`)
- Run staged secret scan (`npm run security:staged` or `bun run security:staged`)
- Verify owner-only routes still enforce authorization for admin actions
- Confirm booking and availability flows behave correctly for both signed-in and guest users

## Deployment

For deployment, ensure:

- `DATABASE_URL` is set
- `OWNER_DASHBOARD_TOKEN` is set to a strong secret
- HTTPS is enabled
- logs do not expose secrets or raw env values
