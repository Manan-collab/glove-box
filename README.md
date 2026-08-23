# Glovebox

A car ownership and expense tracker, built by car enthusiasts, for car enthusiasts.

Track every car in your garage, log expenses by category, see real cost-per-km and spending trends, and compare notes with friends' public garages — all in a fast, MUI-based dashboard with light/dark themes.

> **Status:** in active development. See [Roadmap](#roadmap) for what's built vs. planned.

---

## Why this exists

Most expense trackers are either generic budgeting apps or bloated fleet-management tools built for businesses. Glovebox is neither — it's scoped specifically to what a car enthusiast actually wants to know: *what does this car really cost me, per km, per year, per category* — without dragging in a maintenance-scheduling module, a dozen integrations, or enterprise complexity nobody asked for.

It's also a full-stack portfolio project, built with a deliberate engineering philosophy: **every technology in the stack has to earn its place.** No Kubernetes, no microservices, no GraphQL, no infrastructure added because it looks good on a resume. See [`glovebox-architecture.md`](glovebox-architecture.md) for the full reasoning behind every decision.

---

## Features

- Google Sign-In auth (no passwords to manage) — JWT access + refresh tokens in httpOnly cookies
- Multi-car garage — add, edit, and track any number of cars, with Make/Model/Variant autocomplete (a curated India-market catalog with real trim names, layered under a free, Wikidata-sourced global catalog of ~280 makes/~3,900 models)
- Expense logging with category-aware fields (fuel, service, insurance, tyres, repairs, mods)
- Analytics — total spend, spend by category, monthly trends, cost/km (derived from logged odometer readings), garage-wide car comparison
- Friends — send/accept requests, view a friend's public garage (car specs only, no financial data ever exposed)
- Light / dark / system theme
- *(planned, blocked on credentials)* Photo and receipt uploads (S3/R2-backed, signed-URL flow)

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, MUI v9, TanStack Query, react-hook-form + Zod |
| Backend | Node.js, NestJS 11, TypeScript, Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL — [Neon](https://neon.tech) serverless in dev/prod; `docker-compose.yml` provided for a local instance if preferred |
| Auth | Google Sign-In only, JWT access + refresh tokens in httpOnly cookies |
| Storage | *(planned)* AWS S3 or Cloudflare R2, signed URLs for photos and receipts |
| Hosting | Vercel (frontend), Render/Railway (backend), Neon (managed Postgres) |
| Testing | Jest + Supertest (backend — unit + e2e against a real Postgres instance); manual Playwright-driven browser verification for the frontend |
| CI/CD | GitHub Actions — lint, build, unit + e2e tests on every push/PR |

Full rationale for each choice — including what was deliberately *not* used and why — is in [`glovebox-architecture.md`](glovebox-architecture.md).

---

## Architecture

```
Next.js (Vercel)
   │  HTTPS/JSON, credentials: include
   ▼
NestJS API (Render/Railway)
   │           │
   ▼           ▼
PostgreSQL   S3/R2 (signed URLs — planned)
(Neon)
```

A modular monolith, not microservices — one NestJS app with strict module boundaries (`auth`, `cars`, `expenses`, `analytics`, `friends`, `users`, `health`), which gives clean separation of concerns without the operational overhead a solo developer doesn't need.

---

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database — a free [Neon](https://neon.tech) instance is the fastest path, or run `docker compose up -d` in `backend/` for a local one
- A Google Cloud OAuth 2.0 Client ID ([console.cloud.google.com](https://console.cloud.google.com/apis/credentials)) — add `http://localhost:3001` as an authorized JavaScript origin for local dev

### Setup

```bash
git clone https://github.com/<your-username>/glovebox.git
cd glovebox

# Backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, GOOGLE_CLIENT_ID
npm install
npx prisma migrate dev
npm run start:dev      # http://localhost:3000

# Frontend
cd ../frontend
cp .env.example .env.local   # fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
npm install
npm run dev             # http://localhost:3001
```

### Running tests

```bash
# Backend — unit tests (fast, no DB required)
cd backend && npm test

# Backend — e2e tests (hits a real Postgres instance via DATABASE_URL)
cd backend && npm run test:e2e
```

---

## Deployment

The app is designed to run with the frontend and backend on **different domains** (e.g. Vercel + Render) — that's already accounted for in the auth cookie config (`SameSite=None; Secure` in production) and CORS setup, not something you need to patch.

### 1. Database
Use the same Neon (or any managed Postgres) instance you used for development, or provision a new one. Run migrations against it once before first deploy:
```bash
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

### 2. Backend (Render, Railway, Fly.io, or similar)
- **Build command:** `npm install && npm run build:render` (runs `prisma migrate deploy` before building — `/health` only pings the DB, so auth will 409 if migrations never ran on the production database)
- **Start command:** `npm run start:prod`
- **Health check path:** `/health`
- **Environment variables** (see `backend/.env.example`):
  - `NODE_ENV=production`
  - `DATABASE_URL` — your production Postgres connection string
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` — generate fresh, unique 32+ character secrets for production; never reuse dev values
  - `FRONTEND_URL` — your deployed frontend's exact origin (e.g. `https://glovebox.vercel.app`) — CORS only allows this one origin
  - `GOOGLE_CLIENT_ID` — same Google OAuth Client ID as the frontend

### 3. Frontend (Vercel)
- Framework preset: Next.js (auto-detected)
- **Environment variables** (see `frontend/.env.example`):
  - `NEXT_PUBLIC_API_URL` — your deployed backend's API base, e.g. `https://glovebox-api.onrender.com/api/v1`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — your Google OAuth Client ID (this one is meant to be public — the backend independently re-verifies every credential, it never trusts the client alone)

### 4. Google OAuth console
After both are deployed, go back to your OAuth Client in Google Cloud Console and add your **production frontend URL** as an authorized JavaScript origin (and as an authorized redirect URI if prompted). Google Sign-In will silently fail on the deployed site until this is done — it's scoped per-origin.

### Known deployment blockers
- `frontend/package-lock.json` must be generated on a machine without the sandboxed-environment npm bug described in `glovebox-architecture.md` — already done as of this writing.
- Photo/receipt uploads are not yet implemented (needs S3/R2 credentials) — nothing to configure for them yet.

---

## Project structure

```
backend/
  src/
    modules/
      auth/
      cars/
      expenses/
      analytics/
      friends/
      users/
      health/
    common/
    config/
    database/
  prisma/
    schema/           # multi-file Prisma schema
    migrations/

frontend/
  app/
    dashboard/
      analytics/
      cars/
      friends/
    login/
  features/
    cars/
    expenses/
    shell/
  lib/                # API clients, vehicle catalog
  hooks/              # TanStack Query hooks
  public/
    vehicle-catalog-global.json   # lazy-loaded worldwide Make/Model data

glovebox-architecture.md   # full architecture, schema, and decision log
```

---

## Roadmap

- [x] Architecture and schema design
- [x] Auth (Google Sign-In, protected routes)
- [x] Garage — car CRUD, Make/Model/Variant autocomplete
- [x] Expenses — category-aware logging
- [x] Analytics — spend breakdowns, cost/km, monthly trends
- [x] Friends — requests, public garages
- [x] CI/CD (GitHub Actions)
- [ ] Photo and receipt uploads (S3/R2) — blocked on credentials
- [ ] Production deployment — blocked on hosting accounts
- [ ] Frontend automated test suite

See [`glovebox-architecture.md`](glovebox-architecture.md) for the detailed build log, including gotchas discovered along the way and every "why" behind these decisions.

---

## License

MIT — see [`LICENSE`](LICENSE).
