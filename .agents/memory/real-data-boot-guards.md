---
name: Real-data boot guards
description: Pattern for cleanupDemo* functions in backfillFleet.ts; db.execute quirks.
---

## Rule
`cleanupDemoTrucks`, `cleanupDemoEquipment`, `cleanupDemoMaintenanceLogs` are called in the `else` branch of `backfillFleetData()` (real-data mode only). They are idempotent DELETEs.

**Why:** Prevents synthetic seed data from polluting a live database if DEMO_MODE is toggled off after an initial seeding run.

## db.execute quirk
`db.execute(sql`SELECT ...`)` does NOT return a plain array you can destructure like `const [{ count }] = ...`. That throws `"(intermediate value) is not iterable"`. For count checks, either use `db.select()` with Drizzle ORM or just skip the guard and run the DELETE unconditionally (it's a no-op on an empty/clean table).

**How to apply:** Any time you need a SELECT result from `db.execute`, use `db.select().from(table)` instead. For simple cleanup DELETEs, skip the pre-check count and let the DELETE handle the empty case.
