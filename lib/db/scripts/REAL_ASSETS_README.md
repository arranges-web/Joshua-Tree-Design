# Importing real customer fleet assets

This script replaces the demo trucks + equipment with the actual fleet data
transcribed from the insurance schedule (3 screenshots, ~50 vehicles) and
`asset-3.xlsx` (250 handheld equipment rows). Customers, jobs, quotes, and
invoices are **not** touched — only the fleet tables.

## One-time steps before running

1. **Set `DEMO_MODE=false`** in the environment that runs the API server.
   This stops `backfillFleetData()` from re-overlaying T-01/T-02/T-03
   demo trucks on every boot, and stops `backfillDemoData()` from
   inserting demo customers on a fresh DB.

   On Replit: open the **Secrets** tab and set `DEMO_MODE=false`.

2. **Push the schema** so the `asset_checkouts`, image-URL, and
   holder-pointer columns from the v2 fleet PR exist:
   ```
   pnpm --filter @workspace/db run push
   ```

## Run the import

```
DATABASE_URL=postgres://… pnpm --filter @workspace/db run import-real-assets
```

What it does, in order:
1. Looks up the `TreeService` and `Lawn` department ids (errors if either is
   missing — run `backfillDepartments` first if so).
2. `TRUNCATE … RESTART IDENTITY CASCADE` on every fleet table:
   `asset_checkouts`, `asset_assignment_log`, `asset_status_log`,
   `usage_readings`, `maintenance_logs`, `equipment_items`, `equipment`,
   `trucks`. *(Maintenance history is wiped — fleet is starting clean.)*
3. Inserts trucks + trailers from `data/trucks-import.json`
   (47 vehicles + 2 extras from the secondary schedule).
4. Inserts 11 heavy equipment rows (Dingos, CMC lift, Vermeer skid
   steer, Giant track loader) from `data/heavy-equipment-import.json`.
5. Inserts 250 handheld equipment rows from `data/equipment-import.json`.
   For each row, the holder name from the spreadsheet (e.g. "Wilber",
   "Melecio") is appended to the equipment name in square brackets so
   it's visible in the registry without a schema change. Once the team
   creates real user accounts, replace these labels with proper
   checkouts via the per-asset **Check out** UI.

Re-runnable: pass `--keep-existing` to skip the truncate step (useful for
appending one-off rows without losing maintenance logs).

## Department assignment heuristics

Trucks are routed by brand/model:
- Smaller pickups + SUVs + cargo vans (Silverado, Tacoma, Colorado,
  Blazer, Expedition, Sierra, RAM 2500, F250, Econoline) → **Lawn**
- Everything else (heavy trucks, dump trucks, trailers) → **TreeService**

Equipment is routed by the spreadsheet "Site" column:
- `Tree Yard` → **TreeService**
- `Lawn Yard` → **Lawn**

Adjust individual rows in the admin UI after import — the heuristic is a
starting point, not a permanent assignment.

## Updating the source data

- `data/trucks-import.json` — hand-edit JSON. One row per vehicle. The
  `statedValueCents` field expects integer cents (e.g. `$40,000` → `4000000`).
- `data/heavy-equipment-import.json` — hand-edit JSON.
- `data/equipment-import.json` — regenerated from `asset-3.xlsx`. To
  re-import after the spreadsheet changes, re-run the Python conversion
  block in `lib/db/scripts/REGENERATE_HANDHELD_JSON.md` *(or paste the
  block in `seed.ts` history)*.
