# Cutting Edge Appointment Project

Customer-facing barber booking experience built with Next.js App Router, React, Tailwind CSS v4, Drizzle ORM, and MySQL.

## Features

- Customer home page with upcoming-visit summary
- Booking flow with date, barber, service, and time selection
- Confirmation flow with persisted draft contact info
- Customer appointments page with cancel, delete history, and book-again actions
- Owner appointments dashboard with status management
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

## Getting Started

Install dependencies:

```bash
npm install
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

## Current Product Gaps

These are not all security issues, but they are important before production:

- Customer identity is not authenticated yet.
- Owner access currently uses a shared token, not full user auth.
- Some customer pages still read local browser data for UI convenience, which can drift from server data.
- Rate limiting and audit logging are not implemented yet.

## Deployment

For deployment, ensure:

- `DATABASE_URL` is set
- `OWNER_DASHBOARD_TOKEN` is set to a strong secret
- HTTPS is enabled
- logs do not expose secrets or raw env values
