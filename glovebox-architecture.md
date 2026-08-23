# Glovebox — Architecture & Build Plan

*Reference doc: keep this open while you build. Based on the finalized "Glovebox — Dashboard Concept v4" UI (garage dashboard, car cards, health panel, category-aware expense modal, monthly analytics, friends/public garages, light/dark/system theme).*

*Updated 2026-08-23 to match the code actually in the repo (see [Section 0](#0-current-implementation-status)). A few stack decisions below have since been locked in (Prisma over TypeORM, Next.js instead of a plain React+Vite SPA, **Google Sign-In only — no email/password auth at all**) — those sections are marked accordingly rather than left as open choices.*

---

## 0. Current Implementation Status

**Foundations + Slices 1–5 (Auth, Cars, Expenses, Analytics, Friends) are all built.** Image/receipt upload and vehicle-data-API enrichment are the only deliberately deferred pieces — see below. This section is the source of truth for "what's real right now"; treat every other section as the target design, not the current state.

**⚠️ Project-wide gotcha #1, discovered while building Cars — read before writing any new service method:** `@prisma/adapter-pg` (Prisma 7's Postgres driver adapter) **does not support two concurrent queries on the same `PrismaClient` instance, and — confirmed later, while building Friends — `$transaction` fails in every form, not just concurrent batches.** `Promise.all([prisma.x.a(), prisma.x.b()])`, `prisma.$transaction([a, b])` (array-batch), and even `prisma.$transaction(async (tx) => { await tx.a(); await tx.b(); })` (the interactive callback form, despite awaiting sequentially *inside* the callback) all fail with `Invalid \`prisma.x.y()\` invocation` or `Unable to start a transaction in the given time`. This is a confirmed upstream limitation with this adapter + Neon's pooled connection, not a bug in this codebase (see [prisma/prisma#29407](https://github.com/prisma/prisma/issues/29407), [#27901](https://github.com/prisma/prisma/issues/27901)). **There is no way to get atomic multi-statement writes in this stack right now — every multi-step write (e.g., `FriendsService.acceptRequest`: create a `Friendship`, then delete the `FriendRequest`) has to be plain sequential `await`s with no transactional safety net.** Where that matters, order operations so a failure between steps leaves a safely-*retryable* state rather than a lost one (`acceptRequest` creates the friendship first, so a failure before the delete just leaves the request "still pending" — never "friendship gone, but request also gone"). Sequential Prisma calls are otherwise unaffected and fully reliable — only concurrency and `$transaction` itself are the problem.

**⚠️ Gotcha #2, discovered while building Expenses — read before wiring any dialog that's reused across different records:** `react-hook-form`'s `useForm({ defaultValues })` captures `defaultValues` **once, at mount** — changing the prop on a later render does *not* reset the form. `ExpenseFormDialog` is one component instance reused for both "create" and "edit any expense," so editing expense A, then editing expense B without the dialog unmounting in between, silently kept expense A's stale values (a date field in particular kept showing the value from whenever the dialog first mounted, not the record actually being edited) — confirmed via a Playwright-driven browser test, not just reasoning about it. **Fix**: give the dialog a `key` prop tied to the record's identity (`key={editingExpense?.id ?? 'new'}`) so React fully remounts it — and re-mount on `key={car.updatedAt}` for `CarFormDialog` too, since editing, saving, then immediately reopening edit had the same latent staleness. **Any future dialog/form reused across different records needs the same `key` treatment** — don't rely on `defaultValues` alone to reflect prop changes.

**⚠️ Gotcha #3 — a real production bug, found and fixed while building Friends:** `main.ts` registered `app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter())`. **NestJS checks global exception filters in *reverse* registration order** — so `AllExceptionsFilter` (registered last, decorated with a bare `@Catch()` that matches literally everything) was intercepting *every* exception before `PrismaExceptionFilter`'s more specific `@Catch(Prisma.PrismaClientKnownRequestError)` ever got a chance to run. This meant every documented "a duplicate `email`/`username`/etc. surfaces as a clean `409`" claim earlier in this doc was **never actually true** — any genuine Prisma unique-constraint violation reaching the API returned a generic `500`, in production, since Auth was first built. It went undetected for three whole slices because Auth/Cars/Expenses all pre-check for existence (`findUnique`) before ever calling `create()`, so a real `P2002` was never actually thrown through the API until `FriendsService.sendRequest` — which deliberately *does* let the DB catch the same-direction duplicate via its unique constraint — finally exercised the path in an e2e test. **Fixed** by swapping the order (`useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter())`, both in `main.ts` and every e2e test's setup, which must mirror it exactly). Lesson for any future global filter added: registration order is significant and backwards from what reads naturally — the most specific filter goes *last*.

**⚠️ Gotcha #4 — a real cross-domain auth bug, found while prepping for deployment:** `auth.controller.ts`'s `setAuthCookies` set `sameSite: 'lax'` unconditionally on both `access_token` and `refresh_token`. That's invisible in local dev, where frontend and backend both live on `localhost` — but once frontend (Vercel) and backend (Render/Railway) sit on genuinely different domains, `SameSite=Lax` cookies are only sent on top-level navigation, **not** on cross-site `fetch`/XHR requests. A real deploy would have looked like a working login (the `Set-Cookie` header lands fine, the cookie is visible in devtools) followed by every subsequent authenticated request silently failing to attach it — the user appears logged out immediately after logging in. **Fixed** by making it conditional: `sameSite: isProduction ? 'none' : 'lax'` (`SameSite=None` requires `Secure=true`, which was already conditional on `isProduction`). One adjacent lint-autofix lesson worth remembering: the `shared` cookie-options object had to be explicitly typed as Express's `CookieOptions` (`import type { CookieOptions } from 'express'`) because a prior `eslint --fix` run had silently stripped an inline type assertion TypeScript actually needed to keep `sameSite` as its literal union type rather than a widened `string` — a quiet build break introduced by the tool meant to prevent them, not caught by lint itself.

**Auth is Google Sign-In only — this is a deliberate pivot from the rest of this doc.** The finalized mockup only shows a "Continue with Google" button, no password fields anywhere. As a result: there is no `passwordHash` column, no register/login DTOs, no password-reset flow, and `argon2` was removed as a dependency. Wherever this doc still describes email+password auth (Sections 9, 17, 22's Auth checklist), read it as superseded by what's below.

**Backend** (`backend/`) — NestJS 11 + Prisma 7:
- `src/config/` — typed config (`configuration.ts`) + Zod-validated env (`env.validation.ts`): `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`.
- `src/database/` — `PrismaService`/`PrismaModule`. Prisma 7 requires a driver adapter (no bundled query engine binary anymore) — wired via `@prisma/adapter-pg` (`PrismaPg`) in `prisma.service.ts`.
- `prisma/schema/` — **multi-file schema** (`prisma/schema/schema.prisma` for the generator/datasource, one file per model), not a single `schema.prisma`. `User(id uuid, email unique, username unique, googleId unique, displayName?, avatarUrl?, createdAt, updatedAt)`. `username` is auto-generated server-side from the email's local part at first sign-in (collision-safe, numeric-suffix retry), never supplied by the client.
- `src/modules/health/` — `GET /health` (version-neutral, outside both the `api` prefix and `v1` versioning) using `@nestjs/terminus` with a `PrismaHealthIndicator` ping.
- `src/modules/auth/` — **built**: `AuthModule`/`AuthController`/`AuthService`, `JwtStrategy`/`JwtRefreshStrategy` (passport-jwt, reading `access_token`/`refresh_token` httpOnly cookies via `cookie-parser`), `JwtAuthGuard`/`JwtRefreshGuard`, a `CurrentUser` decorator, and a `toSafeUser` mapper that strips `googleId` from every API response. Routes: `POST /api/v1/auth/google` (verifies the client-side Google ID token via `google-auth-library`, finds-or-creates the user, sets both cookies), `GET /api/v1/auth/me` (guarded), `POST /api/v1/auth/refresh` (guarded by the refresh-token cookie, rotates both tokens), `POST /api/v1/auth/logout` (clears cookies). `POST /auth/google` is rate-limited tighter (5/min) than the app default (20/min) via `@nestjs/throttler`.
- `src/common/` — `AllExceptionsFilter`, `PrismaExceptionFilter` (maps Prisma errors to HTTP responses — a duplicate `email`/`username`/`googleId` surfaces as a clean `409` for free, no manual pre-check needed), `LoggingInterceptor`, a shared `PaginationQueryDto` + `PaginatedResult` interface — ready for feature modules to reuse.
- `src/main.ts` — global setup: `helmet()`, `cookie-parser`, CORS locked to `FRONTEND_URL` with credentials, global prefix `api` (health excluded), URI versioning (`defaultVersion: '1'`), global `ValidationPipe`, the two exception filters, the logging interceptor, Swagger at `/api/docs`. Also (production only) `app.getHttpAdapter().getInstance().set('trust proxy', 1)`, typed via `as Express` since NestJS's adapter otherwise returns `any` — deploy platforms like Render/Railway sit behind a reverse proxy, so without this every request appears to come from the proxy's internal IP rather than the real client, which silently breaks per-client rate limiting since `@nestjs/throttler` keys off `req.ip`.
- `backend/package.json` now has `"postinstall": "prisma generate"` — `generated/prisma` is gitignored, and the build command (`nest build`) never regenerated the Prisma Client itself, so a fresh `npm install`/`npm ci` on a deploy platform would have built successfully and then crashed at runtime with a missing/stale Prisma Client. `postinstall` runs automatically after any install regardless of the platform's build-command convention, making it the most robust place for this.
- `src/modules/cars/` — **built (core CRUD only, no images/vehicle-API yet)**: `CarsModule`/`CarsController`/`CarsService`, `CreateCarDto`/`UpdateCarDto` (the latter via `@nestjs/swagger`'s `PartialType`). `Car` model matches Section 5 exactly (`make`, `model`, `year`, `variant`, `vin?`, `engine`, `fuelType`, `transmission`, `bodyType`, `powerBhp?`, `vehicleApiRef?`, `odometerKm`, `@@index([userId])`, `onDelete: Cascade` from `User`) — `fuelType`/`transmission`/`bodyType` are plain strings (frontend offers a curated dropdown, backend doesn't enforce an enum). Every route (`GET/POST /cars`, `GET/PATCH/DELETE /cars/:id`) sits behind `JwtAuthGuard`; ownership is enforced in the service, not a separate guard — every read/write filters `WHERE id = :id AND userId = :userId` and returns `404` (never `403`) on a mismatch, so a non-owner can't even confirm the resource exists. List responses reuse the existing `PaginationQueryDto`/`paginate()` helpers from `common/`.
- `src/modules/expenses/` — **built (no receipt upload yet)**: `ExpensesModule` imports `CarsModule` (now exports `CarsService`) so `ExpensesService` can reuse `carsService.findOneForUser()` for ownership checks — the exact "expenses imports cars service to verify ownership" boundary described in Section 4. `ExpenseCategory` is a **Prisma enum** (`FUEL`/`SERVICE`/`REPAIR`/`TYRES`/`BATTERY`/`MOD`/`INSURANCE`/`OTHER`), not the separate seeded lookup table Section 5 describes — a deliberate deviation: the category is a small closed set that directly drives conditional form fields and DTO validation (`@IsEnum`), and an enum gives that for free without a seed migration. `Expense` matches the rest of Section 5 (nullable category-specific columns, not per-category tables — `workshopName`/`workPerformed`/`whatBroke`/`litres`/`fuelPricePerLitre`/`fuelStation`/`tyreBrand`/`tyreSize`, all optional at the DTO level too, since they're supplementary metadata not core financial data). Routes: `POST/GET /cars/:carId/expenses` (nested, ownership-checked via the car), `PATCH/DELETE /expenses/:id` (flat, ownership checked via `findFirst({ where: { id, car: { userId } } })` — a single relation-filtered query, not the `Promise.all` gotcha above). Index matches Section 7 exactly: `@@index([carId, expenseDate(sort: Desc)])`.
- `src/modules/analytics/` — **built**, read-only, no DTOs (GET-only, no request body). `AnalyticsService` reuses `CarsService.findOneForUser` for the per-car route's ownership check. All aggregation is sequential per the gotcha above — even the per-car loop inside `forGarage` (one car's stats fully computed before moving to the next, not `Promise.all`'d across cars). `spendByCategory`/monthly totals use `expense.groupBy`; monthly spend specifically needs raw SQL (`$queryRaw` with a tagged template, safely parameterized) since Prisma's query builder has no `date_trunc` equivalent. "Cost per km" and "tracked km" are derived from **`Expense.odometerKm` readings** (min/max across expenses that recorded one), not `Car.odometerKm` — this measures distance covered *since expenses started being logged*, matching the mockup's "km Tracked" framing; a car with fewer than two odometer readings on its expenses returns `null` for both rather than a fabricated number. Routes: `GET /analytics/garage`, `GET /analytics/cars/:id`.
- `src/modules/friends/` — **built**. `FriendRequest` intentionally has **no status column** — a row only ever means "pending," and is deleted outright on accept (a `Friendship` row is created instead) or reject. This is a deliberate deviation from Section 5's status-ENUM sketch: a persisted `REJECTED` row would sit on the `(fromUserId, toUserId)` unique constraint forever and permanently block ever re-requesting that person. `Friendship` is stored **exactly once per pair**, in canonical order (`userAId` is always the lexicographically smaller id, enforced in `FriendsService`, not the DB) — so "list my friends" is a single `WHERE userAId = :me OR userBId = :me` with no risk of duplicate/inverse rows. Sending a request when the *other* person already has a pending request to you returns a `409` telling you to accept theirs instead, rather than silently auto-friending. `acceptRequest` is the one place gotcha #1 (no `$transaction`, ever) has real teeth — see that gotcha for how it's ordered to fail safely. Routes: `GET /friends`, `GET /friends/requests` (`{incoming, outgoing}`), `POST /friends/requests/:username`, `POST /friends/requests/:id/accept`, `POST /friends/requests/:id/reject`, `DELETE /friends/:userId`.
- `src/modules/users/` — **built**, one route: `GET /users/:username/garage`, exactly matching Section 9's public-garage authorization rule — returns `404` (not `403`, and the *same* `404` whether the username doesn't exist or simply isn't a friend) unless a `Friendship` row exists, and the car `select` explicitly excludes `vin`/`odometerKm`/`vehicleApiRef`. Imports `FriendsModule` to reuse `FriendsService.areFriends()` rather than duplicating the friendship check.
- Tests: `auth.service.spec.ts` + `cars.service.spec.ts` + `expenses.service.spec.ts` + `analytics.service.spec.ts` + `friends.service.spec.ts` + `users.service.spec.ts` (unit, **45** total) and one e2e spec per module (real app + real DB, **49** total across 6 suites). Every e2e suite proves cross-user isolation over real HTTP calls (the architecture doc's stated top testing priority, Section 16). The Analytics suite specifically hand-computes a fixture (two FUEL expenses + one SERVICE expense with known odometer readings) and asserts the API's `totalSpend`/`trackedKm`/`costPerKm`/`monthlySpend` match the manual calculation exactly — satisfying that module's stricter "Done when" bar. The Friends suite is the longest (19 tests): full request → duplicate-conflict → reverse-request-conflict → reject → re-request → accept → view-garage → unfriend → re-verify-404 cycle across three users. `test/jest-e2e.json` sets `maxWorkers: 1` (parallel workers caused Neon connection contention) and `testTimeout: 15000` (raised from Jest's 5000ms default — some Friends-flow tests make 4+ sequential real network round-trips, which routinely exceeded the default under normal Neon latency; this was a genuine latency issue, confirmed by rerunning green with the longer timeout, not a logic bug).
- Local Postgres via `docker-compose.yml` (`postgres:16-alpine`, db `glovebox`) exists but **isn't what's actually used** — `DATABASE_URL` in `.env` points at a Neon (hosted, serverless) database instead, because Docker isn't installed on this machine. Worth reconciling later: either install Docker and switch back for local dev, or drop `docker-compose.yml` if Neon is the permanent choice.

**Frontend** (`frontend/`) — Next.js 16 (App Router), not a plain React+Vite SPA:
- **`app/theme.ts` now implements Section 13 for real** — a `glovebox-dashboard-design.html` reference file (the finalized "Dashboard Concept v4" mockup, covering the whole app) landed mid-Slice-2, and its `:root`/`[data-theme="dark"]` CSS variables are now the actual MUI theme: `colorSchemes.light`/`colorSchemes.dark` palettes (exact hex values, not approximations), `shape.borderRadius: 14`, Inter + JetBrains Mono fonts (replacing the `create-next-app` Geist default), and a working light/system/dark toggle via MUI's `useColorScheme()` (`colorSchemeSelector: 'data'` so manual toggling overrides the OS preference). `app/login/page.tsx`'s hardcoded colors were also swapped from earlier approximations to the design's exact dark-theme hex values.
- **Scope decision on the design file**: it covers the entire app (Analytics, Friends, Profile, expense/import modals) — far more than what's built. Only the Dashboard/Cars pages were restyled to match it; the rest of the file stays as the visual reference for Slices 3+ rather than being built as static/mock UI now. No stat card, health panel, or spend figure was added anywhere — those all need real Expense data (Slice 3) and would otherwise be fabricated numbers masquerading as real ones.
- `app/providers.tsx` — `QueryClientProvider` + `GoogleOAuthProvider` (from `@react-oauth/google`), composed inside `ThemeRegistry` in `app/layout.tsx`.
- `lib/api-client.ts` — fetch wrapper, `credentials: 'include'` on every call, and a silent-refresh-once-on-401 retry (calls `/auth/refresh`, retries the original request once, never loops).
- `lib/auth-api.ts` / `hooks/use-auth.ts` — `googleAuth`/`getMe`/`logout` API functions and `useMe`/`useGoogleLogin`/`useLogout` TanStack Query hooks (single `['auth','me']` query key, updated optimistically on login/logout).
- `app/login/page.tsx` — matches the finalized mockup (dark card, GLOVEBOX wordmark, Google's own `<GoogleLogin>` button in `filled_black`/`pill` styling — Google's branding guidelines don't allow a fully custom-skinned button).
- `app/dashboard/layout.tsx` — the protected-route boundary: calls `useMe()` client-side, redirects to `/login` on a 401. **Known simplification**: this is a client-side check (brief loading spinner, not a zero-flash server-side gate) because the session lives in a cookie set by a *separate* NestJS origin — Next's proxy/middleware can't verify a JWT signed with a secret only the backend holds, and a presence-only cookie check would silently stop working the moment frontend and backend are deployed to genuinely different domains. Revisit only if a flash-of-loading-spinner becomes a real UX complaint.
- `app/page.tsx` — root route now checks `useMe()` and redirects to `/dashboard` or `/login`; no longer the `create-next-app` scaffold.
- Frontend dev port is now pinned to **3001** (`next dev -p 3001` in `package.json`) — it was previously defaulting to 3000 and colliding with the backend.
- Tailwind is still present only as `create-next-app`'s default dependency, not the chosen styling system — unchanged from before, still worth removing once the MUI theme fully owns styling.
- `react-hook-form` + `zod` + `@hookform/resolvers` are now installed, matching Section 12's stated forms stack.
- `features/cars/` — `car-form-schema.ts` (Zod schema + curated `FUEL_TYPES`/`TRANSMISSIONS`/`BODY_TYPES` option lists), `car-form-dialog.tsx` (one reusable MUI dialog form for both create and edit — note the `useForm<Input, unknown, Output>` three-generic pattern, needed because `z.coerce`/`z.preprocess` make the form's pre-validation input type differ from its post-validation output type), `car-card.tsx` (now matches the design's `.car-card`: gradient photo placeholder keyed off `car.id` via `car-gradient.ts`, plate-style label, hover-reveal panel on desktop showing engine/VIN/added-date, disabled on touch), `car-gradient.ts` (deterministic hash → one of 8 curated gradients, standing in for real car photos), `features/shell/theme-toggle.tsx` (the light/system/dark `ButtonGroup`, shared between the dropdown and — once built — a settings page).
- `lib/vehicle-catalog.ts` — a static, hand-curated Indian-market `VEHICLE_CATALOG` (~15 makes — Maruti Suzuki, Hyundai, Tata, Mahindra, Kia, Toyota, Honda, Renault, Nissan, Skoda, Volkswagen, MG, Citroen, Jeep — with real models, real variant/trim names, and a `bodyType` per model), plus `getMakeNames()`/`getModelNames(make)`/`getVariantNames(make, model)`/`getBodyTypeFor(make, model)` helpers. `car-form-dialog.tsx`'s Make/Model/Variant fields are now MUI `Autocomplete`s (`freeSolo: true`, so an unlisted/older/rare car can still be typed in manually — the catalog is a convenience, not a hard constraint) instead of plain `TextField`s: Model options filter live off the currently-selected Make, and Variant options filter live off Make+Model, both via `useWatch`. Selecting a catalog Model auto-fills `bodyType` via `setValue` (still a manual `Select`, so the user can override it). `car-form-schema.ts` gained `"MPV"` in `BODY_TYPES` for genuinely-MPV models like the Ertiga/Innova/Carens. **Deliberately not auto-filled**: `fuelType`, `transmission`, `engine`, and `powerBhp` stay fully manual even when Make/Model/Variant match the catalog — those vary too much per model-year/generation for a static catalog entry to safely infer, and getting one wrong would mean confidently showing the user incorrect data rather than just an unhelpfully blank field. Verified end-to-end with a real authenticated Playwright session: Make "Maruti Suzuki" → Model "Swift" → Variant "ZXI+" correctly auto-filled Body type to "Hatchback" (confirmed via screenshot).
- **Global Make/Model layer, on top of the curated catalog above**: after the curated India-focused catalog shipped, the ask changed to "all makes and models worldwide" — a paid global vehicle-data API was evaluated and rejected on the same zero-budget grounds as the NHTSA/vehicle-API decision in Known-gaps below. Instead, **Wikidata** (`query.wikidata.org/sparql`, a free public SPARQL endpoint, no API key) turned out to have a genuine global automobile-model ontology: a query for every item that's `instance of automobile model` (Q3231690) with a `brand` (P1716) property and a real English Wikipedia article (used as a notability/quality filter) returned 4,239 raw rows. Cleanup pipeline: ~30 corporate-suffix brand-label variants normalized to consumer-facing names ("Ford Motor Company" → "Ford", "Škoda Auto" → "Škoda", "Suzuki Motor Corporation" → "Suzuki"), the leading brand-name prefix stripped off model labels (Wikidata article titles read like "Škoda Favorit" → "Favorit"), rows with an unresolved/unlabeled brand or model QID dropped, and non-model junk that Wikidata's "automobile model" class incidentally includes filtered out (year-retrospective articles like "1937 Ford" via a leading-4-digit-year regex; component/prototype articles containing "transmission"/"engine"/"chassis"/"platform"/"concept"/"prototype"). Final clean set: **280 brands, 3,918 unique (brand, model) pairs**. Honest caveat: even after cleanup this still contains genuinely obscure historical model codes (Ford "7W", "AU Falcon", "BA Falcon") — real, verified Wikipedia articles, just unfamiliar to most users — which is inherent to a century-spanning global dataset, not a cleaning bug. This global set also has **no trim/variant or body-type data** (Wikidata doesn't reliably have that granularity for most models), so only the original curated India-focused makes have Variant/body-type dropdown data — every other make/model falls back to free text for Variant. **Architecture decision**: rather than bundling ~43KB of JSON into the main JS import graph for a dialog most page-loads never open, this global set is stored as a static file at `frontend/public/vehicle-catalog-global.json` and fetched lazily through a new `loadGlobalCatalog()` in `vehicle-catalog.ts` — called once when the "Add a car" dialog mounts, cached in a module-level variable, and silently non-fatal on fetch failure (the form just keeps working with curated data + free text). `getMakeNames()`/`getModelNames()` now optionally accept a `GlobalCatalog` (`Record<string, string[]>`, brand → model names) parameter and merge it case-insensitively with the curated list (curated entries win on name casing, sorted alphabetically after the merge); `getVariantNames()`/`getBodyTypeFor()` are unchanged — curated-only, since the global data has no variant/body-type info. `car-form-dialog.tsx` calls `loadGlobalCatalog()` in a mount `useEffect`, stores the result in state, and passes it into both name-lookup calls. Verified end-to-end with a real authenticated Playwright session: "Peugeot" (global-only, not in the curated list) correctly appears in the Make dropdown, its model "308" correctly appears in the Model dropdown (fetched live from the JSON), and Variant correctly shows zero dropdown options for that combination while still accepting free text ("GT Line" typed successfully — the Autocomplete stays `freeSolo`).
- `lib/cars-api.ts` / `hooks/use-cars.ts` — typed API functions and `useCars`/`useCar`/`useCreateCar`/`useUpdateCar`/`useDeleteCar` TanStack Query hooks, all invalidating a single `['cars']` key.
- `lib/time-ago.ts` — tiny relative-time formatter (no date library pulled in for one function).
- `app/dashboard/layout.tsx` — sidebar now has all three real nav items (**Garage, Analytics, Friends**), each a `NavItem` (`next/link` + `usePathname()` for active-state highlighting) rather than the earlier static single-item stack. The tablet icon-rail and mobile bottom-nav variants from the design file are still **not** built — three items still doesn't clearly earn that complexity; revisit if it ever feels cramped.
- `app/dashboard/page.tsx` — page-head has a time-of-day greeting + "Your Garage" + an honest car-count subtitle (still no fabricated spend/health stats here — that's what the dedicated Analytics page is for now).
- `app/dashboard/cars/[id]/page.tsx` — restyled header matching `.cd-header` (gradient photo, badges for fuel/body/power), same Edit/Delete functionality as before, **plus a full Expenses panel**: list, "+ Expense" opening `ExpenseFormDialog`, click-a-row to edit, a ✕ button per row with a confirm dialog to delete.
- `app/dashboard/analytics/page.tsx` — garage-wide stat row, a `@mui/x-charts` `BarChart` for monthly spend (themed automatically off the CSS-variable palette, no manual color mapping needed beyond referencing `var(--mui-palette-primary-main)`), a category breakdown (plain `sx`-styled bars, not a chart library — matches `.spend-bar-row` closely enough that a chart would be overkill), and a car-comparison table. Verified against the exact same hand-computed fixture as the backend e2e test — the UI numbers match the manual calculation, not just "the API returned something."
- `features/expenses/`, cont'd — nothing new for Analytics; it reads `Expense`/`Car` data through the new `analytics` endpoints only, no direct Expense-table access from the frontend.
- `lib/analytics-api.ts` / `hooks/use-analytics.ts` — `useGarageAnalytics`/`useCarAnalytics`, typed to mirror the backend's `GarageAnalytics`/`CarAnalytics` response shapes exactly.
- `app/dashboard/friends/page.tsx` — send-by-username (no user-search/autocomplete endpoint exists, so this is a plain text field, not the mockup's fuzzy search box — a deliberate scope trim), incoming requests with Accept/Decline, outgoing requests shown as read-only "Pending" (no cancel-outgoing-request endpoint was built — same reasoning: not needed for the "Done when" bar), and a friends grid linking to each friend's garage.
- `app/dashboard/friends/[username]/page.tsx` — the public garage view: privacy notice, car grid using the same `car-gradient.ts` placeholders as the owner-facing dashboard for visual consistency, reading from `GET /users/:username/garage` (not the regular `/cars` endpoint — this is genuinely a different, non-owner data path).
- `lib/friends-api.ts` / `hooks/use-friends.ts` — `useFriends`/`useFriendRequests`/`useSendFriendRequest`/`useAcceptFriendRequest`/`useRejectFriendRequest`/`useUnfriend`/`usePublicGarage`, all request/accept/reject/unfriend mutations invalidating both the `friends` and `friends/requests` query keys together.
- Full two-session flow (a real Google-authenticated user plus a second hand-created test user, two separate browser contexts/cookies) verified with Playwright: send → incoming-request visible → accept → friend visible on both sides → public garage viewable (car shown, no VIN) → unfriend. This is what caught a **test-script** timing bug worth remembering if you write more Playwright scripts against this app: MUI's `<Alert>` sets `role="alert"` on *every* severity, not just `error` — waiting on `[role="alert"]` as an "operation failed" signal will false-positive against any info/success alert already on the page. Wait on the actual network response instead.
- `features/expenses/` — `expense-categories.ts` (the 8 categories with icons, matching the design's `.cat-grid` exactly), `expense-form-schema.ts` (Zod, same coercion pattern as the car form), `expense-form-dialog.tsx` (category grid + `useWatch` — not `watch`, which React Compiler can't safely memoize — to conditionally render category-specific fields: litres/price-per-litre/station for fuel, workshop/work-performed for service, workshop/what-broke for repair, brand/size for tyres), `expense-row.tsx` (matches `.expense-row`).
- `lib/expenses-api.ts` / `hooks/use-expenses.ts` — typed API functions and `useExpenses`/`useCreateExpense`/`useUpdateExpense`/`useDeleteExpense`, keyed `['expenses', carId]`.
- Full create → edit → delete cycle verified with a Playwright-driven browser run against both a FUEL and a SERVICE expense (different category-specific fields each) — this is what caught the `defaultValues`-staleness gotcha above.

**Known gaps / caveats across what's built so far:**
- **Image/receipt upload** (car photos, expense receipts — `CarImage`/`ExpenseAttachment` tables, signed-URL flow) is the one remaining feature-level gap that needs external credentials (an AWS/R2 bucket) — same situation Google OAuth was in before you configured it.
- **Vehicle-data API enrichment is no longer an open gap — but it wasn't resolved with a live third-party API.** NHTSA's vPIC API was evaluated first (free, VIN-decode based) and rejected: it's a US-market-only database with zero coverage of Maruti Suzuki/Tata/Mahindra/etc., and it has no general Make→Model→Variant catalog-browse endpoint anyway — its trim data only comes from decoding one specific VIN, not browsing a catalog. By deliberate user choice over a paid provider (CarsXE, Vehicle Databases API, etc.), `frontend/lib/vehicle-catalog.ts` instead bundles a static, hand-curated Indian-market Make→Model→Variant catalog (see the Cars module frontend notes above) — zero cost, zero live dependency, at the cost of needing manual maintenance/extension over time and not being exhaustive. The `Car` fields a live vehicle-API would still autofill server-side (`engine`, `fuelType`, `transmission`, `vehicleApiRef`) remain fully manual and untouched by this; `bodyType` now gets a frontend-only assist from the static catalog when Make+Model matches, but is still a manually-overridable `Select` and starts blank for unlisted vehicles — the documented graceful-degradation design (Section 15) still applies. **Coverage was widened again after that**, when the ask changed from India-only to "all makes and models worldwide": a paid global vehicle-data API was again rejected on cost grounds, and a free global layer sourced from Wikidata's SPARQL endpoint (280 brands / 3,918 models, see the Cars module frontend notes above) was added on top of the curated catalog instead. **Net result: Make/Model coverage is now genuinely global**, not India-only — but Variant and body-type data remain India-only, sourced solely from the original curated ~29-make layer, with free text as the fallback everywhere else.
- `backend/package-lock.json` is one entry stale (ignore — `@react-oauth/google`/`@mui/x-charts` aren't backend packages). **`frontend/package-lock.json` was not regenerated** for either `@react-oauth/google` or `@mui/x-charts`, because `npm install`/`npm ci` hit a reproducible "Invalid Version" crash in this environment (isolated to an npm/arborist bug reconciling Next 16.3.2's platform-specific `@next/swc-*` optional dependencies — reproduced across npm 10, 11, and 12, so it's not a version-specific regression). Yarn was used as a one-time recovery path both times, installing into `node_modules` and updating `frontend/package.json` correctly. **Action needed**: run `npm install` on a normal machine/environment to regenerate `frontend/package-lock.json` properly — this almost certainly won't reproduce outside this specific sandboxed session.
- e2e tests that hit the real Neon database are intermittently flaky under back-to-back runs (connection churn) — unrelated to any feature's logic, confirmed repeatedly by isolated clean passes and by failures always landing on the pre-existing health-check ping or a plain `create()`/`findMany()` call, never a business-logic assertion. `testTimeout: 15000` in `test/jest-e2e.json` absorbs most of this; an occasional full-suite rerun still clears the rest.
- A stray duplicated generated file (`generated/prisma/internal/prismaNamespace 2.ts`, and siblings) showed up mid-session from an interrupted `prisma generate` — same class of issue as `.next`'s occasional duplicate `d 2.ts` type files. Neither was the actual cause of anything (confirmed separately for each), but if `tsc`/typecheck ever reports duplicate-identifier errors in generated output, check for a stray ` 2.` file before looking anywhere else — `rm -rf` the generated directory and regenerate clean.
- **Deployment readiness (code side) is now done.** Prepping for a real Vercel + Render/Railway deploy surfaced and fixed three issues that are invisible in local dev: the cross-domain `SameSite` cookie bug (Gotcha #4 above), a missing `trust proxy` setting, and a missing `postinstall` Prisma-generate hook (both above, under `src/main.ts`/`package.json`). `README.md` was also almost entirely rewritten — it previously described a different, stale original stack (Vite+React Router, email/password auth, Vitest) instead of the real one, and now has an accurate stack description plus a concrete **Deployment** section (run `prisma migrate deploy` once against prod, Render/Railway backend config, Vercel frontend config, and a reminder that the Google OAuth Client needs the production frontend origin added in Google Cloud Console after deploy, since Google Sign-In is scoped per-origin and fails silently otherwise). `frontend/.env.example` was also added (previously only the backend had one). Full backend suite reverified after all of this: typecheck clean, lint clean, 45 unit + 49 e2e tests passing, production build succeeds. **What's left is not code** — it's actually creating the Vercel/Render/Railway accounts and running the README's steps.
- **`LICENSE` file gap — noted, not fixed.** The README says "MIT — see LICENSE," but no `LICENSE` file exists in the repo. Left as-is deliberately: choosing (or declining) a license is the repo owner's call, not something to silently resolve. Flagged here as a known unresolved item.

**Not started**: Redis, CI/CD, and the one feature gap above (uploads) — vehicle-data API is no longer on this list (see the Known-gaps bullets above for how it was resolved). **Deployment is code-ready** (see the bullet above) but not yet actually done — that's blocked on the user creating hosting accounts, not on any remaining code.

---

## 1. Executive Summary

Glovebox is a **modular monolith**: React/TypeScript SPA talking to a single NestJS API, backed by PostgreSQL, with S3 for images/receipts and Redis added only once there's a real caching or job need. No microservices, no queues, no GraphQL, no second database. This stack lets you explain every decision in an interview and actually ship it solo in a few months of evenings/weekends.

---

## 2. Final Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 16 (App Router)** + TypeScript + MUI v9 + TanStack Query | *Locked in — already scaffolded.* File-based routing replaces React Router; TanStack Query still removes 80% of the "server state" boilerplate you'd otherwise reach for Redux for. |
| Backend | Node.js + NestJS + TypeScript | Your domain has 8 real modules (auth, garage, cars, expenses, analytics, friends, uploads) — NestJS's module/DI structure maps 1:1 onto that and keeps a monolith from turning into spaghetti. Express would work but you'd hand-roll what Nest gives free (guards, pipes, DTO validation, module boundaries). |
| Database | PostgreSQL | Domain is relational (users→garages→cars→expenses→attachments) and analytics-heavy (aggregations, GROUP BY, window functions). One database does both jobs well. |
| ORM | **Prisma 7** | *Locked in — already scaffolded.* Prisma 7 requires a SQL driver adapter (`@prisma/adapter-pg` for Postgres); the client generator is the newer `prisma-client` provider, not the legacy `prisma-client-js`. |
| Storage | AWS S3 (or Cloudflare R2 for cheaper egress) | Car photos + receipts are unstructured blobs; don't put them in Postgres. |
| Cache/Jobs | Redis — **not on day 1** | See Part 7. |
| Auth | JWT access + refresh tokens, httpOnly cookies, **argon2** password hashing | Stateless, scales fine for this size, standard interview-defensible pattern. `argon2`, `@nestjs/jwt`, `@nestjs/passport`/`passport-jwt` are already installed. |
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
    health/        # ✅ built — GET /health via @nestjs/terminus + PrismaHealthIndicator
    auth/          # ⬜ next — register, login, refresh, guards, password reset
    users/         # ⬜ profile, public profile lookups
    garage/        # ⬜ a user's collection wrapper (mostly implicit via cars)
    cars/          # ⬜ CRUD, car images, vehicle-data enrichment
    expenses/      # ⬜ CRUD, category-specific fields, attachments
    analytics/      # ⬜ aggregation queries, exposed as read-only endpoints
    friends/       # ⬜ requests, friendships, public-garage visibility
    uploads/       # ⬜ signed URL issuance, file metadata
  common/          # ✅ built — AllExceptionsFilter, PrismaExceptionFilter,
                   #    LoggingInterceptor, PaginationQueryDto, PaginatedResult
  config/          # ✅ built — configuration.ts + Zod env.validation.ts
  database/        # ✅ built — PrismaModule/PrismaService (adapter-pg driver adapter)
```

**Module boundaries**: each module only imports what it needs from others via exported services (e.g., `expenses` imports `cars` service to verify ownership, never reaches into `cars`' repository directly). No module talks to another module's database table without going through its service.

---

## 5. Database Schema

Core tables (not over-normalized — e.g., no separate `Address` table for a single city field):

> **Status**: only `User` exists today, and only as `User(id uuid, email unique, passwordHash, createdAt, updatedAt)` in `backend/prisma/schema.prisma` — no `username` column yet. Add it as part of Slice 1 (needed for the `/users/:username` public-profile routes below); everything else in this section is still schema-on-paper.

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

`main.ts` already wires a global prefix + URI versioning, so every route below actually lives at `/api/v1/...` (e.g. `POST /api/v1/auth/register`), **except** `/health`, which is version-neutral and excluded from the `api` prefix on purpose (so uptime checks/load balancers can hit a stable, unversioned URL):

```http
GET    /health                 # ✅ built

POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh

GET    /api/v1/cars
POST   /api/v1/cars
GET    /api/v1/cars/:id
PATCH  /api/v1/cars/:id
DELETE /api/v1/cars/:id
POST   /api/v1/cars/:id/images

GET    /api/v1/cars/:id/expenses
POST   /api/v1/cars/:id/expenses
PATCH  /api/v1/expenses/:id
DELETE /api/v1/expenses/:id
POST   /api/v1/expenses/:id/attachments

GET    /api/v1/analytics/garage
GET    /api/v1/analytics/cars/:id

GET    /api/v1/friends
GET    /api/v1/friends/requests
POST   /api/v1/friends/requests/:userId
POST   /api/v1/friends/requests/:id/accept
DELETE /api/v1/friends/:userId

GET    /api/v1/users/:username
GET    /api/v1/users/:username/garage
```

Conventions: plural nouns, nested resources for ownership-scoped reads (`/cars/:id/expenses`), flat resources with their own ID for direct mutation (`/expenses/:id`). Every mutating route runs through an auth guard + ownership check. Swagger docs for all of this are auto-generated at `/api/docs` as soon as controllers exist.

---

## 12. Frontend Architecture

**This is Next.js 16 App Router, not a Vite SPA** — routing is file-based under `app/`, not React Router. Layout roughly:

```
app/
  layout.tsx          # ✅ built — root layout, ThemeRegistry wrapper
  page.tsx             # ✅ built (still create-next-app scaffold) — landing/redirect
  theme.ts             # ✅ built (minimal) — MUI theme, needs mockup tokens mapped in
  theme-registry.tsx   # ✅ built — MUI + Emotion cache bridge for App Router SSR
  providers.tsx         # ⬜ QueryClientProvider (TanStack Query) — not wired yet
  (auth)/
    login/page.tsx      # ⬜
    signup/page.tsx      # ⬜
  dashboard/
    layout.tsx           # ⬜ protected-route boundary for everything under /dashboard
    page.tsx              # ⬜ garage dashboard, car cards
    cars/[id]/page.tsx     # ⬜ car detail
  friends/page.tsx         # ⬜
components/                # ⬜ shared, dumb UI pieces (buttons, cards, stat tiles)
features/
  auth/                     # ⬜
  garage/                   # ⬜ car cards, dashboard widgets
  expenses/                 # ⬜ expense modal, category-aware fields
  analytics/                # ⬜ charts, monthly breakdown
  friends/                  # ⬜
api/                        # ⬜ typed API client functions, one per resource
hooks/                      # ⬜ TanStack Query hooks wrapping api/
types/
utils/
```

- **Server state**: entirely TanStack Query — cars, expenses, analytics, friends all fetched/cached/invalidated through it (e.g., adding an expense invalidates `['expenses', carId]` and `['analytics', carId]`). Needs a `QueryClientProvider` added (likely in a new `app/providers.tsx` client component, composed alongside `ThemeRegistry` in `app/layout.tsx`) — not present yet.
- **Local/UI state**: `useState`/`useReducer` per component — modal open/close, selected category, selected month (matches the `selectMonth` behavior already in your mockup).
- **Forms**: React Hook Form + Zod for validation, matching the DTO validation shape on the backend (share the Zod schema shape conceptually with the NestJS `class-validator` DTOs).
- **Auth state**: a small context/hook wrapping "am I logged in" derived from a `/auth/me` query, not Redux.
- **Routing**: Next.js App Router file-based routing. Protected routes are a `layout.tsx` at the top of a route group (e.g. `app/dashboard/layout.tsx`) that redirects unauthenticated users — this replaces the `<ProtectedRoute>`-wrapper pattern you'd use with React Router. Since access/refresh tokens live in httpOnly cookies (Section 9), that check can happen server-side in the layout instead of client-side.
- **Error/loading**: TanStack Query's built-in `isLoading`/`isError` states, rendered as skeletons/toasts consistent with your MUI theme.

Redux isn't needed — there's no complex client-only state that outlives a component tree here.

Tailwind currently ships alongside MUI only because `create-next-app` added it by default — plan to remove it once the MUI theme carries real styling, so utility classes and `sx`/theme styling don't fight each other.

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

1. **Foundations** (few days) — mechanics done (NestJS + Next.js scaffolds, Postgres via Prisma, global validation/error-handling/versioning/Swagger). **Still open**: base CI. The "hello world" deploy to Vercel/Render itself is now code-ready — prepping for it surfaced and fixed the cross-domain cookie bug (Gotcha #4), added `trust proxy` and a `postinstall` Prisma-generate hook, and replaced the stale README with an accurate one plus a real Deployment section (see [Section 0](#0-current-implementation-status)); what's left there is the user creating the Vercel/Render/Railway accounts, not more code.
2. **Slice 1 — Auth** — ✅ done (Google Sign-In only, see [Section 0](#0-current-implementation-status)). See the [Auth module checklist](#module-auth) for what was actually built.
3. **Slice 2 — Garage/Cars** — ✅ core CRUD done; image upload + vehicle-API enrichment deferred pending your AWS/R2 and vehicle-API setup. See the [Garage/Cars checklist](#module-garage--cars).
4. **Slice 3 — Expenses** — ✅ core CRUD done (`ExpenseCategory` is a Prisma enum, not the seeded table originally sketched here); receipt upload deferred pending S3/R2 setup. See the [Expenses checklist](#module-expenses).
5. **S3 uploads** — still the one piece of Slices 2/3 not done: signed URL flow → car photo upload → receipt upload. Needs your AWS/R2 setup.
6. **Slice 4 — Analytics** — ✅ done. See the [Analytics checklist](#module-analytics).
7. **Vehicle-data API integration** — ✅ resolved, but not with a live third-party API: NHTSA vPIC was evaluated and rejected as US-market-only with no catalog-browse endpoint, so a static, hand-curated Indian-market Make→Model→Variant catalog (`frontend/lib/vehicle-catalog.ts`) backs the Cars form's Autocomplete fields instead — zero cost, zero live dependency, needs manual maintenance/extension over time. See the [Garage/Cars checklist](#module-garage--cars).
8. **Slice 5 — Friends** — ✅ done. See the [Friends checklist](#module-friends).
9. **Redis**: still not needed — nothing built across all five slices has hit a caching or job problem yet. Stays deferred exactly as originally reasoned.
10. **Testing**: done alongside each slice as planned, not as a separate phase — 45 unit + 49 e2e tests exist, every one of the five feature slices has its own dedicated cross-user authorization test.
11. **Production hardening**: security checklist pass, Sentry wiring, CI/CD tightening, final deploy — the deployment-blocking code issues (cookie `SameSite`, `trust proxy`, Prisma `postinstall`, stale README) are already resolved, see item 1 and [Section 0](#0-current-implementation-status) (which also flags an unresolved `LICENSE`-file gap, a decision for the repo owner, not fixed here). What's left is this phase plus the two external-credential feature gaps (uploads, needing S3/R2).

---

## 22. Module-by-Module Implementation Checklist

### MODULE: AUTH
*Google Sign-In only — no email/password anywhere (see [Section 0](#0-current-implementation-status)). "Register" and "login" are the same action: the first successful Google sign-in creates the account.*

**Backend**
- [x] User migration + entity (`email`, `username` auto-generated, `googleId`, `displayName?`, `avatarUrl?`)
- [x] `GoogleAuthDto` (`{ credential: string }`) + validation
- [x] Google ID-token verification (`google-auth-library`, audience-checked against `GOOGLE_CLIENT_ID`)
- [x] Auth service (authenticate-with-Google incl. find-or-create + username generation, refresh, logout is stateless so needs no service method)
- [x] JWT strategy + guards (access + refresh, both cookie-based via `cookie-parser`)
- [x] Auth controller (`POST /auth/google`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`)
- [x] Rate limiting on `/auth/google` (tighter than the app default)
- [x] Tests: new-user creation, username collision suffixing, existing-user login, invalid/missing-claim credential rejection, refresh (unit); guard rejection, authenticated `/auth/me`, wrong-secret rejection, logout cookie-clearing (e2e)

**Frontend**
- [x] Login page (Google button only, matches mockup)
- [x] Auth API hooks (`useMe`, `useGoogleLogin`, `useLogout`)
- [x] Protected route wrapper (`app/dashboard/layout.tsx`, client-side check — see Section 0's caveat on why not server-side)
- [x] Error/loading states (spinner while `/auth/me` resolves, inline alert on Google/backend rejection)
- [x] Logout

**Integration**
- [x] Frontend calls the real API — CORS + cross-origin cookies verified via curl (`Access-Control-Allow-Origin` reflects `FRONTEND_URL`, credentials flow correctly)
- [x] Full login→dashboard→logout flow test **with a real Google account** — done. Google Cloud OAuth client created and wired in; a real "Continue with Google" click created a genuine `User` row (`mananmer9769@gmail.com` → auto-generated username `mananmer9769`, display name/avatar pulled from the Google profile).

**Done when**: ✅ met — a new user can click "Continue with Google," land on the dashboard, refresh the page and stay logged in, and log out, with no way to reach the dashboard unauthenticated.

### MODULE: GARAGE / CARS
*Core CRUD only — image upload is deferred pending your AWS/R2 setup; vehicle-API enrichment was resolved with a static bundled Indian-market catalog instead of a live API (see [Section 0](#0-current-implementation-status)).*

**Backend**
- [x] Car migration + entity (matches Section 5's fields exactly; `CarImage` intentionally not created yet — see note above)
- [x] `CreateCarDto`/`UpdateCarDto` + validation
- [x] CRUD service/controller, ownership enforced in the service (`404`, never `403`, on a mismatch — doesn't confirm existence to non-owners)
- [ ] Image upload endpoint — deferred, needs S3/R2 credentials
- [x] Tests: CRUD (unit) + cross-user access denial (e2e — User B gets `404` reading/updating/deleting User A's car, and User A's car never appears in User B's paginated list)

**Frontend**
- [x] Dashboard car grid (with empty state)
- [x] Add/edit car form (one reusable dialog, React Hook Form + Zod, curated dropdowns for fuel type/transmission/body type)
- [x] Cascading Make/Model/Variant `Autocomplete` fields (`freeSolo`, still typeable for unlisted cars) backed by a static Indian-market catalog (`frontend/lib/vehicle-catalog.ts`), auto-filling body type on a catalog Model match
- [x] Global Make/Model coverage layered on top via a free Wikidata-sourced catalog (`frontend/public/vehicle-catalog-global.json`, fetched lazily on dialog mount via `loadGlobalCatalog()`) — 280 brands / 3,918 models, merged case-insensitively with the curated list; no Variant/body-type data at this layer, so those still fall back to free text outside the curated India-focused makes
- [x] Car detail page (with edit + delete-with-confirmation)
- [ ] Image upload UI — deferred alongside the backend endpoint

**Integration**
- [x] Connected to the real API — verified via a full Playwright-driven browser run: create → appears in grid → detail page → edit → delete → back to empty state, zero console errors
- [x] Verified a car created by one user is invisible to another's `/cars` call — proven over real HTTP in `cars.e2e-spec.ts`, not just asserted in a unit test

**Done when**: ✅ met for core CRUD — full CRUD works end-to-end and ownership is enforced server-side, not just hidden in the UI. Image upload remains open pending external service setup.

### MODULE: EXPENSES
*Receipt/photo upload deferred pending S3/R2 setup — same situation as car images (see [Section 0](#0-current-implementation-status)).*

**Backend**
- [x] Expense migration + `ExpenseCategory` enum (8 categories, including `BATTERY` — the mockup's category grid has one more than this doc's original 7)
- [x] Category-aware DTO validation (`CreateExpenseDto`/`UpdateExpenseDto` — category-specific fields are optional, not conditionally required; the category just decides which fields the *frontend* shows)
- [x] CRUD service/controller, ownership enforced via `CarsService` (nested create/list) and a relation-filtered query (flat update/delete)
- [ ] Attachment upload — deferred
- [x] Tests: creation, ownership, category-field handling (unit); cross-user isolation on every route (e2e)

**Frontend**
- [x] Expense modal (category grid + switching, matching `.cat-grid`/`.cat-btn`)
- [x] Expense history list (on the car detail page, matching `.expense-row`)
- [x] Edit/delete (edit via clicking a row, delete via a per-row confirm dialog)

**Integration**
- [x] Connected — verified with a Playwright-driven browser run: create a FUEL expense, create a SERVICE expense, edit one, delete the other, confirmed correct amounts/dates/category-specific fields at every step and in the database directly
- [x] Cross-user isolation verified over real HTTP in `expenses.e2e-spec.ts`, not just asserted in a unit test

**Done when**: ✅ met for core CRUD — expenses can be created for any category with the right fields, edited, deleted, and are correctly scoped to the owning user's cars only. Receipt upload remains open pending external service setup.

### MODULE: ANALYTICS
*No fuel-economy trend (the `LAG()` window-function idea from Section 14) — out of scope for the "Done when" bar below, which never mentioned it. Add later if it earns its complexity.*

**Backend**
- [x] Aggregation queries (`groupBy` for category breakdown, raw `$queryRaw` for monthly `date_trunc`, `aggregate` min/max for odometer-derived cost/km)
- [x] Analytics endpoints, read-only (`GET /analytics/garage`, `GET /analytics/cars/:id`), ownership-checked via `CarsService` for the per-car route
- [x] Tests against known fixture data (unit + e2e — the e2e version hand-computes `totalSpend`/`trackedKm`/`costPerKm`/`monthlySpend` from real hand-inserted expenses and asserts an exact match)

**Frontend**
- [x] Stat cards (total spend, tracked km, average cost/km)
- [x] Monthly bar chart (`@mui/x-charts`, themed off the existing MUI palette)
- [x] Cost/km (both garage-average and per-car in the comparison table)
- [x] Category breakdown

**Integration**
- [x] Connected — verified via Playwright against the same hand-computed fixture as the backend e2e test
- [x] Numbers spot-checked against manual calculation — not just "the API returned something"

**Done when**: ✅ met — every number on the analytics page matches a manual calculation from the same fixture data.

### MODULE: FRIENDS
*`FriendRequest` has no status column by design (rows are deleted on accept/reject, not marked) — see Section 0's gotcha-adjacent note under the module description. No user-search/autocomplete endpoint exists — sending a request is by exact username, and viewing someone's profile before friending isn't supported; both are reasonable follow-ups if ever needed, not required by the "Done when" bar.*

**Backend**
- [x] `FriendRequest`/`Friendship` schema (see Section 0 for why `Friendship` is stored in canonical sorted-pair order, and why `FriendRequest` skips the status-ENUM design)
- [x] Send/accept/reject (`POST /friends/requests/:username`, `POST /friends/requests/:id/accept`, `POST /friends/requests/:id/reject`)
- [x] Public-garage endpoint (`GET /users/:username/garage`, `404`-not-`403` on both "doesn't exist" and "isn't a friend")
- [x] Tests: can't friend-request twice (unique constraint → `409` via the now-fixed `PrismaExceptionFilter`), can't friend-request someone who already requested you (`409`, told to accept instead), rejecting doesn't create a friendship and doesn't permanently block re-requesting, can't see a non-friend's private data (unit + 19-test e2e covering the full lifecycle across three users)

**Frontend**
- [x] Friends list (grid, each linking to that friend's garage)
- [x] Incoming/outgoing requests (Accept/Decline on incoming; outgoing shown read-only as "Pending" — no cancel action, see scope note above)
- [x] Friend's public garage view (privacy notice, car cards, no financial data anywhere on the page)

**Integration**
- [x] Connected — verified via Playwright with **two genuinely separate authenticated sessions** (a real Google-authenticated user + a second hand-created user), not one session pretending to be two
- [x] Verified a non-friend genuinely cannot fetch another user's garage via the API directly — proven in `friends.e2e-spec.ts`, not just hidden in the UI

**Done when**: ✅ met — the full request→accept→view-public-garage flow works and is authorization-tested, not just UI-tested.

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
