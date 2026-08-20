# Glovebox — Architecture & Build Plan

*Reference doc: keep this open while you build. Based on the finalized "Glovebox — Dashboard Concept v4" UI (garage dashboard, car cards, health panel, category-aware expense modal, monthly analytics, friends/public garages, light/dark/system theme).*

---

## 1. Executive Summary

Glovebox is a **modular monolith**: React/TypeScript SPA talking to a single NestJS API, backed by PostgreSQL, with S3 for images/receipts and Redis added only once there's a real caching or job need. No microservices, no queues, no GraphQL, no second database. This stack lets you explain every decision in an interview and actually ship it solo in a few months of evenings/weekends.

---

## 2. Final Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + MUI + TanStack Query + React Router | Matches your finalized MUI design; TanStack Query removes 80% of the "server state" boilerplate you'd otherwise reach for Redux for. |
| Backend | Node.js + NestJS + TypeScript | Your domain has 8 real modules (auth, garage, cars, expenses, analytics, friends, uploads) — NestJS's module/DI structure maps 1:1 onto that and keeps a monolith from turning into spaghetti. Express would work but you'd hand-roll what Nest gives free (guards, pipes, DTO validation, module boundaries). |
| Database | PostgreSQL | Domain is relational (users→garages→cars→expenses→attachments) and analytics-heavy (aggregations, GROUP BY, window functions). One database does both jobs well. |
| ORM | Prisma **or** TypeORM | Prisma for migration ergonomics and type-safety; TypeORM if you want to stay closer to NestJS convention. Either is fine — pick Prisma if unsure, better DX for a solo dev. |
| Storage | AWS S3 (or Cloudflare R2 for cheaper egress) | Car photos + receipts are unstructured blobs; don't put them in Postgres. |
| Cache/Jobs | Redis — **not on day 1** | See Part 7. |
| Auth | JWT access + refresh tokens, httpOnly cookies | Stateless, scales fine for this size, standard interview-defensible pattern. |
| 3rd-party API | Vehicle-data API (see Part 13) | One meaningful integration, chosen for reliability over completeness. |
| Hosting | Vercel (frontend) + Render/Railway (backend) + managed Postgres (Neon/Supabase/RDS) + S3 | Zero infra maintenance for a solo dev; upgrade path to AWS exists if needed. |
| Testing | Jest + Supertest (backend), Vitest + React Testing Library (frontend) | Standard, well-documented, fast. |
| CI/CD | GitHub Actions | Free, ubiquitous, easy to explain. |

### Deliberately NOT used
❌ Microservices — one team (you), no independent scaling need.
❌ Kubernetes — no orchestration problem to solve.
❌ Kafka / message queues — no event-driven requirement yet.
❌ Elasticsearch — Postgres full-text search (`tsvector`) is enough for username/car search at this scale.
❌ GraphQL — REST is simpler to reason about, cache, and secure for a CRUD-plus-analytics app.
❌ Redux — TanStack Query + local component state covers everything here.
❌ Multiple databases — one relational store serves both transactional and analytical needs at this scale.

---

## 3. High-Level Architecture

```
React (Vercel)
   │  HTTPS/JSON
   ▼
NestJS API (Render/Railway)
   │           │              │
   ▼           ▼              ▼
PostgreSQL   S3 (signed     Vehicle-data
(managed)    URLs)          API (3rd party)

Optional, added later:
   Redis (cache / rate-limit)
   Email provider (password reset, friend requests)
   Sentry (errors) + basic uptime/log monitoring
```

- **React**: renders UI, owns client/UI state, calls the API.
- **NestJS**: single source of truth for business rules, auth, authorization, validation.
- **PostgreSQL**: transactional data + analytics aggregation.
- **S3**: binary storage only; DB stores metadata + keys.
- **Vehicle-data API**: called server-side when a car is added, response cached in DB (not re-fetched every time).

---

## 4. Backend Architecture (Modular Monolith)

Yes — validate the modular monolith call. You have clean bounded contexts (auth, garage, cars, expenses, analytics, friends, uploads) but no independent scaling, deployment, or team-ownership need that would justify splitting into services. A modular monolith gives you those same boundaries in code, enforced by NestJS module imports, with none of the network/ops overhead.

```
src/
  modules/
    auth/          # register, login, refresh, guards, password reset
    users/         # profile, public profile lookups
    garage/        # a user's collection wrapper (mostly implicit via cars)
    cars/          # CRUD, car images, vehicle-data enrichment
    expenses/      # CRUD, category-specific fields, attachments
    analytics/      # aggregation queries, exposed as read-only endpoints
    friends/       # requests, friendships, public-garage visibility
    uploads/       # signed URL issuance, file metadata
  common/          # guards, interceptors, pipes, decorators
  config/          # env validation, typed config service
  database/        # Prisma/TypeORM setup, migrations
```

**Module boundaries**: each module only imports what it needs from others via exported services (e.g., `expenses` imports `cars` service to verify ownership, never reaches into `cars`' repository directly). No module talks to another module's database table without going through its service.

---

## 5. Database Schema

Core tables (not over-normalized — e.g., no separate `Address` table for a single city field):

```sql
User(id PK, email UNIQUE, username UNIQUE, password_hash, created_at)
Profile(id PK, user_id FK→User UNIQUE, display_name, avatar_url, bio)

Car(id PK, user_id FK→User, make, model, year, variant, vin NULL,
    engine, fuel_type, transmission, body_type, power_bhp NULL,
    vehicle_api_ref NULL, odometer_km, created_at)
CarImage(id PK, car_id FK→Car, s3_key, is_primary BOOLEAN, created_at)

ExpenseCategory(id PK, name UNIQUE)  -- seeded: fuel, service, tyres, repair, insurance, mods, other
Expense(id PK, car_id FK→Car, category_id FK→ExpenseCategory,
        amount NUMERIC, currency, expense_date, odometer_km NULL,
        workshop_name NULL, notes NULL, created_at)
ExpenseAttachment(id PK, expense_id FK→Expense, s3_key, created_at)

FriendRequest(id PK, from_user_id FK→User, to_user_id FK→User,
              status ENUM(pending,accepted,rejected), created_at,
              UNIQUE(from_user_id, to_user_id))
Friendship(id PK, user_a_id FK→User, user_b_id FK→User, created_at,
           UNIQUE(user_a_id, user_b_id))
```

Notes:
- Category-specific fields (workshop, tyre size, "what broke") live as **nullable columns on `Expense`**, not separate tables per category — matches your product decision to avoid a Maintenance module. If this grows past ~5 category-specific fields, revisit with a JSONB `details` column instead of adding more nullable columns.
- `Friendship` is the accepted, symmetric relationship; `FriendRequest` is the pending workflow. Keep them separate — don't overload one table with a status enum for both directions, it gets confusing at the authorization layer.
- No `FuelEntry`, `CarHistory`, or `Modification` tables yet — they'd just be `Expense` rows with `category = fuel/mods`. Only split them out if you need fuel-economy-specific fields (liters, station) that don't fit `Expense` cleanly — likely at that point a `FuelEntry` table with expense linkage makes sense.

---

## 6. ER Diagram (Standalone Reference)

```
┌────────────┐        ┌─────────────┐
│    User    │1──────1│   Profile   │
└─────┬──────┘        └─────────────┘
      │1
      │
      │N
┌─────▼──────┐        ┌──────────────┐
│    Car     │1──────N│   CarImage   │
└─────┬──────┘        └──────────────┘
      │1
      │
      │N
┌─────▼──────┐        ┌────────────────────┐
│  Expense   │N──────1│  ExpenseCategory   │
└─────┬──────┘        └────────────────────┘
      │1
      │
      │N
┌─────▼──────────────┐
│ ExpenseAttachment   │
└─────────────────────┘

┌────────────┐   N        N   ┌────────────┐
│    User    │────────────────│    User    │
└────────────┘   (via)         └────────────┘
        FriendRequest (pending workflow)
        Friendship (accepted, symmetric N:M)
```

- **PK** = `id` on every table (UUID recommended over serial int, avoids leaking row counts and plays nicer with distributed IDs later).
- **FK**: `Profile.user_id`, `Car.user_id`, `CarImage.car_id`, `Expense.car_id`, `Expense.category_id`, `ExpenseAttachment.expense_id`, `FriendRequest.from_user_id/to_user_id`, `Friendship.user_a_id/user_b_id`.
- **1:1**: User↔Profile.
- **1:N**: User→Car, Car→CarImage, Car→Expense, Expense→ExpenseAttachment, ExpenseCategory→Expense.
- **N:M**: User↔User via FriendRequest/Friendship join tables.
- **Unique constraints**: `User.email`, `User.username`, `(from_user_id, to_user_id)` on FriendRequest, `(user_a_id, user_b_id)` on Friendship.

---

## 7. Indexing Strategy

| Query | Index |
|---|---|
| Get all cars for a user | `Car(user_id)` — FK index, near-mandatory |
| Recent expenses for a car | `Expense(car_id, expense_date DESC)` composite |
| Expenses between dates | Same composite covers range scans on `expense_date` |
| Spend by category | `Expense(car_id, category_id)` composite, or rely on the above + planner if data is small |
| Search users by username | `User(username)` — already unique, so already indexed; add `pg_trgm` GIN index only if you need fuzzy/partial search |
| Friend requests (incoming) | `FriendRequest(to_user_id, status)` |
| Friend's public garage | `Car(user_id)` again — same index serves both owner and friend-viewing paths |
| Expenses ordered by date | Covered by the `(car_id, expense_date DESC)` composite |

Guidance:
- Every FK gets an index by default (Postgres does **not** auto-index FKs the way it does PKs).
- Composite indexes should put the **equality filter column first**, the **sort/range column second** (`car_id` then `expense_date`).
- Don't index low-cardinality columns alone (e.g. `category_id` by itself isn't useful — always pair with `car_id`).
- Every index costs write throughput and disk; at this data scale (one user's cars/expenses, not millions of rows) start with just the FK + composite indexes above and add more only if `EXPLAIN ANALYZE` shows a seq scan actually hurting you.

---

## 8. Redis — Honest Answer

**No, you don't need Redis on day 1.** Nothing in this app has a caching or job problem yet — analytics queries on one user's data are cheap, there's no rate-limiting requirement beyond what a simple in-memory guard handles, and there are no background jobs.

**Build later, if:**
- Analytics dashboards get slow as expense history grows → cache aggregation results with keys like `analytics:car:{carId}:2026`, `analytics:garage:{garageId}:2026`, invalidated on new expense write for that car/year.
- You add rate limiting across multiple server instances (a single instance can rate-limit in-memory).
- You add background jobs (e.g., nightly vehicle-API sync, email digests) — pair with BullMQ.

**Don't build:** Redis as a session store — JWT is already stateless here.

---

## 9. Authentication & Authorization

- **Signup/Login**: email + password, `bcrypt`/`argon2` hashing, or Google OAuth (matches your mockup's Google sign-in button) — you can support both.
- **Tokens**: short-lived JWT access token (~15 min) + longer-lived refresh token, both in httpOnly, secure, SameSite cookies (not localStorage — avoids XSS token theft).
- **Password reset**: signed, time-limited token emailed to user; single-use.
- **Email verification**: optional for v1, but recommended before allowing friend requests (reduces fake accounts).
- **Rate limiting**: `@nestjs/throttler` on `/auth/*` endpoints.

**Authorization rules:**
- *User A → User B's expenses*: every `cars`/`expenses` service method takes the requesting user's ID from the JWT and filters `WHERE user_id = :requestingUserId` (or checks `car.user_id === requestingUserId`) before returning or mutating anything — never trust a resource ID alone.
- *User A → User B's public garage*: a **separate, explicitly read-only** endpoint (`GET /users/:username/garage`) that only returns fields marked public (cars list, no VIN/odometer-history/expenses) and only if a `Friendship` row exists between the two users.

---

## 10. File Upload Architecture

```
React → POST /uploads/sign (file name, type) → NestJS validates → returns S3 presigned PUT URL
React → PUTs file directly to S3
React → POST /cars/:id/images (or /expenses/:id/attachments) with the S3 key → NestJS stores metadata
```

- **Presigned URLs**: backend never proxies file bytes — cheaper and simpler.
- **Validation**: check MIME type and extension server-side before issuing the URL (image/jpeg, image/png, application/pdf for receipts); enforce max size (e.g. 8MB) both client-side and via S3 bucket policy/content-length.
- **Public/private**: car photos can be public-read (served via CloudFront later if needed); receipts stay private, served via short-lived signed GET URLs only to the owner.
- **Resizing**: generate a thumbnail on upload only if list views get slow — otherwise let the browser downscale via `srcset`/CSS for v1.

---

## 11. REST API Structure

```http
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh

GET    /cars
POST   /cars
GET    /cars/:id
PATCH  /cars/:id
DELETE /cars/:id
POST   /cars/:id/images

GET    /cars/:id/expenses
POST   /cars/:id/expenses
PATCH  /expenses/:id
DELETE /expenses/:id
POST   /expenses/:id/attachments

GET    /analytics/garage
GET    /analytics/cars/:id

GET    /friends
GET    /friends/requests
POST   /friends/requests/:userId
POST   /friends/requests/:id/accept
DELETE /friends/:userId

GET    /users/:username
GET    /users/:username/garage
```

Conventions: plural nouns, nested resources for ownership-scoped reads (`/cars/:id/expenses`), flat resources with their own ID for direct mutation (`/expenses/:id`). Every mutating route runs through an auth guard + ownership check.

---

## 12. Frontend Architecture

```
src/
  app/            # routing, providers, theme setup
  components/     # shared, dumb UI pieces (buttons, cards, stat tiles)
  features/
    auth/
    garage/       # dashboard, car cards, car details
    cars/
    expenses/     # expense modal, category-aware fields
    analytics/    # charts, monthly breakdown
    friends/
  api/            # typed API client functions, one per resource
  hooks/          # TanStack Query hooks wrapping api/
  types/
  utils/
```

- **Server state**: entirely TanStack Query — cars, expenses, analytics, friends all fetched/cached/invalidated through it (e.g., adding an expense invalidates `['expenses', carId]` and `['analytics', carId]`).
- **Local/UI state**: `useState`/`useReducer` per component — modal open/close, selected category, selected month (matches the `selectMonth` behavior already in your mockup).
- **Forms**: React Hook Form + Zod for validation, matching the DTO validation shape on the backend (share the Zod schema shape conceptually with the NestJS `class-validator` DTOs).
- **Auth state**: a small context/hook wrapping "am I logged in" derived from a `/auth/me` query, not Redux.
- **Routing**: React Router, protected routes wrapping anything past `/dashboard`.
- **Error/loading**: TanStack Query's built-in `isLoading`/`isError` states, rendered as skeletons/toasts consistent with your MUI theme.

Redux isn't needed — there's no complex client-only state that outlives a component tree here.

---

## 13. MUI Design System

- Central `theme.ts` mapping your existing CSS variables (`--accent`, `--good`, `--warn`, `--bad`, `--radius`, `--shadow`) into MUI's `palette`, `shape.borderRadius`, and `typography` (Inter + JetBrains Mono for numeric/odometer values, matching your mockup's `--mono`).
- Light/dark/system handled via MUI's `ColorSchemeProvider`/CSS-variable theming (MUI v6 supports this natively) — mirrors the `data-theme` attribute switch already in your HTML.
- Build a small internal component library once, reused everywhere: `StatCard`, `CarCard`, `HealthRow`, `CategoryButton`, `ExpenseModal` — don't hand-style each instance.

---

## 14. Analytics Architecture

Your assumption is right — validated:

```
PostgreSQL (GROUP BY / date_trunc / window functions)
   ↓
NestJS analytics service (thin — mostly passes query results through)
   ↓
TanStack Query
   ↓
Recharts/MUI X Charts
```

- **Total spend / by category**: `SELECT category_id, SUM(amount) FROM expense WHERE car_id = $1 GROUP BY category_id`.
- **Monthly spending**: `date_trunc('month', expense_date)` grouping.
- **Cost/km**: `SUM(amount) / (latest_odometer - first_odometer)` per car.
- **Fuel economy**: needs odometer deltas between fuel entries — doable with a window function (`LAG(odometer_km) OVER (PARTITION BY car_id ORDER BY expense_date)`).
- **Year-over-year / garage comparison**: same grouping queries, additional `WHERE` on year, or comparing across `car_id IN (...)` for a user's whole garage.

Don't add materialized views or a warehouse yet. **If it grows**: first add the Redis caching from Part 8, then consider materialized views refreshed nightly only if aggregation queries genuinely get slow (thousands of expenses per car, not before).

---

## 15. Third-Party Integration Strategy

**Primary: Vehicle-data API** for make→model→year→variant→specs on car creation.

Evaluate real options before committing (do this as a live step — pricing/coverage changes):
- APIs with strong Indian-market and older/rare-car coverage vary a lot; check current coverage, pricing tiers, and rate limits before locking one in, since general-purpose VIN-decode APIs (built for US/EU markets) often have weak coverage for older Indian-market and JDM-import cars.
- **Fallback design matters more than the API choice**: always let the user manually enter/override engine, fuel type, transmission, etc. — treat the API as autofill, not a hard dependency. This is the actually-interesting engineering point to talk about in an interview: graceful degradation when a third-party data source has gaps.
- Cache the API response per make/model/year/variant combination in your own DB (`vehicle_api_ref` + a small reference table) so you're not re-calling the API for every car of the same model.

**Worth considering, but be selective:**
- Email provider (Resend/Postmark) for password reset + friend-request notifications — genuinely needed, low complexity.
- Currency/exchange-rate API only if you support multi-currency gaming — skip for v1 if all users are INR.

---

## 16. Testing Strategy

**Backend**: unit tests for services (especially authorization logic), integration tests for controllers hitting a test DB, a handful of e2e tests for the critical flows below.
**Frontend**: component tests for the expense modal (category-field switching) and car card; a few integration tests for the auth flow.

Prioritize:
```
Authorization (User A cannot touch User B's data) — highest priority, test explicitly
Expense creation (including category-specific fields)
Car creation
Analytics calculations (spot-check against known fixture data)
Friend requests (send/accept/reject)
Public/private garage visibility
```
Don't chase 100% coverage — a solo dev's time is better spent covering the authorization and money-calculation paths thoroughly than hitting every getter.

---

## 17. Security Checklist

- Passwords: bcrypt/argon2, never logged, never returned in any response.
- Cookies: httpOnly, Secure, SameSite=Lax (or Strict), short-lived access token.
- CORS: explicit allowlist of your frontend origin only.
- CSRF: mitigated by SameSite cookies + double-submit token on state-changing requests if you want defense in depth.
- XSS: React escapes by default — audit any `dangerouslySetInnerHTML` usage (should be none here).
- SQL injection: parameterized queries via Prisma/TypeORM — never string-concatenate SQL.
- Validation: `class-validator` DTOs on every endpoint, reject unknown fields (`whitelist: true`, `forbidNonWhitelisted: true`).
- File uploads: MIME + size validation server-side, never trust client-reported type.
- Rate limiting: on auth endpoints and friend-request creation (prevent spam).
- Secrets: `.env` + a secrets manager on the hosting platform, never committed.
- Secure headers: `helmet` middleware.

---

## 18. Observability

- **Logging**: structured JSON logs (`pino` or Nest's built-in logger configured for JSON) shipped to your hosting platform's log viewer.
- **Error tracking**: Sentry, free tier, both frontend and backend.
- **API monitoring**: basic uptime check (UptimeRobot/Better Uptime free tier) + Render/Railway's built-in metrics.
- **Performance**: skip a dedicated APM tool for v1 — Sentry's performance tracing covers enough at this scale.

Don't add five tools — Sentry + platform logs + one uptime check is enough to talk about intelligently in an interview.

---

## 19. CI/CD

```
GitHub → Pull Request → GitHub Actions:
  lint → typecheck → unit tests → build
  (on merge to main) → deploy frontend (Vercel auto) + backend (Render/Railway auto or via Action)
```

Tools: GitHub Actions (free for public/small private repos), ESLint + Prettier, `tsc --noEmit` for typecheck.

---

## 20. Deployment

**Recommended (solo-dev realistic):**
```
Frontend  → Vercel
Backend   → Render or Railway (managed Postgres add-on or Neon/Supabase separately)
Storage   → S3 (or Cloudflare R2)
```
Zero server maintenance, generous free/cheap tiers, deploys on git push.

**AWS-heavier alternative (for interview-story completeness, not for you to actually run day-to-day):**
```
Frontend  → S3 + CloudFront
Backend   → ECS Fargate (single service) or Elastic Beanstalk
Database  → RDS Postgres
Storage   → S3
Secrets   → AWS Secrets Manager
```
Know this exists and why you'd move to it (more control, VPC isolation, compliance needs) — but don't build it for a solo portfolio project.

---

## 21. Step-by-Step Development Roadmap

**Vertical slices — yes, recommended over big horizontal phases.** Given your UI is already fully designed, building complete vertical slices (backend + frontend + connection, one module at a time) means you always have something demoable, and you catch integration mismatches early instead of at the end. This is also a stronger interview story than "I built the whole backend, then the whole frontend."

**Exact order:**

1. **Foundations** (few days): repo setup, NestJS + React scaffolds, Postgres connection, base CI, deploy skeleton "hello world" of each to Vercel/Render early — get the deploy pipeline working before you have real features, not after.
2. **Slice 1 — Auth**: User schema → auth API (register/login/refresh/logout) → login/signup/logout UI → protected routes → connect → test.
3. **Slice 2 — Garage/Cars**: Car + CarImage schema → car CRUD API → dashboard + car cards + add/edit/delete car UI → connect.
4. **Slice 3 — Expenses**: ExpenseCategory + Expense schema → expense CRUD API → expense modal with category-aware fields → expense history UI → connect.
5. **S3 uploads** (fits naturally inside slice 2/3): signed URL flow → car photo upload → receipt upload.
6. **Slice 4 — Analytics**: aggregation queries → analytics API → charts/cost-per-km/insights UI → connect.
7. **Vehicle-data API integration**: add during or right after Slice 2, since it enriches car creation — don't bolt it on at the very end.
8. **Slice 5 — Friends**: FriendRequest/Friendship schema → friends API → friends list/requests/public-garage UI → connect.
9. **Redis**: only introduced here if analytics or friend-request rate limiting actually need it — otherwise skip entirely for v1.
10. **Testing**: write tests alongside each slice (not as a separate phase) — but do a dedicated pass on authorization tests once auth + expenses + friends all exist, since that's where cross-user bugs hide.
11. **Production hardening**: security checklist pass, Sentry wiring, CI/CD tightening, final deploy — last 1–2 weeks before calling it "done."

---

## 22. Module-by-Module Implementation Checklist

### MODULE: AUTH
**Backend**
- [ ] User migration + entity
- [ ] Register/login DTOs + validation
- [ ] Password hashing
- [ ] Auth service (register, login, refresh, logout)
- [ ] JWT strategy + guards
- [ ] Auth controller
- [ ] Rate limiting on auth routes
- [ ] Tests: register, login, invalid credentials, refresh, guard rejection

**Frontend**
- [ ] Login page
- [ ] Signup page
- [ ] Auth API hooks
- [ ] Protected route wrapper
- [ ] Error/loading states
- [ ] Logout

**Integration**
- [ ] Connect frontend to real API (remove mock data)
- [ ] Full login→dashboard→logout flow test

**Done when**: a new user can register, log in, see the dashboard, refresh the page and stay logged in, and log out — with no way to reach the dashboard unauthenticated.

### MODULE: GARAGE / CARS
**Backend**: migration, Car entity, DTOs, CRUD service/controller, ownership guard, image upload endpoint, tests (CRUD + cross-user access denial).
**Frontend**: dashboard car grid, add/edit/delete car forms, car detail page, image upload UI.
**Integration**: connect, verify a car created by User A is invisible to User B's `/cars` call.
**Done when**: full CRUD works end-to-end and ownership is enforced server-side, not just hidden in the UI.

### MODULE: EXPENSES
**Backend**: migration, Expense/ExpenseCategory entities, category-aware DTO validation, CRUD, attachment upload, tests (creation, ownership, category-field handling).
**Frontend**: expense modal (category switching), expense history list, edit/delete.
**Integration**: connect, verify amounts/dates render correctly, receipt upload works.
**Done when**: expenses can be created for any category with the right fields, edited, deleted, and are correctly scoped to the owning user's cars only.

### MODULE: ANALYTICS
**Backend**: aggregation queries, analytics endpoints (read-only), tests against known fixture data.
**Frontend**: stat cards, monthly bar chart, cost/km, category breakdown.
**Integration**: connect, spot-check numbers against manually-computed expected values.
**Done when**: every number on the analytics page matches a manual calculation from the same fixture data.

### MODULE: FRIENDS
**Backend**: FriendRequest/Friendship schema, send/accept/reject, public-garage endpoint, tests (can't friend-request twice, can't see non-friend's private data).
**Frontend**: friends list, incoming/outgoing requests, friend's public garage view.
**Integration**: connect, verify a non-friend genuinely cannot fetch another user's garage via the API directly (not just hidden in UI).
**Done when**: the full request→accept→view-public-garage flow works and is authorization-tested, not just UI-tested.

---

## 23. Git / Development Workflow

For a solo developer, keep it simple:

```
main
feature/*
```

Skip a permanent `develop` branch — it adds merge overhead with no team to coordinate with. Branch per feature/slice, PR into `main` (even solo — gives you a CI gate and a clean history), merge and delete.

**Commit conventions** (Conventional Commits):
```
feat: add expense creation API
feat: add garage dashboard
fix: prevent unauthorized expense access
test: add expense authorization tests
chore: configure CI pipeline
```

---

## 24. Portfolio / Interview Talking Points

**Why PostgreSQL?**
What I built: single relational store for both transactional and analytical workloads. Why: the domain is highly relational (users→cars→expenses→attachments) and analytics-heavy (aggregations, per-car cost calculations). Problem solved: avoids a second analytics system for a dataset this size. Trade-off: at very large scale you'd eventually want read replicas or a dedicated analytics store — not needed here. Scale path: add read replicas, then materialized views, before ever reaching for a separate warehouse.

**Why a modular monolith, not microservices?**
What I built: one NestJS app with strict module boundaries. Why: no independent scaling or team-ownership need exists yet. Problem solved: keeps deployment and debugging simple while still enforcing clean domain boundaries in code. Trade-off: can't scale one module independently of others. Scale path: if one module (e.g. analytics) genuinely needed independent scaling, it's already isolated enough to extract into its own service later.

**Why JWT over sessions?**
What I built: stateless access+refresh tokens in httpOnly cookies. Why: no server-side session store needed, scales horizontally without sticky sessions. Trade-off: revocation is harder than with server-side sessions (mitigated with short access-token TTL). Scale path: add a Redis-backed denylist for immediate revocation if that becomes a requirement.

**Why presigned S3 URLs instead of proxying uploads through the API?**
What I built: client uploads directly to S3 via a short-lived signed URL. Why: keeps large file bytes off your API server entirely — cheaper, faster, and removes a whole class of upload-size/timeout problems. Trade-off: slightly more client-side complexity (two-step upload). Scale path: add CloudFront in front of public assets once traffic justifies it.

**Why no Redis on day 1?**
What I built: nothing — deliberately. Why: no caching or job problem exists yet at this scale. Problem it avoids: premature infrastructure with no corresponding need, which is its own maintenance cost. Scale path: added precisely when analytics queries or rate-limiting needs demonstrate the need, with concrete cache keys already designed (Part 8).

---

## What NOT to Build

❌ Microservices — no team/scaling driver
❌ Kubernetes — no orchestration problem
❌ Kafka — no event-driven requirement
❌ Elasticsearch — Postgres `tsvector`/`pg_trgm` covers search at this scale
❌ GraphQL — REST is simpler here and easier to secure/cache
❌ Redux — TanStack Query + local state is enough
❌ Multiple databases — one Postgres instance does both jobs
❌ Complex event-driven architecture — nothing here needs it
❌ Dedicated Maintenance module — stays as expense categories, per your product decision

*Nothing above is challenged as wrongly excluded — each was checked against the actual feature set and genuinely isn't justified yet.*
