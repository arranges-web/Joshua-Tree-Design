import { eq, isNull, or, and, sql } from "drizzle-orm";
import { db } from "./client";
import {
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
} from "./schema";
import { isDemoMode } from "./demoMode";

/**
 * Idempotent backfill that enriches the demo fleet with the new asset-registry
 * fields (brand/model/purchase data, current usage, slug) and adds a richer
 * spread of trucks + equipment so the Pulse dashboard, Money Pits chart, and
 * QR-code action pages have something interesting to show.
 *
 * Safe to call on every boot — every step short-circuits when the data is
 * already present.
 */
export async function backfillFleetData(): Promise<void> {
  await backfillMaintenanceLogColumns();
  await ensureInvitesTable();
  await ensureDeleteRequestsTable();
  await backfillTruckFixtures();
  await backfillEquipmentFixtures();
  await backfillEquipmentCategories();
  await backfillMaintenanceLogs();
  await backfillSlugs();
  // Demo enrichment (extra synthetic assets) is gated by DEMO_MODE so
  // the published Joshua Tree demo on Replit can ship with a fully
  // populated fleet. Set DEMO_MODE=false to opt out before pointing
  // this codebase at a real customer DB.
  if (isDemoMode()) {
    await ensureExtraAssets();
    await ensureExtraTrailersAndHandhelds();
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function makeAssetSlug(kind: "truck" | "equip", id: number, name: string) {
  const base = slugify(name) || kind;
  return `${kind}-${id}-${base}`;
}

const TRUCK_FIXTURES: Record<
  string,
  {
    brand: string;
    model: string;
    purchasePriceCents: number;
    purchaseDate: Date;
    currentMileage: number;
    serviceIntervalMiles: number;
  }
> = {
  "T-01 Bucket Truck": {
    brand: "Ford",
    model: "F-750 Bucket",
    purchasePriceCents: 8_500_000,
    purchaseDate: new Date(2021, 2, 14),
    currentMileage: 64_820,
    serviceIntervalMiles: 5_000,
  },
  "T-02 Chip Truck": {
    brand: "International",
    model: "MV607 Chip Box",
    purchasePriceCents: 9_200_000,
    purchaseDate: new Date(2019, 7, 9),
    currentMileage: 118_450,
    serviceIntervalMiles: 5_000,
  },
  "T-03 Crane Truck": {
    brand: "Freightliner",
    model: "M2-106 Crane",
    purchasePriceCents: 14_750_000,
    purchaseDate: new Date(2022, 5, 1),
    currentMileage: 41_310,
    serviceIntervalMiles: 7_500,
  },
};

const EQUIP_FIXTURES: Record<
  string,
  {
    brand: string;
    model: string;
    purchasePriceCents: number;
    purchaseDate: Date;
    currentHours: number;
    serviceIntervalHours: number;
  }
> = {
  "Stihl MS-462": {
    brand: "Stihl",
    model: "MS-462 C-M",
    purchasePriceCents: 119_900,
    purchaseDate: new Date(2023, 1, 4),
    currentHours: 412,
    serviceIntervalHours: 50,
  },
  "Vermeer BC1500": {
    brand: "Vermeer",
    model: "BC1500 XL",
    purchasePriceCents: 7_850_000,
    purchaseDate: new Date(2020, 4, 18),
    currentHours: 2_385,
    serviceIntervalHours: 250,
  },
  "Husqvarna 572 XP": {
    brand: "Husqvarna",
    model: "572 XP",
    purchasePriceCents: 134_900,
    purchaseDate: new Date(2024, 0, 21),
    currentHours: 168,
    serviceIntervalHours: 50,
  },
};

/**
 * Idempotent ALTER TABLE that adds the receipt-tracking columns
 * (vendor, category, notes, receipt_data_url) introduced for the
 * accountant workflow. Uses IF NOT EXISTS so it's a no-op once the
 * columns are present, and runs before any other maintenance backfill
 * so subsequent updates can rely on the columns existing.
 */
async function backfillMaintenanceLogColumns() {
  await db.execute(
    sql`ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS vendor TEXT`,
  );
  await db.execute(
    sql`ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS category TEXT`,
  );
  await db.execute(
    sql`ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS notes TEXT`,
  );
  await db.execute(
    sql`ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS receipt_data_url TEXT`,
  );
}

/**
 * Idempotent CREATE TABLE for the delete-approval system. Tracks
 * every destructive action across the console, plus admin-approval
 * state for when non-admin users exceed the per-hour cap.
 */
async function ensureDeleteRequestsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS delete_requests (
      id SERIAL PRIMARY KEY,
      requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_kind TEXT NOT NULL,
      resource_id INTEGER NOT NULL,
      resource_label TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'EXECUTED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ,
      decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS delete_requests_user_created_idx ON delete_requests (requested_by_user_id, created_at)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS delete_requests_status_idx ON delete_requests (status)`,
  );
}

/**
 * Idempotent CREATE TABLE for the team-invite system. Same pattern
 * as backfillMaintenanceLogColumns above — keep the table creation
 * inline so the schema deploys without needing a separate
 * drizzle-kit push step on the live demo.
 */
async function ensureInvitesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      accepted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS invites_token_uq ON invites (token)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (email)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS invites_created_at_idx ON invites (created_at)`,
  );
}

async function backfillTruckFixtures() {
  const trucks = await db.select().from(trucksTable);
  for (const t of trucks) {
    const fix = TRUCK_FIXTURES[t.name];
    if (!fix) continue;
    if (t.brand && t.model && t.purchasePriceCents) continue; // already enriched
    await db
      .update(trucksTable)
      .set({
        brand: fix.brand,
        model: fix.model,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentMileage: fix.currentMileage,
        serviceIntervalMiles: fix.serviceIntervalMiles,
      })
      .where(eq(trucksTable.id, t.id));
  }
}

async function backfillEquipmentFixtures() {
  const equipment = await db.select().from(equipmentTable);
  for (const e of equipment) {
    const fix = EQUIP_FIXTURES[e.name];
    if (!fix) continue;
    if (e.brand && e.model && e.purchasePriceCents) continue;
    await db
      .update(equipmentTable)
      .set({
        brand: fix.brand,
        model: fix.model,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentHours: fix.currentHours,
        serviceIntervalHours: fix.serviceIntervalHours,
      })
      .where(eq(equipmentTable.id, e.id));
  }
}

// Map pre-category equipment rows onto the new four-category model.
// Chainsaws and similar tools become HANDHELD; chippers / grinders /
// other large powered gear becomes CUSTOM with a "Heavy Equipment" label.
// Idempotent: only touches rows whose category is still the default and
// whose name is in our explicit migration map.
const EQUIPMENT_CATEGORY_MIGRATION: Record<
  string,
  { category: "HANDHELD" | "CUSTOM"; customCategoryLabel: string | null }
> = {
  "Stihl MS-462": { category: "HANDHELD", customCategoryLabel: null },
  "Husqvarna 572 XP": { category: "HANDHELD", customCategoryLabel: null },
  "Vermeer BC1500": { category: "CUSTOM", customCategoryLabel: "Heavy Equipment" },
  "Bandit 21XP Chipper": {
    category: "CUSTOM",
    customCategoryLabel: "Heavy Equipment",
  },
  "Toro STX-38 Stump Grinder": {
    category: "CUSTOM",
    customCategoryLabel: "Heavy Equipment",
  },
};

async function backfillEquipmentCategories() {
  const equipment = await db.select().from(equipmentTable);
  for (const e of equipment) {
    const fix = EQUIPMENT_CATEGORY_MIGRATION[e.name];
    if (!fix) continue;
    // Already migrated — don't trample admin edits.
    if (e.category === fix.category && e.customCategoryLabel === fix.customCategoryLabel) {
      continue;
    }
    await db
      .update(equipmentTable)
      .set({
        category: fix.category,
        customCategoryLabel: fix.customCategoryLabel,
      })
      .where(eq(equipmentTable.id, e.id));
  }
}

/**
 * For maintenance logs created before the labor/parts split existed, treat the
 * legacy total as labor and add a synthetic mileage/hours snapshot so the
 * service-due math has something to anchor on.
 */
async function backfillMaintenanceLogs() {
  const logs = await db
    .select()
    .from(maintenanceLogsTable)
    .where(
      and(
        eq(maintenanceLogsTable.laborCostCents, 0),
        eq(maintenanceLogsTable.partsCostCents, 0),
        sql`${maintenanceLogsTable.costCents} > 0`,
      ),
    );

  for (const log of logs) {
    // Split: 60/40 labor/parts feels realistic for shop work.
    const labor = Math.round((log.costCents ?? 0) * 0.6);
    const parts = (log.costCents ?? 0) - labor;

    let mileageAtService: number | null = null;
    let hoursAtService: number | null = null;
    if (log.truckId) {
      const [t] = await db
        .select({ m: trucksTable.currentMileage })
        .from(trucksTable)
        .where(eq(trucksTable.id, log.truckId));
      // Pretend service happened ~3000 miles ago.
      if (t) mileageAtService = Math.max(0, t.m - 3000);
    } else if (log.equipmentId) {
      const [e] = await db
        .select({ h: equipmentTable.currentHours })
        .from(equipmentTable)
        .where(eq(equipmentTable.id, log.equipmentId));
      if (e) hoursAtService = Math.max(0, e.h - 30);
    }

    await db
      .update(maintenanceLogsTable)
      .set({
        laborCostCents: labor,
        partsCostCents: parts,
        mileageAtService,
        hoursAtService,
      })
      .where(eq(maintenanceLogsTable.id, log.id));
  }
}

async function backfillSlugs() {
  const trucks = await db
    .select()
    .from(trucksTable)
    .where(isNull(trucksTable.slug));
  for (const t of trucks) {
    await db
      .update(trucksTable)
      .set({ slug: makeAssetSlug("truck", t.id, t.name) })
      .where(eq(trucksTable.id, t.id));
  }
  const equipment = await db
    .select()
    .from(equipmentTable)
    .where(isNull(equipmentTable.slug));
  for (const e of equipment) {
    await db
      .update(equipmentTable)
      .set({ slug: makeAssetSlug("equip", e.id, e.name) })
      .where(eq(equipmentTable.id, e.id));
  }
}

const EXTRA_TRUCKS = [
  {
    name: "T-04 Stump Truck",
    brand: "Ram",
    model: "5500 Service Body",
    vin: "3C7WRMBL000Z01",
    plate: "JTREE-4",
    status: "ACTIVE" as const,
    purchasePriceCents: 6_350_000,
    purchaseDate: new Date(2023, 9, 22),
    currentMileage: 14_280,
    serviceIntervalMiles: 5_000,
  },
  {
    name: "T-05 Mulch Truck",
    brand: "Isuzu",
    model: "NPR-HD Dump",
    vin: "JALC4W160P000Z01",
    plate: "JTREE-5",
    status: "OUT_OF_SERVICE_LEGACY" as const,
    purchasePriceCents: 5_900_000,
    purchaseDate: new Date(2018, 2, 9),
    currentMileage: 174_900,
    serviceIntervalMiles: 5_000,
  },
];

const EXTRA_EQUIP = [
  {
    name: "Bandit 21XP Chipper",
    type: "Chipper",
    brand: "Bandit",
    model: "21XP",
    serial: "BAN21XP-007",
    status: "ACTIVE" as const,
    purchasePriceCents: 9_200_000,
    purchaseDate: new Date(2022, 10, 4),
    currentHours: 1_540,
    serviceIntervalHours: 250,
  },
  {
    name: "Toro STX-38 Stump Grinder",
    type: "Stump Grinder",
    brand: "Toro",
    model: "STX-38",
    serial: "TORO-STX38-014",
    status: "IN_SHOP" as const,
    purchasePriceCents: 1_850_000,
    purchaseDate: new Date(2021, 6, 30),
    currentHours: 1_120,
    serviceIntervalHours: 100,
  },
];

async function ensureExtraAssets() {
  // Resolve a default department id so newly inserted demo assets satisfy
  // the NOT NULL department_id constraint. The legacy "Fleet" department
  // was retired with task #48 — fall back to Landscaping (the closest
  // operational equivalent for general-purpose trucks) and finally to the
  // first available row.
  const { departmentsTable } = await import("./schema");
  const allDepts = await db.select().from(departmentsTable);
  const fleetDeptId =
    allDepts.find((d) => d.key === "Landscaping")?.id ??
    allDepts.find((d) => d.key === "Admin")?.id ??
    allDepts[0]?.id;
  if (fleetDeptId == null) return; // no departments yet — skip demo seeding

  const trucks = await db.select().from(trucksTable);
  const truckNames = new Set(trucks.map((t) => t.name));
  for (const fix of EXTRA_TRUCKS) {
    if (truckNames.has(fix.name)) continue;
    // Map LEGACY status → DB enum value RETIRED.
    const status =
      (fix.status as string) === "OUT_OF_SERVICE_LEGACY" ? "RETIRED" : fix.status;
    const [row] = await db
      .insert(trucksTable)
      .values({
        name: fix.name,
        brand: fix.brand,
        model: fix.model,
        vin: fix.vin,
        plate: fix.plate,
        status: status as "ACTIVE" | "IN_SHOP" | "RETIRED",
        departmentId: fleetDeptId,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentMileage: fix.currentMileage,
        serviceIntervalMiles: fix.serviceIntervalMiles,
      })
      .returning();
    if (row) {
      await db
        .update(trucksTable)
        .set({ slug: makeAssetSlug("truck", row.id, row.name) })
        .where(eq(trucksTable.id, row.id));

      // Synthetic maintenance trail so this truck shows up in the registry.
      await db.insert(maintenanceLogsTable).values([
        {
          truckId: row.id,
          kind: "SCHEDULED",
          description: "PM service: oil, filter, lube, brake inspection",
          performedAt: new Date(Date.now() - 60 * 86_400_000),
          laborCostCents: 18_000,
          partsCostCents: 9_500,
          costCents: 27_500,
          mileageAtService: Math.max(0, fix.currentMileage - 4_800),
        },
      ]);
    }
  }

  const equip = await db.select().from(equipmentTable);
  const equipNames = new Set(equip.map((e) => e.name));
  for (const fix of EXTRA_EQUIP) {
    if (equipNames.has(fix.name)) continue;
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: fix.name,
        type: fix.type,
        brand: fix.brand,
        model: fix.model,
        serial: fix.serial,
        status: fix.status as "ACTIVE" | "IN_SHOP",
        departmentId: fleetDeptId,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentHours: fix.currentHours,
        serviceIntervalHours: fix.serviceIntervalHours,
      })
      .returning();
    if (row) {
      await db
        .update(equipmentTable)
        .set({ slug: makeAssetSlug("equip", row.id, row.name) })
        .where(eq(equipmentTable.id, row.id));

      await db.insert(maintenanceLogsTable).values([
        {
          equipmentId: row.id,
          kind: "REPAIR",
          description: "Drum bearings + belt replacement",
          performedAt: new Date(Date.now() - 28 * 86_400_000),
          laborCostCents: 36_000,
          partsCostCents: 24_500,
          costCents: 60_500,
          hoursAtService: Math.max(0, fix.currentHours - 90),
        },
        {
          equipmentId: row.id,
          kind: "SCHEDULED",
          description: "Hydraulic fluid + filter change",
          performedAt: new Date(Date.now() - 8 * 86_400_000),
          laborCostCents: 12_000,
          partsCostCents: 6_400,
          costCents: 18_400,
          hoursAtService: Math.max(0, fix.currentHours - 12),
        },
      ]);
    }
  }
}

// Demo data for the new asset categories: trailers (vehicle-like, no
// mileage usage), handheld tools with quantity > 1, and custom-labelled
// items. Idempotent — keyed by `name`. Only runs in non-production.
const EXTRA_TRAILERS = [
  {
    name: "TR-01 Equipment Trailer",
    brand: "Big Tex",
    model: "14ET-20",
    vin: "16VEX2024N0001",
    plate: "JT-TR-01",
    purchasePriceCents: 1_280_000,
    purchaseDate: new Date(2024, 1, 12),
  },
  {
    name: "TR-02 Mulch Dump Trailer",
    brand: "PJ",
    model: "DM-14",
    vin: "4P5DM1424P0002",
    plate: "JT-TR-02",
    purchasePriceCents: 980_000,
    purchaseDate: new Date(2023, 10, 4),
  },
];

const EXTRA_HANDHELD = [
  {
    name: "Pole Saws",
    type: "Pole Saw",
    brand: "Stihl",
    model: "HT 135",
    quantity: 4,
    purchasePriceCents: 79_900,
    purchaseDate: new Date(2024, 5, 10),
  },
  {
    name: "Shovels",
    type: "Hand Tool",
    brand: "Fiskars",
    model: "Pro Round-Point",
    quantity: 30,
    purchasePriceCents: 4_500,
    purchaseDate: new Date(2023, 2, 18),
  },
  {
    name: "Hedge Trimmers",
    type: "Trimmer",
    brand: "Echo",
    model: "HC-2020",
    quantity: 6,
    purchasePriceCents: 38_900,
    purchaseDate: new Date(2024, 8, 1),
  },
];

const EXTRA_CUSTOM = [
  {
    name: "Climbing Helmets",
    type: "PPE",
    brand: "Petzl",
    model: "Vertex Vent",
    quantity: 12,
    customCategoryLabel: "Safety Gear",
    purchasePriceCents: 14_900,
    purchaseDate: new Date(2024, 3, 22),
  },
  {
    name: "Climbing Harnesses",
    type: "PPE",
    brand: "Buckingham",
    model: "BuckOhm",
    quantity: 8,
    customCategoryLabel: "Safety Gear",
    purchasePriceCents: 39_900,
    purchaseDate: new Date(2024, 4, 9),
  },
  {
    name: "Battery Drills",
    type: "Power Tool",
    brand: "Milwaukee",
    model: "M18 Fuel",
    quantity: 5,
    customCategoryLabel: "Power Tools",
    purchasePriceCents: 24_900,
    purchaseDate: new Date(2024, 6, 14),
  },
];

async function ensureExtraTrailersAndHandhelds() {
  const { departmentsTable } = await import("./schema");
  const allDepts = await db.select().from(departmentsTable);
  const fleetDeptId =
    allDepts.find((d) => d.key === "Landscaping")?.id ??
    allDepts.find((d) => d.key === "Admin")?.id ??
    allDepts[0]?.id;
  const tsDeptId = allDepts.find((d) => d.key === "TreeService")?.id ?? fleetDeptId;
  const lsDeptId = allDepts.find((d) => d.key === "Landscaping")?.id ?? fleetDeptId;
  if (fleetDeptId == null) return;

  // Trailers piggy-back on the trucks table via the vehicle_type
  // discriminator; mileage stays at 0 because the UI hides usage for
  // trailers — but the columns are NOT NULL so we still populate them.
  const trucks = await db.select().from(trucksTable);
  const truckNames = new Set(trucks.map((t) => t.name));
  for (const fix of EXTRA_TRAILERS) {
    if (truckNames.has(fix.name)) continue;
    const [row] = await db
      .insert(trucksTable)
      .values({
        name: fix.name,
        vehicleType: "TRAILER",
        brand: fix.brand,
        model: fix.model,
        vin: fix.vin,
        plate: fix.plate,
        status: "ACTIVE",
        departmentId: fleetDeptId,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentMileage: 0,
        serviceIntervalMiles: 0,
      })
      .returning();
    if (row) {
      await db
        .update(trucksTable)
        .set({ slug: makeAssetSlug("truck", row.id, row.name) })
        .where(eq(trucksTable.id, row.id));
    }
  }

  const equip = await db.select().from(equipmentTable);
  const equipNames = new Set(equip.map((e) => e.name));
  // Handheld goes under TreeService (chainsaw-adjacent crews); custom
  // gear is split across Landscaping / TreeService for variety.
  for (const fix of EXTRA_HANDHELD) {
    if (equipNames.has(fix.name)) continue;
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: fix.name,
        type: fix.type,
        category: "HANDHELD",
        quantity: fix.quantity,
        brand: fix.brand,
        model: fix.model,
        status: "ACTIVE",
        departmentId: tsDeptId ?? fleetDeptId,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentHours: 0,
        serviceIntervalHours: 0,
      })
      .returning();
    if (row) {
      await db
        .update(equipmentTable)
        .set({ slug: makeAssetSlug("equip", row.id, row.name) })
        .where(eq(equipmentTable.id, row.id));
    }
  }

  for (const fix of EXTRA_CUSTOM) {
    if (equipNames.has(fix.name)) continue;
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: fix.name,
        type: fix.type,
        category: "CUSTOM",
        customCategoryLabel: fix.customCategoryLabel,
        quantity: fix.quantity,
        brand: fix.brand,
        model: fix.model,
        status: "ACTIVE",
        departmentId: lsDeptId ?? fleetDeptId,
        purchasePriceCents: fix.purchasePriceCents,
        purchaseDate: fix.purchaseDate,
        currentHours: 0,
        serviceIntervalHours: 0,
      })
      .returning();
    if (row) {
      await db
        .update(equipmentTable)
        .set({ slug: makeAssetSlug("equip", row.id, row.name) })
        .where(eq(equipmentTable.id, row.id));
    }
  }
}

// Suppress unused-import lint when no rows match the OR()-style filter.
void or;
