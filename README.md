# Glovebox

A car ownership and expense tracker, built by car enthusiasts, for car enthusiasts.

Track every car in your garage, log expenses by category, see real cost-per-km and spending trends, and compare notes with friends' public garages — all in a fast, MUI-based dashboard with light/dark themes.

> **Status:** in active development. See [Roadmap](#roadmap) for what's built vs. planned.

---

## Why this exists

Most expense trackers are either generic budgeting apps or bloated fleet-management tools built for businesses. Glovebox is neither — it's scoped specifically to what a car enthusiast actually wants to know: *what does this car really cost me, per km, per year, per category* — without dragging in a maintenance-scheduling module, a dozen integrations, or enterprise complexity nobody asked for.

It's also a full-stack portfolio project, built with a deliberate engineering philosophy: **every technology in the stack has to earn its place.** No Kubernetes, no microservices, no GraphQL, no infrastructure added because it looks good on a resume. See [`docs/glovebox-architecture.md`](docs/glovebox-architecture.md) for the full reasoning behind every decision.

---

## Features

- Auth with email/password and Google sign-in
- Multi-car garage — add, edit, and track any number of cars
- Expense logging with category-aware fields (service, tyres, repairs, fuel, insurance, mods)
- Analytics — total spend, spend by category, monthly trends, cost/km, fuel economy, year-over-year comparison
- Photo and receipt uploads (S3-backed, signed-URL flow)
- Friends — send/accept requests, view friends' public garages
- Light / dark / system theme
- *(planned)* "Ask your garage" — an AI assistant grounded in your own logged notes and receipts via RAG

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, MUI, TanStack Query, React Router |
| Backend | Node.js, NestJS, TypeScript |
| Database | PostgreSQL (+ `pgvector` for the planned AI/RAG layer) |
| Storage | AWS S3 (signed URLs for photos and receipts) |
| Auth | JWT access + refresh tokens, httpOnly cookies |
| Hosting | Vercel (frontend), Render/Railway (backend), managed Postgres |
| Testing | Jest + Supertest (backend), Vitest + React Testing Library (frontend) |
| CI/CD | GitHub Actions |

Full rationale for each choice — including what was deliberately *not* used and why — is in [`docs/glovebox-architecture.md`](docs/glovebox-architecture.md).

---

## Architecture

```
React (Vercel)
   │  HTTPS/JSON
   ▼
NestJS API (Render/Railway)
   │           │              │
   ▼           ▼              ▼
PostgreSQL   S3 (signed     Vehicle-data
(managed)    URLs)          API (3rd party)
```

A modular monolith, not microservices — one NestJS app with strict module boundaries (`auth`, `cars`, `expenses`, `analytics`, `friends`, `uploads`), which gives clean separation of concerns without the operational overhead a solo developer doesn't need. See the [ER diagram and schema doc](docs/glovebox-architecture.md#5-database-schema) for the full data model.

---

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local, or a free [Neon](https://neon.tech)/[Supabase](https://supabase.com) instance)
- An AWS S3 bucket (for photo/receipt uploads)

### Setup

```bash
git clone https://github.com/<your-username>/glovebox.git
cd glovebox

# Backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, S3 credentials
npm install
npx prisma migrate dev
npm run start:dev

# Frontend
cd ../frontend
cp .env.example .env   # fill in VITE_API_URL
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`, the backend at `http://localhost:3000`.

### Running tests

```bash
# Backend
cd backend && npm run test

# Frontend
cd frontend && npm run test
```

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
      uploads/
    common/
    config/
    database/

frontend/
  src/
    features/
      auth/
      garage/
      expenses/
      analytics/
      friends/
    api/
    hooks/
    types/

docs/
  glovebox-architecture.md   # full architecture, schema, and decision log
  glovebox-build-timeline.md # week-by-week build plan
```

---

## Roadmap

- [x] Architecture and schema design
- [ ] Auth (register, login, protected routes)
- [ ] Garage — car CRUD + photo uploads
- [ ] Expenses — category-aware logging + receipt uploads
- [ ] Analytics — spend breakdowns, cost/km, trends
- [ ] Friends — requests, public garages
- [ ] Testing, security, and observability hardening
- [ ] Vehicle-data API integration for auto-filled car specs
- [ ] RAG-powered "ask your garage" assistant (`pgvector` + LLM)

See [`docs/glovebox-build-timeline.md`](docs/glovebox-build-timeline.md) for the detailed week-by-week plan.

---

## License

MIT — see [`LICENSE`](LICENSE).
