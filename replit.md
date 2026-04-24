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
