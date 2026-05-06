/**
 * Boot-time idempotent migration to the canonical 7-department layout
 * (Admin + 6 visible operating departments) and per-department fleet
 * seeding so the dept-filter dropdown always has data to show.
 *
 * Steps (each is a no-op when its work is already done):
 *  1. Upsert the 7 canonical departments by key.
 *  2. Re-home users / trucks / equipment whose departmentId points at a
 *     legacy dept (e.g. the old "Fleet" or "Irrigation" rows) onto a
 *     canonical fallback (Admin for users, Landscaping for assets).
 *  3. Delete any orphan dept rows so the dropdown can't surface them.
 *  4. Ensure every visible dept has at least one truck and one
 *     equipment row so switching the dropdown actually changes the
 *     data on screen. Skipped in production, since real customers add
 *     their own assets via the UI.
 */
import { eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  departmentsTable,
  trucksTable,
  equipmentTable,
  usersTable,
  crewsTable,
  crewMembersTable,
  rolesTable,
  DEPARTMENT_KEYS,
} from "./schema";

const DEPT_LABELS: Record<(typeof DEPARTMENT_KEYS)[number], string> = {
  Admin: "Administration",
  Sales: "Sales",
  Lawn: "Lawn",
  Landscaping: "Landscaping",
  Pest: "Pest",
  TreeService: "Tree",
  Fertilization: "Fertilization",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export async function backfillDepartments(): Promise<void> {
  // 1. Upsert canonical departments.
  for (const key of DEPARTMENT_KEYS) {
    await db
      .insert(departmentsTable)
      .values({ key, label: DEPT_LABELS[key] })
      .onConflictDoUpdate({
        target: departmentsTable.key,
        set: { label: DEPT_LABELS[key] },
      });
  }

  const allDepts = await db.select().from(departmentsTable);
  const canonicalKeys = new Set<string>(DEPARTMENT_KEYS);
  const canonicalIds = allDepts
    .filter((d) => canonicalKeys.has(d.key))
    .map((d) => d.id);
  const adminId = allDepts.find((d) => d.key === "Admin")!.id;
  const fallbackAssetDeptId =
    allDepts.find((d) => d.key === "Landscaping")?.id ?? adminId;

  // 2a. Re-home users that point at legacy / null department rows.
  await db
    .update(usersTable)
    .set({ departmentId: adminId })
    .where(
      or(
        isNull(usersTable.departmentId),
        notInArray(usersTable.departmentId, canonicalIds),
      ),
    );

  // 2b. Re-home trucks.
  await db
    .update(trucksTable)
    .set({ departmentId: fallbackAssetDeptId })
    .where(
      or(
        isNull(trucksTable.departmentId),
        notInArray(trucksTable.departmentId, canonicalIds),
      ),
    );

  // 2c. Re-home equipment.
  await db
    .update(equipmentTable)
    .set({ departmentId: fallbackAssetDeptId })
    .where(
      or(
        isNull(equipmentTable.departmentId),
        notInArray(equipmentTable.departmentId, canonicalIds),
      ),
    );

  // 3. Delete orphan department rows. The FK guards above guarantee no
  // referencing rows are left, but we still wrap each delete so a
  // missed reference doesn't crash the whole boot sequence.
  const orphans = allDepts.filter((d) => !canonicalKeys.has(d.key));
  for (const orphan of orphans) {
    try {
      await db.delete(departmentsTable).where(eq(departmentsTable.id, orphan.id));
    } catch {
      // Leave orphan in place if FK constraint still references it; a
      // future boot will retry once the references are migrated.
    }
  }

  // 4. Per-dept demo fleet — non-production only.
  if (process.env["NODE_ENV"] !== "production") {
    await ensureDepartmentFleet();
  }

  // 5. Per-dept demo crew — runs in all environments because the live
  // demo deploy was seeded before the Sales / Fertilization depts
  // existed and the customer-count guard in backfillDemoData skips
  // them. This adds one crew per visible dept that doesn't already
  // have one, led by the highest-priority user already in that dept
  // (CREW_LEAD > MECHANIC > ADMIN > anyone else).
  await ensureDepartmentCrew();
}

type FleetSeed = {
  truck: {
    name: string;
    brand: string;
    model: string;
    vin: string;
    plate: string;
    purchasePriceCents: number;
    purchaseDate: Date;
    currentMileage: number;
    serviceIntervalMiles: number;
  };
  equipment: Array<{
    name: string;
    type: string;
    brand: string;
    model: string;
    serial: string;
    purchasePriceCents: number;
    purchaseDate: Date;
    currentHours: number;
    serviceIntervalHours: number;
  }>;
};

const DEPT_FLEET_SEEDS: Partial<Record<(typeof DEPARTMENT_KEYS)[number], FleetSeed>> = {
  Sales: {
    truck: {
      name: "T-08 Sales Estimator",
      brand: "Toyota",
      model: "Tacoma SR5",
      vin: "3TYCZ5AN0PT00008",
      plate: "JTREE-8",
      purchasePriceCents: 3_950_000,
      purchaseDate: new Date(2024, 2, 6),
      currentMileage: 12_140,
      serviceIntervalMiles: 5_000,
    },
    equipment: [
      {
        name: "Bosch GLM-50 Laser",
        type: "Measuring Tool",
        brand: "Bosch",
        model: "GLM-50 C",
        serial: "BSH-GLM50-S1",
        purchasePriceCents: 18_900,
        purchaseDate: new Date(2024, 1, 10),
        currentHours: 0,
        serviceIntervalHours: 999,
      },
    ],
  },
  Lawn: {
    truck: {
      name: "T-06 Lawn Service Truck",
      brand: "Ford",
      model: "F-250 Super Duty",
      vin: "1FT7W2BT0PED00006",
      plate: "JTREE-6",
      purchasePriceCents: 5_800_000,
      purchaseDate: new Date(2023, 4, 20),
      currentMileage: 28_450,
      serviceIntervalMiles: 5_000,
    },
    equipment: [
      {
        name: "Exmark Lazer Z Mower",
        type: "Zero-Turn Mower",
        brand: "Exmark",
        model: "Lazer Z X-Series",
        serial: "EX-LZX-LW1",
        purchasePriceCents: 1_200_000,
        purchaseDate: new Date(2023, 2, 10),
        currentHours: 620,
        serviceIntervalHours: 200,
      },
      {
        name: "Lawn String Trimmer",
        type: "Trimmer",
        brand: "STIHL",
        model: "FS 131",
        serial: "STIHL-FS131-LW2",
        purchasePriceCents: 65_000,
        purchaseDate: new Date(2023, 6, 1),
        currentHours: 280,
        serviceIntervalHours: 100,
      },
    ],
  },
  Landscaping: {
    truck: {
      name: "T-10 Landscape Loader",
      brand: "Isuzu",
      model: "NPR-HD Flatbed",
      vin: "JALC4W16XP7000010",
      plate: "JTREE-10",
      purchasePriceCents: 6_650_000,
      purchaseDate: new Date(2021, 11, 3),
      currentMileage: 88_620,
      serviceIntervalMiles: 7_500,
    },
    equipment: [
      {
        name: "Plate Compactor",
        type: "Compaction Equipment",
        brand: "Wacker",
        model: "DPU6555Heh",
        serial: "WK-DPU-LS1",
        purchasePriceCents: 380_000,
        purchaseDate: new Date(2021, 7, 14),
        currentHours: 1_240,
        serviceIntervalHours: 250,
      },
    ],
  },
  Pest: {
    truck: {
      name: "T-07 Pest Control Van",
      brand: "Ford",
      model: "Transit 250 Cargo",
      vin: "1FTBR1Y83PKB00007",
      plate: "JTREE-7",
      purchasePriceCents: 4_200_000,
      purchaseDate: new Date(2022, 8, 14),
      currentMileage: 61_230,
      serviceIntervalMiles: 5_000,
    },
    equipment: [
      {
        name: "Ride-On Pest Sprayer",
        type: "Spray Equipment",
        brand: "Perma-Green",
        model: "Triumph",
        serial: "PG-TR-PS1",
        purchasePriceCents: 980_000,
        purchaseDate: new Date(2022, 4, 20),
        currentHours: 890,
        serviceIntervalHours: 200,
      },
    ],
  },
  TreeService: {
    truck: {
      name: "T-11 Tree Service Truck",
      brand: "Ford",
      model: "F-550 Service Body",
      vin: "1FDXX0000000T11",
      plate: "JTREE-11",
      purchasePriceCents: 7_350_000,
      purchaseDate: new Date(2023, 5, 8),
      currentMileage: 18_410,
      serviceIntervalMiles: 5_000,
    },
    equipment: [
      {
        name: "Stihl MS-500i Chainsaw",
        type: "Chainsaw",
        brand: "Stihl",
        model: "MS-500i",
        serial: "STIHL-MS500-TS1",
        purchasePriceCents: 159_900,
        purchaseDate: new Date(2024, 0, 14),
        currentHours: 220,
        serviceIntervalHours: 50,
      },
    ],
  },
  Fertilization: {
    truck: {
      name: "T-09 Fertilization Tank Truck",
      brand: "Isuzu",
      model: "NPR-HD Tanker",
      vin: "JALC4W160P7000009",
      plate: "JTREE-9",
      purchasePriceCents: 6_450_000,
      purchaseDate: new Date(2023, 1, 18),
      currentMileage: 22_770,
      serviceIntervalMiles: 5_000,
    },
    equipment: [
      {
        name: "Z-Spray Junior Spreader",
        type: "Spreader/Sprayer",
        brand: "Z-Spray",
        model: "Junior Max",
        serial: "ZS-JR-FT1",
        purchasePriceCents: 985_000,
        purchaseDate: new Date(2023, 7, 11),
        currentHours: 410,
        serviceIntervalHours: 200,
      },
      {
        name: "Lesco Push Spreader",
        type: "Fertilizer Spreader",
        brand: "LESCO",
        model: "HD 80 lb",
        serial: "LESCO-HD80-FT2",
        purchasePriceCents: 35_000,
        purchaseDate: new Date(2022, 9, 15),
        currentHours: 0,
        serviceIntervalHours: 500,
      },
    ],
  },
};

async function ensureDepartmentFleet(): Promise<void> {
  const allDepts = await db.select().from(departmentsTable);
  const deptByKey = new Map(allDepts.map((d) => [d.key, d.id] as const));

  const existingTrucks = await db
    .select({ name: trucksTable.name })
    .from(trucksTable);
  const truckNames = new Set(existingTrucks.map((t) => t.name));

  const existingEquip = await db
    .select({ name: equipmentTable.name, deptId: equipmentTable.departmentId })
    .from(equipmentTable);
  const equipNames = new Set(existingEquip.map((e) => e.name));

  for (const [key, seed] of Object.entries(DEPT_FLEET_SEEDS) as Array<
    [(typeof DEPARTMENT_KEYS)[number], FleetSeed]
  >) {
    const deptId = deptByKey.get(key);
    if (deptId == null) continue;

    // Truck: insert if missing (by name).
    if (!truckNames.has(seed.truck.name)) {
      const [row] = await db
        .insert(trucksTable)
        .values({
          name: seed.truck.name,
          brand: seed.truck.brand,
          model: seed.truck.model,
          vin: seed.truck.vin,
          plate: seed.truck.plate,
          status: "ACTIVE" as const,
          departmentId: deptId,
          purchasePriceCents: seed.truck.purchasePriceCents,
          purchaseDate: seed.truck.purchaseDate,
          currentMileage: seed.truck.currentMileage,
          serviceIntervalMiles: seed.truck.serviceIntervalMiles,
        })
        .returning();
      if (row) {
        await db
          .update(trucksTable)
          .set({ slug: `truck-${row.id}-${slugify(row.name)}` })
          .where(eq(trucksTable.id, row.id));
      }
    }

    for (const item of seed.equipment) {
      if (equipNames.has(item.name)) continue;
      const [row] = await db
        .insert(equipmentTable)
        .values({
          name: item.name,
          type: item.type,
          brand: item.brand,
          model: item.model,
          serial: item.serial,
          status: "ACTIVE" as const,
          departmentId: deptId,
          purchasePriceCents: item.purchasePriceCents,
          purchaseDate: item.purchaseDate,
          currentHours: item.currentHours,
          serviceIntervalHours: item.serviceIntervalHours,
        })
        .returning();
      if (row) {
        await db
          .update(equipmentTable)
          .set({ slug: `equip-${row.id}-${slugify(row.name)}` })
          .where(eq(equipmentTable.id, row.id));
      }
    }
  }

  // Suppress unused-import lint when no rows match.
  void sql;
}

const VISIBLE_DEPT_NAMES: Record<(typeof DEPARTMENT_KEYS)[number], string> = {
  Admin: "",
  Sales: "Sales Crew",
  Lawn: "Lawn Crew",
  Landscaping: "Landscape Crew",
  Pest: "Pest Crew",
  TreeService: "Tree Crew",
  Fertilization: "Fertilization Crew",
};

const ROLE_PRIORITY: Record<string, number> = {
  CREW_LEAD: 1,
  MECHANIC: 2,
  ADMIN: 3,
  SALES: 4,
  ACCOUNTING_MANAGER: 5,
};

async function ensureDepartmentCrew(): Promise<void> {
  const allDepts = await db.select().from(departmentsTable);
  const allCrews = await db.select().from(crewsTable);
  const usersWithRole = await db
    .select({
      id: usersTable.id,
      departmentId: usersTable.departmentId,
      roleKey: rolesTable.key,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id));

  for (const key of DEPARTMENT_KEYS) {
    if (key === "Admin") continue;
    const dept = allDepts.find((d) => d.key === key);
    if (!dept) continue;
    const existing = allCrews.filter((c) => c.departmentId === dept.id);
    if (existing.length > 0) continue;

    // Pick the best lead: prefer a user already in this dept, ordered by
    // role priority. Fall back to any user with a CREW_LEAD role, then
    // any user at all so the FK constraint is satisfied.
    const inDept = usersWithRole
      .filter((u) => u.departmentId === dept.id)
      .sort(
        (a, b) =>
          (ROLE_PRIORITY[a.roleKey] ?? 99) - (ROLE_PRIORITY[b.roleKey] ?? 99),
      );
    let leadUser =
      inDept[0] ??
      usersWithRole.find((u) => u.roleKey === "CREW_LEAD") ??
      usersWithRole[0];
    if (!leadUser) continue;

    const [newCrew] = await db
      .insert(crewsTable)
      .values({
        name: VISIBLE_DEPT_NAMES[key],
        leadUserId: leadUser.id,
        departmentId: dept.id,
      })
      .returning();
    if (newCrew) {
      await db
        .insert(crewMembersTable)
        .values({ crewId: newCrew.id, userId: leadUser.id })
        .onConflictDoNothing();
    }
  }
}
