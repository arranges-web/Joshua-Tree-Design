# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Joshua Tree FSM — domain notes

- `service_requests` table is the leads pipeline (statuses NEW → CONTACTED → QUOTED → CONVERTED → DISMISSED, with `converted_quote_id` FK to `quotes`).
- RBAC: `leads` section is editable by ADMIN + SALES. SALES is scoped to leads belonging to customers they own (`scopeServiceRequests` in `artifacts/api-server/src/lib/rbac/scope.ts`).
- `GET /api/customers/:id` returns a deep customer profile (properties, jobs split upcoming/past, quotes, invoices, leads) plus a `totals` rollup (lifetime revenue, outstanding, open quote exposure, open lead count).
- `POST /api/leads/:id/convert` is **transactional and idempotent**: takes a `SELECT … FOR UPDATE` row lock and re-checks `converted_quote_id` so two concurrent requests cannot create duplicate draft quotes.
- Lead create/update validates `propertyId` belongs to the lead's customer to prevent cross-customer property leakage.
- Admin UI: `/admin/leads` (inbox), `/admin/customers/:id` (profile). Customer rows in the customers list link to the profile.

## Customer Portal (`/portal/`)

- Standalone artifact (`artifacts/customer-portal`) on port 23434, brand-matched to `joshua-tree` (cream / forest-green / coral, Instrument Serif + Inter Tight).
- Phone-OTP login backed by `/api/portal/auth/request-otp` and `/api/portal/auth/verify-otp`. Uses Twilio when the connector is configured, otherwise prints the code to the API console and returns `devCode` / `devMode: true` (only when `NODE_ENV !== "production"`).
- Sessions are signed cookies (`jt_portal_session`) with `requirePortalAuth` middleware that **rejects staff cookies** — staff and customers cannot impersonate each other even if both cookies are present.
- Portal endpoints: `GET /portal/me`, `GET /portal/properties`, `GET /portal/jobs` (split into `upcoming` / `past`), `GET /portal/requests`, `POST /portal/requests`. New requests insert into `service_requests` with status `NEW` so they appear in the staff `/admin/leads` inbox.
- Rate limits: per-phone OTP request limit + per-phone verify attempts cap (`too_many_otp_requests`, `too_many_verify_attempts` error codes).
- Service request creation validates that any supplied `propertyId` belongs to the calling customer (`property_not_owned`).

## Fleet & Finance Management (`/admin/fleet`, `/admin/assets`, `/admin/maintenance`)

- **Smart Asset Registry**: trucks + equipment unified into a single `Asset` view (`GET /api/assets` in `artifacts/api-server/src/routes/fleet.ts`). Each asset carries brand/model, VIN/serial, purchase price+date, current usage (miles for trucks, hours for equipment), service interval, derived `serviceState` (OK / DUE_SOON / OVERDUE) and `lifeToDateSpendCents`. Status enum is `ACTIVE | IN_SHOP | RETIRED` (UI labels RETIRED as "Out of Service").
- **Asset Action Page** (`/admin/assets/:slug`) renders a printable QR code (`qrcode.react`) deep-linking back to itself plus tabs for Quick Actions (log usage, log service) and Maintenance Ledger.
- **Maintenance Ledger** stores `laborCostCents` + `partsCostCents` separately and caches their sum in `costCents`. UI auto-sums labor + parts as you type. Server-side guard: every maintenance log and usage reading must target exactly one asset (`must_target_exactly_one_asset`).
- **Fleet Pulse** (`/admin/fleet`) returns counts, overdue + due-soon lists, last-12-months spend (recharts bar chart with labor/parts split), top-5 money pits, plus 30-day / YTD / lifetime totals.
- **Permissions**: `requireFleetView` middleware accepts viewers of *either* `fleet.trucks` or `fleet.equipment` for the unified `/assets` and `/fleet-pulse` routes.
- **Backfill safety**: `lib/db/src/backfillFleet.ts` enriches existing T-01/T-02/T-03 + 3 equipment rows with brand/model/purchase data and adds slugs on every boot. The synthetic extra-asset seed (T-04, T-05, Bandit chipper, Toro grinder + their logs) only runs when `NODE_ENV !== "production"`.
- **Fonts**: fsm-admin now ships Inter Tight + JetBrains Mono only (no Instrument Serif). `--app-font-serif` aliases to Inter Tight so existing `font-serif` headings remain non-italic.
