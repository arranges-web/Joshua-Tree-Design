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
import { eq, isNull, notInArray, or, sql, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./client";
import {
  departmentsTable,
  trucksTable,
  equipmentTable,
  usersTable,
  crewsTable,
  crewMembersTable,
  maintenanceLogsTable,
  rolesTable,
  DEPARTMENT_KEYS,
} from "./schema";
import { isDemoMode } from "./demoMode";

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

  // 4. Per-dept demo fleet. Gated by DEMO_MODE so the live published
  // demo also seeds a starter truck + equipment for any visible dept
  // that lacks one.
  if (isDemoMode()) {
    await ensureDepartmentFleet();
  }

  // 5. Per-dept demo crew — runs in all environments because the live
  // demo deploy was seeded before the Sales / Fertilization depts
  // existed and the customer-count guard in backfillDemoData skips
  // them. This adds one crew per visible dept that doesn't already
  // have one, led by the highest-priority user already in that dept
  // (CREW_LEAD > MECHANIC > ADMIN > anyone else).
  await ensureDepartmentCrew();

  // 6. Enrich existing maintenance logs with vendor / category /
  // notes / receipt so the accounting dashboards have something to
  // show out of the box, and seed a maintenance trail for any truck
  // or equipment row that has no logs yet (typical for the brand-new
  // Sales / Fertilization assets).
  await enrichMaintenanceLogs();
  await seedMissingMaintenanceLogs();

  // 7. Repair the eight demo accounts on every boot when DEMO_MODE
  // is on. Guarantees the published preview always has working
  // logins after schema changes, role updates, or partial DB
  // rebuilds — login was silently 401-ing on the live deploy
  // because the seeded password hash had drifted out of sync.
  if (isDemoMode()) {
    await repairDemoUsers();
  }
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

// ---------- Maintenance enrichment ----------

type ReceiptCategory = "LABOR" | "PARTS" | "FUEL" | "OUTSOURCED" | "OTHER";

type VendorPick = {
  vendor: string;
  category: ReceiptCategory;
  noteTemplate?: (cents: number) => string;
};

// Heuristic vendor + category mapping based on the existing
// description text. Keeps the demo data feeling real without us
// having to hand-author one entry per row.
function inferVendor(description: string): VendorPick {
  const d = description.toLowerCase();
  if (d.includes("oil") || d.includes("filter") || d.includes("fluid"))
    return { vendor: "NAPA Auto Parts — Fort Myers", category: "PARTS" };
  if (d.includes("tire"))
    return { vendor: "Discount Tire — Cape Coral", category: "PARTS" };
  if (d.includes("hydraulic"))
    return { vendor: "Mid-Florida Hydraulics", category: "LABOR" };
  if (d.includes("fuel") || d.includes("gas"))
    return { vendor: "Wawa Fleet Card #4412", category: "FUEL" };
  if (d.includes("crane") || d.includes("certif"))
    return { vendor: "Florida Crane Inspection Co.", category: "OUTSOURCED" };
  if (d.includes("inspection") || d.includes("dot"))
    return { vendor: "Sunshine State Inspection", category: "OUTSOURCED" };
  if (d.includes("brake"))
    return { vendor: "Big Truck Brake & Clutch", category: "PARTS" };
  if (d.includes("chain") || d.includes("bar"))
    return { vendor: "Bayshore Saw & Mower", category: "PARTS" };
  if (d.includes("paint") || d.includes("body"))
    return { vendor: "Jim's Auto Body", category: "OUTSOURCED" };
  if (d.includes("seal") || d.includes("gasket"))
    return { vendor: "Industrial Seal Supply", category: "PARTS" };
  return { vendor: "Joshua Tree Shop", category: "LABOR" };
}

// Deterministic SVG receipt generator. We base64-encode the SVG so
// the result is a `data:image/svg+xml;base64,…` URL that the existing
// receipt-preview modal renders without any extra plumbing. Keeping
// the layout simple and inlining the styles makes this resilient to
// the email/img/etc. renderers users might paste into.
function svgReceiptDataUrl(opts: {
  vendor: string;
  category: ReceiptCategory;
  description: string;
  totalCents: number;
  laborCents: number;
  partsCents: number;
  performedAt: Date;
}): string {
  const { vendor, category, description, totalCents, laborCents, partsCents, performedAt } = opts;
  const fmt = (cents: number) =>
    `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const dateStr = performedAt.toISOString().slice(0, 10);
  // Wrap long descriptions across two lines.
  const desc =
    description.length > 36 ? `${description.slice(0, 33)}…` : description;
  const id = `INV-${Math.abs(
    Array.from(`${vendor}${dateStr}${totalCents}`).reduce(
      (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
      0,
    ),
  )
    .toString(36)
    .toUpperCase()
    .slice(0, 8)}`;
  // Two-column line items: labor + parts when both are non-zero,
  // otherwise just one row. Tax is fixed at 6% of subtotal so the
  // totals line up — matches FL state sales tax for plausibility.
  const subtotalCents = laborCents + partsCents;
  const taxCents = Math.max(0, totalCents - subtotalCents);
  const rows: { label: string; cents: number }[] = [];
  if (laborCents > 0) rows.push({ label: "Labor", cents: laborCents });
  if (partsCents > 0) rows.push({ label: "Parts & supplies", cents: partsCents });
  if (rows.length === 0) rows.push({ label: "Service", cents: totalCents });
  const lineY = (i: number) => 200 + i * 22;
  const linesSvg = rows
    .map(
      (r, i) =>
        `<text x="36" y="${lineY(i)}" font-size="13" fill="#1f2937">${r.label}</text>` +
        `<text x="464" y="${lineY(i)}" font-size="13" fill="#1f2937" text-anchor="end">${fmt(r.cents)}</text>`,
    )
    .join("");
  const subtotalY = lineY(rows.length) + 16;
  const totalY = subtotalY + 32;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ${totalY + 60}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
  <rect width="500" height="${totalY + 60}" fill="#fafaf7"/>
  <rect x="14" y="14" width="472" height="${totalY + 32}" rx="6" fill="#ffffff" stroke="#d4d4cf"/>
  <text x="36" y="56" font-size="20" font-weight="700" fill="#0f172a">${escapeSvg(vendor)}</text>
  <text x="36" y="78" font-size="11" fill="#6b7280">Receipt · ${id}</text>
  <text x="464" y="56" font-size="13" fill="#0f172a" text-anchor="end">${dateStr}</text>
  <text x="464" y="76" font-size="11" fill="#6b7280" text-anchor="end">Category · ${category}</text>
  <line x1="36" y1="100" x2="464" y2="100" stroke="#e5e7eb"/>
  <text x="36" y="124" font-size="12" fill="#6b7280">Description</text>
  <text x="36" y="146" font-size="14" fill="#0f172a">${escapeSvg(desc)}</text>
  <line x1="36" y1="170" x2="464" y2="170" stroke="#e5e7eb"/>
  <text x="36" y="190" font-size="11" fill="#6b7280" letter-spacing="1">LINE ITEMS</text>
  ${linesSvg}
  <line x1="36" y1="${subtotalY - 12}" x2="464" y2="${subtotalY - 12}" stroke="#e5e7eb"/>
  <text x="36" y="${subtotalY}" font-size="12" fill="#6b7280">Subtotal</text>
  <text x="464" y="${subtotalY}" font-size="12" fill="#1f2937" text-anchor="end">${fmt(subtotalCents)}</text>
  <text x="36" y="${subtotalY + 18}" font-size="12" fill="#6b7280">Tax</text>
  <text x="464" y="${subtotalY + 18}" font-size="12" fill="#1f2937" text-anchor="end">${fmt(taxCents)}</text>
  <text x="36" y="${totalY}" font-size="14" font-weight="700" fill="#0f172a">TOTAL</text>
  <text x="464" y="${totalY}" font-size="16" font-weight="700" fill="#0f172a" text-anchor="end">${fmt(totalCents)}</text>
  <text x="36" y="${totalY + 26}" font-size="10" fill="#9ca3af">Auto-generated demo receipt · Joshua Tree Inc.</text>
</svg>`;
  // Buffer is available in node; if running in an env without it the
  // backfill simply skips this step.
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8").toString("base64")
      : btoa(svg);
  return `data:image/svg+xml;base64,${b64}`;
}

function escapeSvg(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function enrichMaintenanceLogs(): Promise<void> {
  // Pick up logs that don't yet have a vendor populated. The receipt
  // column may have been added by the same boot's earlier ALTER step.
  const logs = await db
    .select()
    .from(maintenanceLogsTable)
    .where(or(isNull(maintenanceLogsTable.vendor), eq(maintenanceLogsTable.vendor, "")));

  for (const log of logs) {
    const pick = inferVendor(log.description);
    const performedAt = new Date(log.performedAt);
    const totalCents = log.costCents ?? 0;
    const laborCents = log.laborCostCents ?? 0;
    const partsCents = log.partsCostCents ?? 0;
    const dataUrl = svgReceiptDataUrl({
      vendor: pick.vendor,
      category: pick.category,
      description: log.description,
      totalCents,
      laborCents,
      partsCents,
      performedAt,
    });
    await db
      .update(maintenanceLogsTable)
      .set({
        vendor: pick.vendor,
        category: pick.category,
        receiptDataUrl: dataUrl,
        // Only set notes if the column was empty; preserves any
        // accountant-entered notes from the UI.
        notes:
          log.notes && log.notes.length > 0
            ? log.notes
            : "Auto-attached demo receipt — replace on next visit.",
      })
      .where(eq(maintenanceLogsTable.id, log.id));
  }
}

// Each visible-dept truck/equipment row that has zero maintenance
// logs gets a small, recent maintenance trail so the Pulse + Money
// Pits + Accounting expense category breakdowns have data per dept.
const SEED_LOG_TEMPLATES: Array<{
  daysAgo: number;
  kind: "SCHEDULED" | "REPAIR" | "INSPECTION";
  description: string;
  laborCents: number;
  partsCents: number;
}> = [
  {
    daysAgo: 18,
    kind: "SCHEDULED",
    description: "Oil & filter change, lube fittings, fluid top-off",
    laborCents: 9_500,
    partsCents: 6_500,
  },
  {
    daysAgo: 47,
    kind: "REPAIR",
    description: "Replaced front brake pads & rotors — pulsing complaint",
    laborCents: 22_000,
    partsCents: 38_000,
  },
  {
    daysAgo: 92,
    kind: "INSPECTION",
    description: "Quarterly DOT safety inspection — passed with notes",
    laborCents: 12_500,
    partsCents: 0,
  },
];

async function seedMissingMaintenanceLogs(): Promise<void> {
  const allLogs = await db
    .select({
      truckId: maintenanceLogsTable.truckId,
      equipmentId: maintenanceLogsTable.equipmentId,
    })
    .from(maintenanceLogsTable);
  const trucksWithLogs = new Set(
    allLogs.filter((l) => l.truckId != null).map((l) => l.truckId as number),
  );
  const equipWithLogs = new Set(
    allLogs.filter((l) => l.equipmentId != null).map((l) => l.equipmentId as number),
  );

  const trucks = await db.select().from(trucksTable);
  const equipment = await db.select().from(equipmentTable);

  for (const t of trucks) {
    if (trucksWithLogs.has(t.id)) continue;
    const baseMileage = t.currentMileage ?? 0;
    for (const tpl of SEED_LOG_TEMPLATES) {
      const performedAt = new Date(Date.now() - tpl.daysAgo * 86_400_000);
      const totalCents = tpl.laborCents + tpl.partsCents;
      const pick = inferVendor(tpl.description);
      const receipt = svgReceiptDataUrl({
        vendor: pick.vendor,
        category: pick.category,
        description: tpl.description,
        totalCents,
        laborCents: tpl.laborCents,
        partsCents: tpl.partsCents,
        performedAt,
      });
      await db.insert(maintenanceLogsTable).values({
        truckId: t.id,
        kind: tpl.kind,
        description: tpl.description,
        performedAt,
        laborCostCents: tpl.laborCents,
        partsCostCents: tpl.partsCents,
        costCents: totalCents,
        mileageAtService: Math.max(0, baseMileage - tpl.daysAgo * 12),
        vendor: pick.vendor,
        category: pick.category,
        notes: "Demo seed.",
        receiptDataUrl: receipt,
      });
    }
  }

  for (const e of equipment) {
    if (equipWithLogs.has(e.id)) continue;
    const baseHours = e.currentHours ?? 0;
    // Equipment gets a lighter trail (2 logs) tracked in hours.
    for (const tpl of SEED_LOG_TEMPLATES.slice(0, 2)) {
      const performedAt = new Date(Date.now() - tpl.daysAgo * 86_400_000);
      const totalCents = tpl.laborCents + tpl.partsCents;
      const pick = inferVendor(tpl.description);
      const receipt = svgReceiptDataUrl({
        vendor: pick.vendor,
        category: pick.category,
        description: tpl.description,
        totalCents,
        laborCents: tpl.laborCents,
        partsCents: tpl.partsCents,
        performedAt,
      });
      await db.insert(maintenanceLogsTable).values({
        equipmentId: e.id,
        kind: tpl.kind,
        description: tpl.description,
        performedAt,
        laborCostCents: tpl.laborCents,
        partsCostCents: tpl.partsCents,
        costCents: totalCents,
        hoursAtService: Math.max(0, baseHours - tpl.daysAgo),
        vendor: pick.vendor,
        category: pick.category,
        notes: "Demo seed.",
        receiptDataUrl: receipt,
      });
    }
  }
  // Suppress unused-import if no rows match.
  void and;
}

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

// ---------- Demo user repair ----------

/**
 * The published Replit preview kept showing "invalid credentials"
 * on the test accounts because at various points the seed migration
 * had dropped some demo users, or the bcrypt hash they were seeded
 * with had drifted (e.g. a column rename, partial restore, etc.).
 *
 * This step makes the demo accounts self-healing: on every boot in
 * DEMO_MODE, it walks the canonical 8-user list, makes sure each
 * row exists with the right role + dept + active flag, and resets
 * the bcrypt hash for "password123" so the test accounts shown on
 * the login page always work.
 *
 * Production-grade installs should set DEMO_MODE=false to skip
 * this — it would otherwise reset live admin passwords on every
 * boot.
 */
const DEMO_PASSWORD = "password123";

type DemoUser = {
  email: string;
  fullName: string;
  roleKey: "ADMIN" | "SALES" | "CREW_LEAD" | "MECHANIC" | "ACCOUNTING_MANAGER";
  deptKey: (typeof DEPARTMENT_KEYS)[number];
};

const DEMO_USERS: DemoUser[] = [
  { email: "admin@joshuatreeinc.test",      fullName: "Alex Admin",      roleKey: "ADMIN",              deptKey: "Admin" },
  { email: "sales1@joshuatreeinc.test",     fullName: "Sam Sales",       roleKey: "SALES",              deptKey: "Sales" },
  { email: "sales2@joshuatreeinc.test",     fullName: "Sara Estimator",  roleKey: "SALES",              deptKey: "Sales" },
  { email: "lead1@joshuatreeinc.test",      fullName: "Carl CrewLead",   roleKey: "CREW_LEAD",          deptKey: "Landscaping" },
  { email: "lead2@joshuatreeinc.test",      fullName: "Cathy CrewLead",  roleKey: "CREW_LEAD",          deptKey: "Lawn" },
  { email: "lead3@joshuatreeinc.test",      fullName: "Bobby CrewLead",  roleKey: "CREW_LEAD",          deptKey: "TreeService" },
  { email: "mechanic@joshuatreeinc.test",   fullName: "Mike Mechanic",   roleKey: "MECHANIC",           deptKey: "Pest" },
  { email: "accounting@joshuatreeinc.test", fullName: "Anna Accountant", roleKey: "ACCOUNTING_MANAGER", deptKey: "Admin" },
];

async function repairDemoUsers(): Promise<void> {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  const allRoles = await db.select().from(rolesTable);
  const roleIdByKey = new Map(allRoles.map((r) => [r.key, r.id] as const));

  const allDepts = await db.select().from(departmentsTable);
  const deptIdByKey = new Map(allDepts.map((d) => [d.key, d.id] as const));

  // Pre-fetch all demo emails so we can decide insert vs update in
  // a single round trip. Drizzle's `inArray` keeps this efficient
  // even when the demo set grows.
  const emails = DEMO_USERS.map((u) => u.email);
  const existing = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.email, emails));
  const existingByEmail = new Map(existing.map((u) => [u.email, u]));

  for (const u of DEMO_USERS) {
    const roleId = roleIdByKey.get(u.roleKey);
    const deptId = deptIdByKey.get(u.deptKey);
    if (roleId == null || deptId == null) {
      // Roles or depts haven't been seeded yet — skip rather than
      // FK-violation. The caller (autoSeed) runs roles+depts before
      // this; backfillDepartments runs after, so we should always
      // have them.
      continue;
    }
    const row = existingByEmail.get(u.email);
    if (row) {
      await db
        .update(usersTable)
        .set({
          fullName: u.fullName,
          roleId,
          departmentId: deptId,
          isActive: true,
          hashedPassword,
        })
        .where(eq(usersTable.id, row.id));
    } else {
      await db.insert(usersTable).values({
        email: u.email,
        fullName: u.fullName,
        roleId,
        departmentId: deptId,
        isActive: true,
        hashedPassword,
      });
    }
  }
}
