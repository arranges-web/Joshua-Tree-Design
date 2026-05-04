/**
 * Backfill script: ensures the 5 canonical departments exist and assigns
 * any trucks / equipment that still have department_id = NULL to sensible
 * defaults.  Safe to run multiple times (idempotent).
 *
 * Usage:
 *   pnpm --filter @workspace/db tsx scripts/backfillDepartments.ts
 */
import { db } from "../src/client";
import { departmentsTable, trucksTable, equipmentTable } from "../src/schema";
import { eq, isNull } from "drizzle-orm";

const TARGET_DEPARTMENTS = [
  { key: "Admin", label: "Administration" },
  { key: "Sales", label: "Sales" },
  { key: "Landscaping", label: "Landscaping" },
  { key: "TreeService", label: "Tree Service" },
  { key: "Fleet", label: "Fleet & Mechanics" },
] as const;

async function main() {
  console.log("Ensuring 5 canonical departments exist…");

  for (const dept of TARGET_DEPARTMENTS) {
    await db
      .insert(departmentsTable)
      .values({ key: dept.key, label: dept.label })
      .onConflictDoUpdate({
        target: departmentsTable.key,
        set: { label: dept.label },
      });
  }

  const depts = await db.select().from(departmentsTable);
  const byKey = Object.fromEntries(depts.map((d) => [d.key, d.id]));

  const fleetDeptId = byKey["Fleet"];

  const unassignedTrucks = await db
    .select({ id: trucksTable.id })
    .from(trucksTable)
    .where(isNull(trucksTable.departmentId));

  if (unassignedTrucks.length > 0) {
    console.log(`Assigning ${unassignedTrucks.length} unassigned trucks → Fleet (${fleetDeptId})`);
    for (const t of unassignedTrucks) {
      await db
        .update(trucksTable)
        .set({ departmentId: fleetDeptId })
        .where(eq(trucksTable.id, t.id));
    }
  } else {
    console.log("All trucks already have a department assignment.");
  }

  const unassignedEquip = await db
    .select({ id: equipmentTable.id })
    .from(equipmentTable)
    .where(isNull(equipmentTable.departmentId));

  if (unassignedEquip.length > 0) {
    console.log(`Assigning ${unassignedEquip.length} unassigned equipment → Fleet (${fleetDeptId})`);
    for (const e of unassignedEquip) {
      await db
        .update(equipmentTable)
        .set({ departmentId: fleetDeptId })
        .where(eq(equipmentTable.id, e.id));
    }
  } else {
    console.log("All equipment already have a department assignment.");
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
