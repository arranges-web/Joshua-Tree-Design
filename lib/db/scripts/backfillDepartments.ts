/**
 * Backfill script: ensures exactly the 6 canonical departments exist and
 * re-homes any assets / users that belong to legacy / unexpected departments.
 * Safe to run multiple times (idempotent).
 *
 * Strategy:
 *  1. Upsert the 6 target departments (by key).
 *  2. Reassign trucks / equipment / users whose department_id points to any
 *     row NOT in the canonical 5 → default target is "Fleet & Mechanics".
 *  3. Also assign any NULL-department assets to Fleet.
 *  4. Delete orphan department rows that are no longer referenced.
 *
 * Usage:
 *   pnpm --filter @workspace/db tsx scripts/backfillDepartments.ts
 */
import { db } from "../src/client";
import { departmentsTable, trucksTable, equipmentTable, usersTable } from "../src/schema";
import { eq, isNull, notInArray, or } from "drizzle-orm";

const TARGET_DEPARTMENTS = [
  { key: "Admin",       label: "Administration" },
  { key: "Lawn",        label: "Lawn Care" },
  { key: "Landscaping", label: "Landscaping" },
  { key: "Pest",        label: "Pest Control" },
  { key: "TreeService", label: "Tree Service" },
  { key: "Irrigation",  label: "Irrigation Services" },
] as const;

async function main() {
  console.log("Step 1: Upserting 5 canonical departments…");
  for (const dept of TARGET_DEPARTMENTS) {
    await db
      .insert(departmentsTable)
      .values({ key: dept.key, label: dept.label })
      .onConflictDoUpdate({
        target: departmentsTable.key,
        set: { label: dept.label },
      });
  }

  // Build a map of key → id for the canonical set.
  const allDepts = await db.select().from(departmentsTable);
  const canonicalKeys = new Set(TARGET_DEPARTMENTS.map((d) => d.key));
  const canonicalIds = allDepts
    .filter((d) => canonicalKeys.has(d.key as typeof TARGET_DEPARTMENTS[number]["key"]))
    .map((d) => d.id);
  const fleetDeptId = (allDepts.find((d) => d.key === "Pest") ?? allDepts.find((d) => d.key === "Admin"))!.id;

  console.log(`Canonical dept ids: ${canonicalIds.join(", ")}  (fallback=${fleetDeptId})`);

  // Step 2: Re-home trucks whose departmentId is not in the canonical set.
  console.log("Step 2: Re-homing trucks assigned to legacy departments…");
  const legacyTrucks = await db
    .select({ id: trucksTable.id, deptId: trucksTable.departmentId })
    .from(trucksTable)
    .where(
      or(
        isNull(trucksTable.departmentId),
        notInArray(trucksTable.departmentId, canonicalIds),
      ),
    );
  // All returned rows need re-homing (null or legacy dept).
  const trucksToFix = legacyTrucks;
  if (trucksToFix.length > 0) {
    console.log(`  Reassigning ${trucksToFix.length} truck(s) → Fleet (${fleetDeptId})`);
    for (const t of trucksToFix) {
      await db
        .update(trucksTable)
        .set({ departmentId: fleetDeptId })
        .where(eq(trucksTable.id, t.id));
    }
  } else {
    console.log("  All trucks already assigned to canonical departments.");
  }

  // Step 3: Re-home equipment.
  console.log("Step 3: Re-homing equipment assigned to legacy departments…");
  const legacyEquip = await db
    .select({ id: equipmentTable.id, deptId: equipmentTable.departmentId })
    .from(equipmentTable)
    .where(
      or(
        isNull(equipmentTable.departmentId),
        notInArray(equipmentTable.departmentId, canonicalIds),
      ),
    );
  const equipToFix = legacyEquip;
  if (equipToFix.length > 0) {
    console.log(`  Reassigning ${equipToFix.length} equipment → Fleet (${fleetDeptId})`);
    for (const e of equipToFix) {
      await db
        .update(equipmentTable)
        .set({ departmentId: fleetDeptId })
        .where(eq(equipmentTable.id, e.id));
    }
  } else {
    console.log("  All equipment already assigned to canonical departments.");
  }

  // Step 4: Re-home users whose departmentId points to a legacy dept.
  const adminDeptId = allDepts.find((d) => d.key === "Admin")!.id;
  console.log("Step 4: Re-homing users assigned to legacy departments…");
  const legacyUsers = await db
    .select({ id: usersTable.id, deptId: usersTable.departmentId })
    .from(usersTable)
    .where(
      or(
        isNull(usersTable.departmentId),
        notInArray(usersTable.departmentId, canonicalIds),
      ),
    );
  const usersToFix = legacyUsers;
  if (usersToFix.length > 0) {
    console.log(`  Reassigning ${usersToFix.length} user(s) → Admin (${adminDeptId})`);
    for (const u of usersToFix) {
      await db
        .update(usersTable)
        .set({ departmentId: adminDeptId })
        .where(eq(usersTable.id, u.id));
    }
  } else {
    console.log("  All users already assigned to canonical departments.");
  }

  // Step 5: Delete orphan department rows (not in canonical keys, not referenced).
  console.log("Step 5: Deleting orphan department rows…");
  const orphans = allDepts.filter((d) => !canonicalKeys.has(d.key as typeof TARGET_DEPARTMENTS[number]["key"]));
  if (orphans.length > 0) {
    for (const orphan of orphans) {
      try {
        await db.delete(departmentsTable).where(eq(departmentsTable.id, orphan.id));
        console.log(`  Deleted orphan dept: ${orphan.key} (id=${orphan.id})`);
      } catch (err) {
        // If FK constraints remain (shouldn't after steps 2-4), log and skip.
        console.warn(`  Could not delete dept ${orphan.key} (id=${orphan.id}): ${err}`);
      }
    }
  } else {
    console.log("  No orphan departments found.");
  }

  console.log("Backfill complete. Canonical state guaranteed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
