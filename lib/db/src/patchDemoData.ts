/**
 * @dev-utility ONE-TIME PATCH — do NOT call from server startup.
 *
 * Applied manually on 2026-05-05 to upgrade an existing development DB
 * that was seeded before backfillDemoData.ts was fully written. A fresh
 * install via backfillDemoData.ts already includes everything below.
 *
 * Applied changes:
 *  1. Added 2–4 line items to every quote that had none (quotes 3–20)
 *  2. Inserted 2 REJECTED quotes with line items
 *  3. Inserted additional completed jobs + invoices spanning Nov–Dec 2025
 *     so the accounting monthly chart has full 6-month coverage
 *  4. Added equipment for Lawn and Pest departments
 *
 * Idempotent guard: skips if quote_line_items count >= 35 (already patched).
 * Not exported from lib/db/src/index.ts — run manually via:
 *   node --import tsx/esm lib/db/src/patchDemoData.ts
 */

import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  quotesTable,
  quoteLineItemsTable,
  invoicesTable,
  jobsTable,
  equipmentTable,
  customersTable,
  propertiesTable,
  departmentsTable,
  usersTable,
  crewsTable,
} from "./schema";

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 60);
}

async function main() {
  // Guard
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quoteLineItemsTable);
  if (n >= 35) {
    console.log("Already patched (line items >= 35). Skipping.");
    return;
  }

  // Resolve departments and users
  const depts = await db.select().from(departmentsTable);
  const deptId = (key: string) => depts.find((d) => d.key === key)?.id ?? null;
  const dLawn = deptId("Lawn")!;
  const dLand = deptId("Landscaping")!;
  const dTree = deptId("TreeService")!;
  const dPest = deptId("Pest")!;

  const users = await db.select().from(usersTable);
  const uid = (email: string) => users.find((u) => u.email === email)?.id;
  const sales1 = uid("sales1@joshuatreeinc.test")!;
  const sales2 = uid("sales2@joshuatreeinc.test")!;
  const mech   = uid("mechanic@joshuatreeinc.test")!;

  // ── 1. Line items for quotes missing them ─────────────────────────────────
  // Original autoSeed quotes 3–10 (SENT/DRAFT, no line items)
  // New backfill quotes 15–20 (SENT/DRAFT, no line items)
  type LI = { quoteId: number; description: string; unitPriceCents: number; qty: number };
  const newLineItems: LI[] = [
    // Quote 3 (customer 2, SENT — Fort Myers, tree trimming)
    { quoteId: 3, description: "Queen palm trimming — 5 palms",        unitPriceCents:  32_000, qty: 5 },
    { quoteId: 3, description: "Live oak crown reduction",             unitPriceCents:  75_000, qty: 1 },
    { quoteId: 3, description: "Debris haul-off",                      unitPriceCents:  18_000, qty: 1 },
    // Quote 4 (customer 4, SENT — Naples, landscaping)
    { quoteId: 4, description: "Site grading — 0.5 acre",              unitPriceCents: 280_000, qty: 1 },
    { quoteId: 4, description: "Retention wall — 40 linear ft",        unitPriceCents:  95_000, qty: 1 },
    { quoteId: 4, description: "Bahia sod installation (sq ft)",       unitPriceCents:      80, qty: 250 },
    // Quote 5 (customer 6, SENT — Naples, lawn)
    { quoteId: 5, description: "Monthly lawn maintenance (mo)",        unitPriceCents:  24_000, qty: 3 },
    { quoteId: 5, description: "Mulch beds refresh — 5 cu yd",         unitPriceCents:   1_750, qty: 5 },
    // Quote 6 (customer 7, DRAFT — Naples, pest)
    { quoteId: 6, description: "Annual pest control contract (mo)",    unitPriceCents:  28_000, qty: 12 },
    { quoteId: 6, description: "Termite bait station install (ea)",    unitPriceCents:   2_500, qty: 12 },
    // Quote 7 (customer 8, DRAFT — Bonita Springs, tree)
    { quoteId: 7, description: "Australian pine removal — 6 trees",   unitPriceCents:  18_500, qty: 6 },
    { quoteId: 7, description: "Stump grinding (ea)",                  unitPriceCents:  15_000, qty: 6 },
    // Quote 8 (customer 9, DRAFT — Cape Coral, land)
    { quoteId: 8, description: "Lot clearing — 1.5 acres",             unitPriceCents: 280_000, qty: 1 },
    { quoteId: 8, description: "Fill dirt — 40 cu yd",                  unitPriceCents:   1_200, qty: 40 },
    { quoteId: 8, description: "Compaction & grading",                 unitPriceCents:  55_000, qty: 1 },
    // Quote 9 (customer 10, DRAFT — Marco Island, tree)
    { quoteId: 9, description: "Sabal palm relocation (ea)",           unitPriceCents:  65_000, qty: 4 },
    { quoteId: 9, description: "Equipment rental — crane (day)",       unitPriceCents:  85_000, qty: 1 },
    { quoteId: 9, description: "Debris removal",                       unitPriceCents:  30_000, qty: 1 },
    // Quote 10 (customer 5, DRAFT — Bonita Springs, pest)
    { quoteId: 10, description: "Quarterly pest control (yr)",         unitPriceCents:  30_000, qty: 4 },
    { quoteId: 10, description: "Rodent exclusion program",            unitPriceCents:  21_650, qty: 1 },
    // Quote 15 (customer 12 = Carol, SENT — Tree)
    { quoteId: 15, description: "Banyan trimming — 3 locations",       unitPriceCents:  52_500, qty: 3 },
    { quoteId: 15, description: "Chip & haul debris",                  unitPriceCents:  37_000, qty: 1 },
    // Quote 16 (customer 15 = Frank, SENT — Land)
    { quoteId: 16, description: "Retention pond excavation",           unitPriceCents: 280_000, qty: 1 },
    { quoteId: 16, description: "County spec survey & staking",        unitPriceCents:  35_000, qty: 1 },
    { quoteId: 16, description: "Erosion control matting",             unitPriceCents:  25_000, qty: 1 },
    // Quote 17 (customer 18 = Janet, SENT — Lawn)
    { quoteId: 17, description: "St. Augustine sod (sq ft)",           unitPriceCents:      90, qty: 3_500 },
    { quoteId: 17, description: "Soil prep & rough grade",             unitPriceCents:  30_000, qty: 1 },
    // Quote 18 (customer 21 = Martin, SENT — Pest)
    { quoteId: 18, description: "Termite inspection — full structure", unitPriceCents:  35_000, qty: 1 },
    { quoteId: 18, description: "Spot chemical treatment",             unitPriceCents:  10_000, qty: 3 },
    // Quote 19 (customer 13 = Douglas, DRAFT — Tree)
    { quoteId: 19, description: "Sabal palm trimming (ea)",            unitPriceCents:  20_000, qty: 6 },
    { quoteId: 19, description: "Fertilization boot treatment (ea)",   unitPriceCents:   4_166, qty: 6 },
    // Quote 20 (customer 22 = Nancy, DRAFT — Pest)
    { quoteId: 20, description: "Drywood termite tent fumigation",     unitPriceCents:  75_000, qty: 1 },
    { quoteId: 20, description: "Contents protection wrap",            unitPriceCents:  20_000, qty: 1 },
  ];

  await db.insert(quoteLineItemsTable).values(newLineItems);
  console.log(`Inserted ${newLineItems.length} quote line items`);

  // ── 2. Two REJECTED quotes with 2–3 line items each ──────────────────────
  // Use existing new customers: brandon (11, prop 14) and elaine (14, prop 17)
  const rejQuotes = await db
    .insert(quotesTable)
    .values([
      { customerId: 11, propertyId: 14, ownerUserId: sales2, status: "REJECTED", subtotalCents: 720_000, totalCents: 770_400 },
      { customerId: 14, propertyId: 17, ownerUserId: sales1, status: "REJECTED", subtotalCents: 950_000, totalCents: 1_016_500 },
    ])
    .returning();

  if (rejQuotes[0] && rejQuotes[1]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: rejQuotes[0].id, description: "Full property tree removal — 8 trees",  unitPriceCents:  85_000, qty: 8 },
      { quoteId: rejQuotes[0].id, description: "Stump grinding (ea)",                   unitPriceCents:  35_000, qty: 8 },
      { quoteId: rejQuotes[0].id, description: "Lot clearing & debris haul",            unitPriceCents:  40_000, qty: 1 },
      { quoteId: rejQuotes[1].id, description: "Commercial lot grading — 2 acres",      unitPriceCents: 650_000, qty: 1 },
      { quoteId: rejQuotes[1].id, description: "Drainage swale installation",           unitPriceCents: 180_000, qty: 1 },
      { quoteId: rejQuotes[1].id, description: "Compaction testing & report",           unitPriceCents: 120_000, qty: 1 },
    ]);
    console.log("Inserted 2 REJECTED quotes with line items");
  }

  // ── 3. Jobs + invoices spanning Nov–Dec 2025 (140–180 days ago) ──────────
  // Need completed jobs far enough back so invoices hit Nov/Dec 2025
  const crews = await db.select().from(crewsTable);
  const crewByDept = (dId: number) => crews.filter((c) => c.departmentId === dId);

  const treeCrew2  = crewByDept(dTree)[1]?.id  ?? crewByDept(dTree)[0]?.id!;
  const landCrew1  = crewByDept(dLand)[0]?.id!;
  const lawnCrew1  = crewByDept(dLawn)[0]?.id!;
  const pestCrew2  = crewByDept(dPest)[1]?.id  ?? crewByDept(dPest)[0]?.id!;

  // Customers 11–22; properties 14–25 in order
  const oldJobs = await db
    .insert(jobsTable)
    .values([
      // Tree — Nov 2025 (~175 days ago)
      { propertyId: 14, crewId: treeCrew2, status: "COMPLETE", scheduledFor: daysAgo(177), completedAt: daysAgo(176), totalCents: 195_000, notes: "Royal palm trimming — 4 palms" },
      // Tree — Dec 2025 (~145 days ago)
      { propertyId: 15, crewId: treeCrew2, status: "COMPLETE", scheduledFor: daysAgo(147), completedAt: daysAgo(146), totalCents: 310_000, notes: "Live oak canopy reduction — 2 trees" },
      // Land — Nov 2025
      { propertyId: 18, crewId: landCrew1, status: "COMPLETE", scheduledFor: daysAgo(175), completedAt: daysAgo(174), totalCents: 260_000, notes: "Erosion control & seed blanket — 0.8 acres" },
      // Land — Dec 2025
      { propertyId: 17, crewId: landCrew1, status: "COMPLETE", scheduledFor: daysAgo(148), completedAt: daysAgo(147), totalCents: 540_000, notes: "Full property re-grading — drainage correction" },
      // Lawn — Nov 2025
      { propertyId: 21, crewId: lawnCrew1, status: "COMPLETE", scheduledFor: daysAgo(170), completedAt: daysAgo(169), totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      // Lawn — Dec 2025
      { propertyId: 22, crewId: lawnCrew1, status: "COMPLETE", scheduledFor: daysAgo(143), completedAt: daysAgo(142), totalCents: 195_000, notes: "Full lawn renovation — resod St. Augustine" },
      // Pest — Nov 2025
      { propertyId: 23, crewId: pestCrew2, status: "COMPLETE", scheduledFor: daysAgo(172), completedAt: daysAgo(171), totalCents:  48_000, notes: "Quarterly pest control" },
      // Pest — Dec 2025
      { propertyId: 24, crewId: pestCrew2, status: "COMPLETE", scheduledFor: daysAgo(145), completedAt: daysAgo(144), totalCents:  48_000, notes: "Quarterly pest control" },
    ])
    .returning();

  const [treeNov, treeDec, landNov, landDec, lawnNov, lawnDec, pestNov, pestDec] = oldJobs;

  type InvRow = { jobId: number; customerId: number; status: "PAID"; totalCents: number; issuedAt: Date; paidAt: Date };
  const historicInvoices: InvRow[] = [
    // Tree
    { jobId: treeNov.id, customerId: 12, status: "PAID", totalCents: 195_000, issuedAt: daysAgo(174), paidAt: daysAgo(163) },
    { jobId: treeDec.id, customerId: 12, status: "PAID", totalCents: 310_000, issuedAt: daysAgo(144), paidAt: daysAgo(133) },
    // Land
    { jobId: landNov.id, customerId: 15, status: "PAID", totalCents: 260_000, issuedAt: daysAgo(173), paidAt: daysAgo(161) },
    { jobId: landDec.id, customerId: 14, status: "PAID", totalCents: 540_000, issuedAt: daysAgo(146), paidAt: daysAgo(135) },
    // Lawn
    { jobId: lawnNov.id, customerId: 18, status: "PAID", totalCents:  58_000, issuedAt: daysAgo(168), paidAt: daysAgo(158) },
    { jobId: lawnDec.id, customerId: 19, status: "PAID", totalCents: 195_000, issuedAt: daysAgo(141), paidAt: daysAgo(131) },
    // Pest
    { jobId: pestNov.id, customerId: 20, status: "PAID", totalCents:  48_000, issuedAt: daysAgo(170), paidAt: daysAgo(160) },
    { jobId: pestDec.id, customerId: 21, status: "PAID", totalCents:  48_000, issuedAt: daysAgo(143), paidAt: daysAgo(133) },
  ];

  await db.insert(invoicesTable).values(historicInvoices);
  console.log(`Inserted ${historicInvoices.length} historic invoices (Nov–Dec 2025)`);

  // ── 4. Equipment for Lawn and Pest departments ────────────────────────────
  const existingEquip = await db.select({ name: equipmentTable.name }).from(equipmentTable);
  const equippedNames = new Set(existingEquip.map((e) => e.name));

  const equipToAdd = [
    // Lawn
    { name: "Exmark Lazer Z Mower",       type: "Zero-Turn Mower",      category: "CUSTOM"   as const, departmentId: dLawn, quantity: 2,  brand: "Exmark",       model: "Lazer Z X-Series",  status: "ACTIVE" as const, purchasePriceCents: 1_200_000, purchaseDate: new Date(2023, 2, 10), currentHours: 620,   serviceIntervalHours: 200 },
    { name: "String Trimmers",             type: "Trimmer",               category: "HANDHELD" as const, departmentId: dLawn, quantity: 6,  brand: "STIHL",        model: "FS 131",            status: "ACTIVE" as const, purchasePriceCents:    65_000, purchaseDate: new Date(2023, 6, 1),  currentHours: 280,   serviceIntervalHours: 100 },
    { name: "Backpack Blowers",            type: "Blower",                category: "HANDHELD" as const, departmentId: dLawn, quantity: 4,  brand: "RedMax",       model: "EBZ8550",           status: "ACTIVE" as const, purchasePriceCents:    58_000, purchaseDate: new Date(2023, 6, 1),  currentHours: 240,   serviceIntervalHours: 100 },
    { name: "Lawn Spreader",               type: "Fertilizer Spreader",   category: "HANDHELD" as const, departmentId: dLawn, quantity: 3,  brand: "LESCO",        model: "HD 80 lb",          status: "ACTIVE" as const, purchasePriceCents:    35_000, purchaseDate: new Date(2022, 9, 15), currentHours: 0,     serviceIntervalHours: 500 },
    // Pest
    { name: "Ride-On Sprayer",             type: "Spray Equipment",       category: "CUSTOM"   as const, departmentId: dPest, quantity: 1,  brand: "Perma-Green",  model: "Triumph",           status: "ACTIVE" as const, purchasePriceCents:   980_000, purchaseDate: new Date(2022, 4, 20), currentHours: 890,   serviceIntervalHours: 200 },
    { name: "Backpack Sprayers",           type: "Spray Equipment",       category: "HANDHELD" as const, departmentId: dPest, quantity: 6,  brand: "Solo",         model: "425-D",             status: "ACTIVE" as const, purchasePriceCents:    45_000, purchaseDate: new Date(2022, 9, 1),  currentHours: 320,   serviceIntervalHours: 200 },
    { name: "Termite Monitoring Stations", type: "Monitoring Equipment",  category: "CUSTOM"   as const, departmentId: dPest, quantity: 50, brand: "Sentricon",    model: "AG Stations",       status: "ACTIVE" as const, purchasePriceCents:    12_000, purchaseDate: new Date(2022, 1, 1),  currentHours: 0,     serviceIntervalHours: 999 },
    { name: "Safety Respirators",          type: "PPE",                   category: "CUSTOM"   as const, departmentId: dPest, quantity: 8,  brand: "3M",           model: "6500 Series",       status: "ACTIVE" as const, purchasePriceCents:     9_500, purchaseDate: new Date(2023, 0, 1),  currentHours: 0,     serviceIntervalHours: 999 },
    // Land additions
    { name: "Plate Compactor",             type: "Compaction Equipment",  category: "CUSTOM"   as const, departmentId: dLand, quantity: 1,  brand: "Wacker",       model: "DPU6555Heh",        status: "ACTIVE" as const, purchasePriceCents:   380_000, purchaseDate: new Date(2021, 7, 14), currentHours: 1_240, serviceIntervalHours: 250 },
    { name: "Laser Level",                 type: "Survey Equipment",      category: "CUSTOM"   as const, departmentId: dLand, quantity: 2,  brand: "Spectra",      model: "LL500",             status: "ACTIVE" as const, purchasePriceCents:   125_000, purchaseDate: new Date(2022, 3, 1),  currentHours: 0,     serviceIntervalHours: 999 },
  ];

  let equippedAdded = 0;
  for (const eqRow of equipToAdd) {
    if (equippedNames.has(eqRow.name)) continue;
    const [row] = await db.insert(equipmentTable).values(eqRow).returning();
    if (row) {
      const slug = `equip-${row.id}-${slugify(row.name)}`;
      await db.update(equipmentTable).set({ slug }).where(eq(equipmentTable.id, row.id));
      equippedAdded++;
    }
  }
  console.log(`Added ${equippedAdded} equipment items`);

  console.log("Patch complete.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
