---
name: Real crew import
description: How 22 real Joshua Tree crews and equipment assignments were loaded, and how re-seeding is prevented.
---

# Real Crew Import

## The rule
`importRealCrews()` (lib/db/src/importRealCrews.ts) is the idempotent startup function that loads the 22 real Joshua Tree crews from the asset spreadsheet. It is called at the end of the startup sequence in artifacts/api-server/src/index.ts. The guard is: if a crew named "Melecio" exists, the function is a no-op.

**Why:** The spreadsheet (attached_assets/asset-3_1779978906385.xlsx) contains 250 equipment items with a Crew column. Crew names had typos/variants (Melecio/Melesio, Anthony/Anrhony, etc.) — these are normalized in normalizeCrewName() in the same file.

**How to apply:** If the DB is reset/wiped, the next startup automatically re-imports all 22 crews and re-assigns 166 equipment items. Broken items are marked RETIRED.

## Key details
- 22 crews: Adrian (Grapple), Alex, Anthony, Bishop, Calixto, Celso, Christian, Cirilo, Dave, Jeff Long, Lawn, Leodan, Melecio, Miguel, Miguel A, Mike, Reynier, Rob C, Tim's Trees, Wilber, Williams, Yoslande
- Crews use admin user as placeholder lead_user_id (real leads TBD)
- Equipment column: `serial` (not serial_number)
- Status enum values: ACTIVE, IN_SHOP, RETIRED (not OUT_OF_SERVICE)
- DEMO_MODE=false is set in development environment to prevent demo backfill
