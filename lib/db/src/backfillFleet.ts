import { eq, isNull, or, and, sql } from "drizzle-orm";
import { db } from "./client";
import {
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
} from "./schema";

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
  await backfillTruckFixtures();
  await backfillEquipmentFixtures();
  await backfillMaintenanceLogs();
  await backfillSlugs();
  // Demo enrichment (extra synthetic assets) is gated to non-production
  // environments so we never contaminate a real customer DB. In production,
  // operators should add their own assets via the Asset Registry UI.
  if (process.env.NODE_ENV !== "production") {
    await ensureExtraAssets();
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

// Suppress unused-import lint when no rows match the OR()-style filter.
void or;
