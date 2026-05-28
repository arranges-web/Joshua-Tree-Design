---
name: Demo backfill guards
description: Which backfill functions are gated by isDemoMode() and which weren't before the fix.
---

# Demo Backfill Guards

## The rule
ALL demo data creation must be gated behind `isDemoMode()`. Two functions had this wrong:
- `backfillDemoData()` — correctly gated (was already fine)
- `backfillDepartments.ts → ensureDepartmentCrew()` — was NOT gated; fixed to wrap in `if (isDemoMode())`

**Why:** ensureDepartmentCrew() created one demo crew per department (Sales Crew, Lawn Crew, etc.) on every boot for any department with no crew. Since real crews have no department_id, it always found 0 crews per dept and re-created placeholders.

**How to apply:** Any new "ensure X exists" backfill that creates data must be gated behind isDemoMode() unless it's a pure schema migration.

## isDemoMode() behavior
- Returns false when DEMO_MODE=false/0/no in env
- Returns true when DEMO_MODE=true/1/yes
- Returns true when NODE_ENV != 'production' (default dev behavior)
- DEMO_MODE=false is set in the development environment to disable demo seeding
- DEMO_MODE=true is set in the production environment (for the live demo deploy)
