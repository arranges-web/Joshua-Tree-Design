/**
 * Idempotent demo-data backfill.
 *
 * Populates: 12 new customers with properties, 2 crews per service dept, 30+
 * jobs across all 4 departments, 20 quotes (6 APPROVED / 6 SENT / 5 DRAFT /
 * 3 REJECTED, every quote gets 2-4 line items), 19+ invoices spread over 6
 * months, 8 trucks, 23+ equipment items, 20+ maintenance logs, and 6 open
 * PORTAL service requests.
 *
 * Phase 2 (always runs): backfills 2 generic line items onto any existing
 * quote that has none, so autoSeed quotes are also covered.
 *
 * Guard (Phase 1 only): skips customer/job/fleet seeding when customers >= 22.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  customersTable,
  propertiesTable,
  crewsTable,
  crewMembersTable,
  jobsTable,
  quotesTable,
  quoteLineItemsTable,
  invoicesTable,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
  serviceRequestsTable,
  departmentsTable,
  usersTable,
} from "./schema";

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 86_400_000);
}
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

type LineItem = { quoteId: number; description: string; unitPriceCents: number; qty: number };

export async function backfillDemoData(): Promise<void> {
  // ── Phase 2 (always runs on every boot) ───────────────────────────────────
  // Backfill 2 generic line items onto any quote that currently has none.
  // Handles autoSeed.ts quotes on fresh installs without a manual patch script.
  // Runs before the Phase 1 guard so it executes even when customers >= 22.
  const orphanQuotes = await db.execute<{ id: number; total_cents: number }>(
    sql`SELECT q.id, q.total_cents
        FROM quotes q
        WHERE NOT EXISTS (
          SELECT 1 FROM quote_line_items li WHERE li.quote_id = q.id
        )
        ORDER BY q.id`,
  );
  if (orphanQuotes.rows.length > 0) {
    const orphanItems: LineItem[] = [];
    for (const row of orphanQuotes.rows) {
      const total = Number(row.total_cents);
      const labor = Math.round(total * 0.65);
      const materials = total - labor;
      orphanItems.push(
        { quoteId: row.id, description: "Labor & equipment",    unitPriceCents: labor,     qty: 1 },
        { quoteId: row.id, description: "Materials & disposal", unitPriceCents: materials, qty: 1 },
      );
    }
    await db.insert(quoteLineItemsTable).values(orphanItems);
  }

  // ── Phase 1 guard ─────────────────────────────────────────────────────────
  // Phase 1 inserts ~12 demo customers (brandon@example.com, …) plus
  // their properties, jobs, quotes, invoices, and per-dept crews. We
  // make it idempotent by checking for the first seeded customer
  // email — if it already exists, Phase 1 has run and we skip. The
  // legacy 22-customer count guard was insufficient because the
  // production demo on Replit was seeded before this file existed,
  // landed at exactly 22 customers (10 from autoSeed + 12 from this
  // script's first run on dev), and then permanently blocked any
  // future enrichment on the live deploy.
  const seedSentinel = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.email, "brandon@example.com"))
    .limit(1);
  if (seedSentinel.length > 0) return;

  // ── Resolve department & user IDs from live DB ────────────────────────────
  const depts = await db.select().from(departmentsTable);
  const deptId = (key: string) => depts.find((d) => d.key === key)?.id ?? null;
  const dLawn = deptId("Lawn")!;
  const dLand = deptId("Landscaping")!;
  const dTree = deptId("TreeService")!;
  const dPest = deptId("Pest")!;
  const dAdmin = deptId("Admin")!;

  const users = await db.select().from(usersTable);
  const uid = (email: string) => users.find((u) => u.email === email)?.id;
  const admin  = uid("admin@joshuatreeinc.test")!;
  const sales1 = uid("sales1@joshuatreeinc.test")!;
  const sales2 = uid("sales2@joshuatreeinc.test")!;
  const lead1  = uid("lead1@joshuatreeinc.test")!;
  const lead2  = uid("lead2@joshuatreeinc.test")!;
  const lead3  = uid("lead3@joshuatreeinc.test")!;
  const mech   = uid("mechanic@joshuatreeinc.test")!;

  // ── Fix existing crew dept assignments ────────────────────────────────────
  const existingCrews = await db.select().from(crewsTable);
  for (const c of existingCrews) {
    if (c.departmentId != null) continue;
    const lead = users.find((u) => u.id === c.leadUserId);
    if (lead?.departmentId) {
      await db
        .update(crewsTable)
        .set({ departmentId: lead.departmentId })
        .where(eq(crewsTable.id, c.id));
    }
  }

  // ── Ensure 2 crews per service department ─────────────────────────────────
  const afterFix = await db.select().from(crewsTable);
  const crewsByDept = (dId: number) =>
    afterFix.filter((c) => c.departmentId === dId);

  async function ensureCrew(
    name: string,
    leadUserId: number,
    departmentId: number,
    memberIds: number[],
  ): Promise<number> {
    const existing = crewsByDept(departmentId);
    if (existing.length >= 2) {
      return existing[existing.length - 1]!.id;
    }
    const [c] = await db
      .insert(crewsTable)
      .values({ name, leadUserId, departmentId })
      .returning();
    await db
      .insert(crewMembersTable)
      .values(memberIds.map((u) => ({ crewId: c!.id, userId: u })))
      .onConflictDoNothing();
    return c!.id;
  }

  const treeCrew1Id =
    crewsByDept(dTree)[0]?.id ??
    (await ensureCrew("Tree Crew 1", lead3, dTree, [lead3, admin]));
  const treeCrew2Id = await ensureCrew("Tree Crew 2", admin, dTree, [admin, lead1]);

  const landCrew1Id =
    crewsByDept(dLand)[0]?.id ??
    (await ensureCrew("Land Crew 1", lead1, dLand, [lead1, mech]));
  const landCrew2Id = await ensureCrew("Land Crew 2", lead2, dLand, [lead2, sales2]);

  const lawnCrew1Id =
    crewsByDept(dLawn)[0]?.id ??
    (await ensureCrew("Lawn Crew 1", sales1, dLawn, [sales1, lead2]));
  const lawnCrew2Id = await ensureCrew("Lawn Crew 2", sales2, dLawn, [sales2, lead3]);

  const pestCrew1Id =
    crewsByDept(dPest)[0]?.id ??
    (await ensureCrew("Pest Crew 1", mech, dPest, [mech, admin]));
  const pestCrew2Id = await ensureCrew("Pest Crew 2", admin, dPest, [admin, sales1]);

  // ── 12 new customers ──────────────────────────────────────────────────────
  const newCustomers = await db
    .insert(customersTable)
    .values([
      { fullName: "Brandon Bayside",  email: "brandon@example.com", phone: "(239) 555-0201", phoneE164: "+12395550201", billingAddress: "88 Bayside Dr, Naples, FL 34112",           ownerUserId: sales1 },
      { fullName: "Carol Coastline",  email: "carol@example.com",   phone: "(239) 555-0202", phoneE164: "+12395550202", billingAddress: "320 Gulf Shore Blvd, Naples, FL 34102",      ownerUserId: sales2 },
      { fullName: "Douglas Dunes",    email: "douglas@example.com", phone: "(239) 555-0203", phoneE164: "+12395550203", billingAddress: "15 Dune Dr, Sanibel, FL 33957",              ownerUserId: sales1 },
      { fullName: "Elaine Estates",   email: "elaine@example.com",  phone: "(239) 555-0204", phoneE164: "+12395550204", billingAddress: "740 Estate Blvd, Fort Myers, FL 33913",      ownerUserId: sales2 },
      { fullName: "Frank Farmland",   email: "frank@example.com",   phone: "(239) 555-0205", phoneE164: "+12395550205", billingAddress: "1100 County Rd 78, LaBelle, FL 33935",        ownerUserId: sales1 },
      { fullName: "Grace Greenway",   email: "grace@example.com",   phone: "(239) 555-0206", phoneE164: "+12395550206", billingAddress: "230 Greenway Ct, Estero, FL 33928",           ownerUserId: sales2 },
      { fullName: "Irving Inlet",     email: "irving@example.com",  phone: "(239) 555-0207", phoneE164: "+12395550207", billingAddress: "50 Inlet Shore Ln, Cape Coral, FL 33914",    ownerUserId: sales1 },
      { fullName: "Janet Junction",   email: "janet@example.com",   phone: "(239) 555-0208", phoneE164: "+12395550208", billingAddress: "901 Junction Ave, Fort Myers, FL 33901",      ownerUserId: sales2 },
      { fullName: "Kevin Keystone",   email: "kevin@example.com",   phone: "(239) 555-0209", phoneE164: "+12395550209", billingAddress: "4 Keystone Ct, Bonita Springs, FL 34135",     ownerUserId: sales1 },
      { fullName: "Laura Lakeside",   email: "laura@example.com",   phone: "(239) 555-0210", phoneE164: "+12395550210", billingAddress: "88 Lakeside Dr, Cape Coral, FL 33904",        ownerUserId: sales2 },
      { fullName: "Martin Marina",    email: "martin@example.com",  phone: "(239) 555-0211", phoneE164: "+12395550211", billingAddress: "175 Marina Blvd, Fort Myers Beach, FL 33931", ownerUserId: sales1 },
      { fullName: "Nancy Northgate",  email: "nancy@example.com",   phone: "(239) 555-0212", phoneE164: "+12395550212", billingAddress: "610 Northgate Dr, Naples, FL 34104",          ownerUserId: sales2 },
    ])
    .returning();

  const [brandon, carol, douglas, elaine, frank, grace, irving, janet, kevin, laura, martin, nancy] = newCustomers;

  // ── Properties for new customers ──────────────────────────────────────────
  const newProps = await db
    .insert(propertiesTable)
    .values([
      { customerId: brandon.id, address: "88 Bayside Dr",       city: "Naples",           zip: "34112" },
      { customerId: carol.id,   address: "320 Gulf Shore Blvd", city: "Naples",           zip: "34102" },
      { customerId: douglas.id, address: "15 Dune Dr",          city: "Sanibel",          zip: "33957" },
      { customerId: elaine.id,  address: "740 Estate Blvd",     city: "Fort Myers",       zip: "33913" },
      { customerId: frank.id,   address: "1100 County Rd 78",   city: "LaBelle",          zip: "33935" },
      { customerId: grace.id,   address: "230 Greenway Ct",     city: "Estero",           zip: "33928" },
      { customerId: irving.id,  address: "50 Inlet Shore Ln",   city: "Cape Coral",       zip: "33914" },
      { customerId: janet.id,   address: "901 Junction Ave",    city: "Fort Myers",       zip: "33901" },
      { customerId: kevin.id,   address: "4 Keystone Ct",       city: "Bonita Springs",   zip: "34135" },
      { customerId: laura.id,   address: "88 Lakeside Dr",      city: "Cape Coral",       zip: "33904" },
      { customerId: martin.id,  address: "175 Marina Blvd",     city: "Fort Myers Beach", zip: "33931" },
      { customerId: nancy.id,   address: "610 Northgate Dr",    city: "Naples",           zip: "34104" },
    ])
    .returning();
  const [bP, cP, dP, eP, fP, gP, iP, jP, kP, lP, mP, nP] = newProps;

  // ── Jobs (30+ across all 4 departments) ───────────────────────────────────
  const newJobs = await db
    .insert(jobsTable)
    .values([
      // TREE — scheduled
      { propertyId: bP.id, crewId: treeCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(4),  totalCents: 580_000, notes: "Large live oak removal — hurricane damage, 3 trees" },
      { propertyId: cP.id, crewId: treeCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(9),  totalCents: 195_000, notes: "Banyan trimming — overhangs pool cage" },
      { propertyId: dP.id, crewId: treeCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(16), totalCents: 145_000, notes: "Sabal palm trimming & fertilizing — 6 palms" },
      // TREE — complete (older dates for 6-month spread)
      { propertyId: bP.id, crewId: treeCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(12),  completedAt: daysAgo(11),  totalCents: 420_000, notes: "Laurel oak removal — root damage to pool deck" },
      { propertyId: cP.id, crewId: treeCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(45),  completedAt: daysAgo(44),  totalCents: 275_000, notes: "3 Australian pines removed — county ordinance" },
      { propertyId: dP.id, crewId: treeCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(90),  completedAt: daysAgo(89),  totalCents: 165_000, notes: "Storm cleanup — 5 large limbs over fence" },
      { propertyId: bP.id, crewId: treeCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(140), completedAt: daysAgo(139), totalCents: 310_000, notes: "Live oak canopy reduction — 2 trees" },
      { propertyId: cP.id, crewId: treeCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(175), completedAt: daysAgo(174), totalCents: 195_000, notes: "Royal palm trimming — 4 palms" },
      // LAND — scheduled
      { propertyId: eP.id, crewId: landCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(6),  totalCents: 890_000, notes: "Site grading — 1.2 acre commercial lot prep" },
      { propertyId: fP.id, crewId: landCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(11), totalCents: 340_000, notes: "Retention pond excavation — county spec" },
      { propertyId: gP.id, crewId: landCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(20), totalCents: 215_000, notes: "Property line grading + French drain" },
      // LAND — in progress
      { propertyId: eP.id, crewId: landCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(1), totalCents: 480_000, notes: "Sod installation — 12,000 sq ft Bahia grass" },
      // LAND — complete
      { propertyId: fP.id, crewId: landCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(18),  completedAt: daysAgo(17),  totalCents: 620_000, notes: "Land clearing — 2 acres for new construction" },
      { propertyId: gP.id, crewId: landCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(55),  completedAt: daysAgo(54),  totalCents: 295_000, notes: "Retaining wall construction — 80 linear ft" },
      { propertyId: eP.id, crewId: landCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(95),  completedAt: daysAgo(94),  totalCents: 185_000, notes: "Driveway base prep — grading + compaction" },
      { propertyId: fP.id, crewId: landCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(148), completedAt: daysAgo(147), totalCents: 540_000, notes: "Full property re-grading — drainage correction" },
      { propertyId: gP.id, crewId: landCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(172), completedAt: daysAgo(171), totalCents: 260_000, notes: "Erosion control & seed blanket" },
      // LAWN — scheduled
      { propertyId: iP.id, crewId: lawnCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(2),  totalCents:  58_000, notes: "Bi-weekly lawn maintenance — mow, edge, blow" },
      { propertyId: jP.id, crewId: lawnCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(7),  totalCents: 145_000, notes: "Sod replacement — 3,500 sq ft St. Augustine" },
      { propertyId: kP.id, crewId: lawnCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(13), totalCents:  75_000, notes: "Lawn aeration + overseeding" },
      // LAWN — in progress
      { propertyId: iP.id, crewId: lawnCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(0), totalCents:  92_000, notes: "Fertilization treatment — 4-step program first application" },
      // LAWN — complete
      { propertyId: jP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(8),   completedAt: daysAgo(7),   totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      { propertyId: kP.id, crewId: lawnCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(22),  completedAt: daysAgo(21),  totalCents: 115_000, notes: "Mulch refresh — 8 yards cypress mulch, beds edged" },
      { propertyId: iP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(38),  completedAt: daysAgo(37),  totalCents:  68_000, notes: "Weed control + pre-emergent application" },
      { propertyId: jP.id, crewId: lawnCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(65),  completedAt: daysAgo(64),  totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      { propertyId: kP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(95),  completedAt: daysAgo(94),  totalCents: 195_000, notes: "Full lawn renovation — dead turf removed, resodded" },
      { propertyId: iP.id, crewId: lawnCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(140), completedAt: daysAgo(139), totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      { propertyId: jP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(168), completedAt: daysAgo(167), totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      // PEST — scheduled
      { propertyId: lP.id, crewId: pestCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(3),  totalCents:  48_000, notes: "Quarterly pest control — interior + exterior perimeter" },
      { propertyId: mP.id, crewId: pestCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(8),  totalCents:  65_000, notes: "Termite inspection + spot treatment" },
      { propertyId: nP.id, crewId: pestCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(15), totalCents:  38_000, notes: "Fire ant treatment — 1/2 acre property" },
      // PEST — in progress
      { propertyId: lP.id, crewId: pestCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(0), totalCents:  82_000, notes: "Rodent exclusion + bait station install" },
      // PEST — complete
      { propertyId: mP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(6),   completedAt: daysAgo(5),   totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: nP.id, crewId: pestCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(28),  completedAt: daysAgo(27),  totalCents:  95_000, notes: "Drywood termite tenting — whole structure" },
      { propertyId: lP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(50),  completedAt: daysAgo(49),  totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: mP.id, crewId: pestCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(78),  completedAt: daysAgo(77),  totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: nP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(138), completedAt: daysAgo(137), totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: lP.id, crewId: pestCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(168), completedAt: daysAgo(167), totalCents:  48_000, notes: "Quarterly pest control" },
    ])
    .returning();

  // ── Quotes — 20 total, all statuses, 2-4 line items each ─────────────────
  const newQuotes = await db
    .insert(quotesTable)
    .values([
      // APPROVED (6)
      { customerId: brandon.id, propertyId: bP.id, ownerUserId: sales1, status: "APPROVED", subtotalCents:  580_000, totalCents:  620_600 },
      { customerId: elaine.id,  propertyId: eP.id, ownerUserId: sales2, status: "APPROVED", subtotalCents:  480_000, totalCents:  513_600 },
      { customerId: irving.id,  propertyId: iP.id, ownerUserId: sales1, status: "APPROVED", subtotalCents:   92_000, totalCents:   98_440 },
      { customerId: laura.id,   propertyId: lP.id, ownerUserId: sales2, status: "APPROVED", subtotalCents:   82_000, totalCents:   87_740 },
      { customerId: kevin.id,   propertyId: kP.id, ownerUserId: sales1, status: "APPROVED", subtotalCents:  195_000, totalCents:  208_650 },
      { customerId: grace.id,   propertyId: gP.id, ownerUserId: sales2, status: "APPROVED", subtotalCents:  260_000, totalCents:  278_200 },
      // SENT (6)
      { customerId: carol.id,   propertyId: cP.id, ownerUserId: sales1, status: "SENT", subtotalCents:  195_000, totalCents:  208_650 },
      { customerId: frank.id,   propertyId: fP.id, ownerUserId: sales2, status: "SENT", subtotalCents:  340_000, totalCents:  363_800 },
      { customerId: janet.id,   propertyId: jP.id, ownerUserId: sales1, status: "SENT", subtotalCents:  145_000, totalCents:  155_150 },
      { customerId: martin.id,  propertyId: mP.id, ownerUserId: sales2, status: "SENT", subtotalCents:   65_000, totalCents:   69_550 },
      { customerId: douglas.id, propertyId: dP.id, ownerUserId: sales1, status: "SENT", subtotalCents:  215_000, totalCents:  230_050 },
      { customerId: nancy.id,   propertyId: nP.id, ownerUserId: sales2, status: "SENT", subtotalCents:   48_000, totalCents:   51_360 },
      // DRAFT (5)
      { customerId: brandon.id, propertyId: bP.id, ownerUserId: sales2, status: "DRAFT", subtotalCents:  145_000, totalCents:  155_150 },
      { customerId: carol.id,   propertyId: cP.id, ownerUserId: sales1, status: "DRAFT", subtotalCents:   95_000, totalCents:  101_650 },
      { customerId: elaine.id,  propertyId: eP.id, ownerUserId: sales2, status: "DRAFT", subtotalCents:  890_000, totalCents:  952_300 },
      { customerId: frank.id,   propertyId: fP.id, ownerUserId: sales1, status: "DRAFT", subtotalCents:  115_000, totalCents:  123_050 },
      { customerId: irving.id,  propertyId: iP.id, ownerUserId: sales2, status: "DRAFT", subtotalCents:   75_000, totalCents:   80_250 },
      // REJECTED (3) — lost bids
      { customerId: janet.id,   propertyId: jP.id, ownerUserId: sales2, status: "REJECTED", subtotalCents:  720_000, totalCents:  770_400 },
      { customerId: grace.id,   propertyId: gP.id, ownerUserId: sales1, status: "REJECTED", subtotalCents:  950_000, totalCents: 1_016_500 },
      { customerId: martin.id,  propertyId: mP.id, ownerUserId: sales2, status: "REJECTED", subtotalCents:  130_000, totalCents:  139_100 },
    ])
    .returning();

  const allLineItems: LineItem[] = [];

  const addLines = (qIdx: number, items: Omit<LineItem, "quoteId">[]) => {
    const q = newQuotes[qIdx];
    if (!q) return;
    items.forEach((item) => allLineItems.push({ quoteId: q.id, ...item }));
  };

  // APPROVED (6) — 2-4 line items each
  addLines(0, [  // brandon — tree removal
    { description: "Live oak removal — hurricane-damaged (ea)", unitPriceCents: 160_000, qty: 3 },
    { description: "Stump grinding (ea)",                       unitPriceCents:  35_000, qty: 2 },
    { description: "Debris haul-off & disposal",                unitPriceCents:  40_000, qty: 1 },
  ]);
  addLines(1, [  // elaine — sod install
    { description: "Sod installation — Bahia (sq ft)",          unitPriceCents:      75, qty: 6_400 },
    { description: "Soil amendment & prep",                     unitPriceCents:  36_000, qty: 1 },
    { description: "Irrigation adjustment",                     unitPriceCents:  12_000, qty: 1 },
  ]);
  addLines(2, [  // irving — lawn care
    { description: "Fertilization treatment — 4-step program",  unitPriceCents:  65_000, qty: 1 },
    { description: "Bi-weekly maintenance service",             unitPriceCents:  27_000, qty: 1 },
  ]);
  addLines(3, [  // laura — pest
    { description: "Rodent exclusion — seal entry points",      unitPriceCents:  52_000, qty: 1 },
    { description: "Bait station installation (ea)",            unitPriceCents:   5_000, qty: 6 },
  ]);
  addLines(4, [  // kevin — lawn renovation
    { description: "Full lawn renovation — dead turf removal",  unitPriceCents:  85_000, qty: 1 },
    { description: "St. Augustine sod install (sq ft)",         unitPriceCents:      90, qty: 1_200 },
  ]);
  addLines(5, [  // grace — land retaining wall
    { description: "Retaining wall — keystone block (linear ft)", unitPriceCents: 2_200, qty: 80 },
    { description: "Drainage swale behind wall",                unitPriceCents:  36_000, qty: 1 },
    { description: "Soil backfill & compaction",                unitPriceCents:  48_000, qty: 1 },
  ]);

  // SENT (6) — 2-4 line items each
  addLines(6, [  // carol — banyan trimming
    { description: "Banyan trimming — pool cage overhang",      unitPriceCents: 145_000, qty: 1 },
    { description: "Debris removal & haul-off",                 unitPriceCents:  50_000, qty: 1 },
  ]);
  addLines(7, [  // frank — retention pond
    { description: "Retention pond excavation",                 unitPriceCents: 280_000, qty: 1 },
    { description: "County spec survey & staking",              unitPriceCents:  35_000, qty: 1 },
    { description: "Erosion control matting",                   unitPriceCents:  25_000, qty: 1 },
  ]);
  addLines(8, [  // janet — sod replacement
    { description: "St. Augustine sod replacement (sq ft)",     unitPriceCents:      90, qty: 3_500 },
    { description: "Soil prep & fine grade",                    unitPriceCents:  30_000, qty: 1 },
  ]);
  addLines(9, [  // martin — termite
    { description: "Termite inspection — full structure",       unitPriceCents:  35_000, qty: 1 },
    { description: "Spot treatment — active areas (ea)",        unitPriceCents:  10_000, qty: 3 },
  ]);
  addLines(10, [ // douglas — palm trimming + French drain
    { description: "Sabal palm trimming (ea)",                  unitPriceCents:  20_000, qty: 6 },
    { description: "Fertilization boot treatment (ea)",         unitPriceCents:   4_000, qty: 6 },
    { description: "Mulch refresh — 4 yards",                   unitPriceCents:  31_000, qty: 1 },
  ]);
  addLines(11, [ // nancy — quarterly pest
    { description: "Quarterly pest control — interior",         unitPriceCents:  28_000, qty: 1 },
    { description: "Exterior perimeter treatment",              unitPriceCents:  20_000, qty: 1 },
  ]);

  // DRAFT (5) — 2-3 line items each
  addLines(12, [ // brandon — stump grinding
    { description: "Stump grinding — 4 stumps",                 unitPriceCents:  35_000, qty: 4 },
    { description: "Surface root grinding",                     unitPriceCents:   5_000, qty: 1 },
  ]);
  addLines(13, [ // carol — drywood termite tenting
    { description: "Drywood termite tenting — full structure",  unitPriceCents:  75_000, qty: 1 },
    { description: "Contents protection wrap",                  unitPriceCents:  20_000, qty: 1 },
  ]);
  addLines(14, [ // elaine — commercial lot grading
    { description: "Commercial site grading — 1.2 acres",       unitPriceCents: 650_000, qty: 1 },
    { description: "Drainage swale installation",               unitPriceCents: 180_000, qty: 1 },
    { description: "Compaction testing & report",               unitPriceCents:  60_000, qty: 1 },
  ]);
  addLines(15, [ // frank — French drain
    { description: "French drain installation (linear ft)",     unitPriceCents:     700, qty: 120 },
    { description: "Catch basin — precast (ea)",                unitPriceCents:  15_000, qty: 3 },
    { description: "Outfall pipe to retention",                 unitPriceCents:  27_000, qty: 1 },
  ]);
  addLines(16, [ // irving — lawn aeration
    { description: "Lawn aeration — 8,000 sq ft",               unitPriceCents:  35_000, qty: 1 },
    { description: "Overseeding — Bermuda blend",               unitPriceCents:  40_000, qty: 1 },
  ]);

  // REJECTED (3) — 2-3 line items each
  addLines(17, [ // janet — full property tree removal (lost bid)
    { description: "Full property tree removal — 8 trees",      unitPriceCents:  80_000, qty: 8 },
    { description: "Stump grinding (ea)",                       unitPriceCents:  35_000, qty: 8 },
    { description: "Lot clearing & debris haul",                unitPriceCents:  80_000, qty: 1 },
  ]);
  addLines(18, [ // grace — large commercial grading (lost bid)
    { description: "Commercial lot grading — 2 acres",          unitPriceCents: 650_000, qty: 1 },
    { description: "Retention pond excavation",                 unitPriceCents: 180_000, qty: 1 },
    { description: "Compaction testing & certification",        unitPriceCents: 120_000, qty: 1 },
  ]);
  addLines(19, [ // martin — premium pest plan (lost bid)
    { description: "Annual pest protection plan",               unitPriceCents:  85_000, qty: 1 },
    { description: "Termite bait system — 12 stations",         unitPriceCents:  45_000, qty: 1 },
  ]);

  if (allLineItems.length > 0) {
    await db.insert(quoteLineItemsTable).values(allLineItems);
  }

  // ── Invoices — spread over 6 months ──────────────────────────────────────
  const completedTree = newJobs.filter(
    (j) => j.status === "COMPLETE" && (j.crewId === treeCrew1Id || j.crewId === treeCrew2Id),
  );
  const completedLand = newJobs.filter(
    (j) => j.status === "COMPLETE" && (j.crewId === landCrew1Id || j.crewId === landCrew2Id),
  );
  const completedLawn = newJobs.filter(
    (j) => j.status === "COMPLETE" && (j.crewId === lawnCrew1Id || j.crewId === lawnCrew2Id),
  );
  const completedPest = newJobs.filter(
    (j) => j.status === "COMPLETE" && (j.crewId === pestCrew1Id || j.crewId === pestCrew2Id),
  );

  type InvRow = {
    jobId?: number; customerId: number;
    status: "PAID" | "SENT" | "OVERDUE" | "DRAFT";
    totalCents: number; issuedAt: Date; paidAt?: Date;
  };
  const invoiceRows: InvRow[] = [];

  // Tree — 5 invoices spanning 6 months
  if (completedTree[0]) invoiceRows.push({ jobId: completedTree[0].id, customerId: brandon.id, status: "PAID",    totalCents: 420_000, issuedAt: daysAgo(10),  paidAt: daysAgo(5)   });
  if (completedTree[1]) invoiceRows.push({ jobId: completedTree[1].id, customerId: carol.id,   status: "PAID",    totalCents: 275_000, issuedAt: daysAgo(43),  paidAt: daysAgo(35)  });
  if (completedTree[2]) invoiceRows.push({ jobId: completedTree[2].id, customerId: douglas.id, status: "PAID",    totalCents: 165_000, issuedAt: daysAgo(88),  paidAt: daysAgo(78)  });
  if (completedTree[3]) invoiceRows.push({ jobId: completedTree[3].id, customerId: brandon.id, status: "PAID",    totalCents: 310_000, issuedAt: daysAgo(138), paidAt: daysAgo(128) });
  if (completedTree[4]) invoiceRows.push({ jobId: completedTree[4].id, customerId: carol.id,   status: "PAID",    totalCents: 195_000, issuedAt: daysAgo(173), paidAt: daysAgo(162) });

  // Land — 5 invoices
  if (completedLand[0]) invoiceRows.push({ jobId: completedLand[0].id, customerId: elaine.id,  status: "PAID",    totalCents: 480_000, issuedAt: daysAgo(16),  paidAt: daysAgo(8)   });
  if (completedLand[1]) invoiceRows.push({ jobId: completedLand[1].id, customerId: frank.id,   status: "PAID",    totalCents: 620_000, issuedAt: daysAgo(53),  paidAt: daysAgo(42)  });
  if (completedLand[2]) invoiceRows.push({ jobId: completedLand[2].id, customerId: grace.id,   status: "OVERDUE", totalCents: 295_000, issuedAt: daysAgo(93)                        });
  if (completedLand[3]) invoiceRows.push({ jobId: completedLand[3].id, customerId: elaine.id,  status: "PAID",    totalCents: 540_000, issuedAt: daysAgo(145), paidAt: daysAgo(134) });
  if (completedLand[4]) invoiceRows.push({ jobId: completedLand[4].id, customerId: frank.id,   status: "PAID",    totalCents: 260_000, issuedAt: daysAgo(170), paidAt: daysAgo(158) });

  // Lawn — 6 invoices
  if (completedLawn[0]) invoiceRows.push({ jobId: completedLawn[0].id, customerId: janet.id,   status: "PAID",    totalCents:  58_000, issuedAt: daysAgo(6),   paidAt: daysAgo(3)   });
  if (completedLawn[1]) invoiceRows.push({ jobId: completedLawn[1].id, customerId: kevin.id,   status: "PAID",    totalCents: 115_000, issuedAt: daysAgo(20),  paidAt: daysAgo(14)  });
  if (completedLawn[2]) invoiceRows.push({ jobId: completedLawn[2].id, customerId: irving.id,  status: "PAID",    totalCents:  68_000, issuedAt: daysAgo(36),  paidAt: daysAgo(28)  });
  if (completedLawn[3]) invoiceRows.push({ jobId: completedLawn[3].id, customerId: janet.id,   status: "SENT",    totalCents:  58_000, issuedAt: daysAgo(63)                        });
  if (completedLawn[4]) invoiceRows.push({ jobId: completedLawn[4].id, customerId: kevin.id,   status: "PAID",    totalCents: 195_000, issuedAt: daysAgo(140), paidAt: daysAgo(130) });
  if (completedLawn[5]) invoiceRows.push({ jobId: completedLawn[5].id, customerId: irving.id,  status: "PAID",    totalCents:  58_000, issuedAt: daysAgo(167), paidAt: daysAgo(157) });

  // Pest — 6 invoices (recurring quarterly pattern)
  if (completedPest[0]) invoiceRows.push({ jobId: completedPest[0].id, customerId: martin.id,  status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(4),   paidAt: daysAgo(2)   });
  if (completedPest[1]) invoiceRows.push({ jobId: completedPest[1].id, customerId: nancy.id,   status: "PAID",    totalCents:  95_000, issuedAt: daysAgo(26),  paidAt: daysAgo(20)  });
  if (completedPest[2]) invoiceRows.push({ jobId: completedPest[2].id, customerId: laura.id,   status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(48),  paidAt: daysAgo(41)  });
  if (completedPest[3]) invoiceRows.push({ jobId: completedPest[3].id, customerId: martin.id,  status: "OVERDUE", totalCents:  48_000, issuedAt: daysAgo(76)                        });
  if (completedPest[4]) invoiceRows.push({ jobId: completedPest[4].id, customerId: nancy.id,   status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(136), paidAt: daysAgo(128) });
  if (completedPest[5]) invoiceRows.push({ jobId: completedPest[5].id, customerId: laura.id,   status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(166), paidAt: daysAgo(158) });

  if (invoiceRows.length > 0) {
    await db.insert(invoicesTable).values(invoiceRows);
  }

  // ── Equipment — explicit per department ──────────────────────────────────
  const existingEquip = await db
    .select({ name: equipmentTable.name })
    .from(equipmentTable);
  const equippedNames = new Set(existingEquip.map((e) => e.name));

  const equipToAdd = [
    // Lawn dept
    { name: "Exmark Lazer Z Mower",       type: "Zero-Turn Mower",   category: "CUSTOM"   as const, departmentId: dLawn, quantity: 2, brand: "Exmark",      model: "Lazer Z X-Series", status: "ACTIVE"  as const, purchasePriceCents: 1_200_000, purchaseDate: new Date(2023, 2, 10), currentHours: 620, serviceIntervalHours: 200 },
    { name: "String Trimmers",             type: "Trimmer",           category: "HANDHELD" as const, departmentId: dLawn, quantity: 6, brand: "STIHL",       model: "FS 131",           status: "ACTIVE"  as const, purchasePriceCents:   65_000,    purchaseDate: new Date(2023, 6, 1),  currentHours: 280, serviceIntervalHours: 100 },
    { name: "Backpack Blowers",            type: "Blower",            category: "HANDHELD" as const, departmentId: dLawn, quantity: 4, brand: "RedMax",      model: "EBZ8550",          status: "ACTIVE"  as const, purchasePriceCents:   58_000,    purchaseDate: new Date(2023, 6, 1),  currentHours: 240, serviceIntervalHours: 100 },
    { name: "Lawn Spreader",               type: "Fertilizer Spreader", category: "HANDHELD" as const, departmentId: dLawn, quantity: 3, brand: "LESCO",    model: "HD 80 lb",         status: "ACTIVE"  as const, purchasePriceCents:   35_000,    purchaseDate: new Date(2022, 9, 15), currentHours: 0,   serviceIntervalHours: 500 },
    // Pest dept
    { name: "Ride-On Sprayer",             type: "Spray Equipment",   category: "CUSTOM"   as const, departmentId: dPest, quantity: 1, brand: "Perma-Green", model: "Triumph",         status: "ACTIVE"  as const, purchasePriceCents:  980_000,    purchaseDate: new Date(2022, 4, 20), currentHours: 890, serviceIntervalHours: 200 },
    { name: "Backpack Sprayers",           type: "Spray Equipment",   category: "HANDHELD" as const, departmentId: dPest, quantity: 6, brand: "Solo",        model: "425-D",            status: "ACTIVE"  as const, purchasePriceCents:   45_000,    purchaseDate: new Date(2022, 9, 1),  currentHours: 320, serviceIntervalHours: 200 },
    { name: "Termite Monitoring Stations", type: "Monitoring Equipment", category: "CUSTOM" as const, departmentId: dPest, quantity: 50, brand: "Sentricon", model: "AG Stations",     status: "ACTIVE"  as const, purchasePriceCents:   12_000,    purchaseDate: new Date(2022, 1, 1),  currentHours: 0,   serviceIntervalHours: 999 },
    { name: "Safety Respirators",          type: "PPE",               category: "CUSTOM"   as const, departmentId: dPest, quantity: 8, brand: "3M",          model: "6500 Series",      status: "ACTIVE"  as const, purchasePriceCents:    9_500,    purchaseDate: new Date(2023, 0, 1),  currentHours: 0,   serviceIntervalHours: 999 },
    // Land dept additions
    { name: "Plate Compactor",             type: "Compaction Equipment", category: "CUSTOM" as const, departmentId: dLand, quantity: 1, brand: "Wacker",    model: "DPU6555Heh",       status: "ACTIVE"  as const, purchasePriceCents:  380_000,    purchaseDate: new Date(2021, 7, 14), currentHours: 1_240, serviceIntervalHours: 250 },
    { name: "Laser Level",                 type: "Survey Equipment",  category: "CUSTOM"   as const, departmentId: dLand, quantity: 2, brand: "Spectra",    model: "LL500",            status: "ACTIVE"  as const, purchasePriceCents:  125_000,    purchaseDate: new Date(2022, 3, 1),  currentHours: 0,   serviceIntervalHours: 999 },
  ];

  for (const eqRow of equipToAdd) {
    if (equippedNames.has(eqRow.name)) continue;
    const [row] = await db.insert(equipmentTable).values(eqRow).returning();
    if (row) {
      const slug = `equip-${row.id}-${slugify(row.name)}`;
      await db.update(equipmentTable).set({ slug }).where(eq(equipmentTable.id, row.id));
    }
  }

  // ── 3 trucks ──────────────────────────────────────────────────────────────
  const existingTrucks = await db
    .select({ name: trucksTable.name })
    .from(trucksTable);
  const truckNames = new Set(existingTrucks.map((t) => t.name));

  const trucksToAdd = [
    { name: "T-06 Lawn Service Truck", brand: "Ford",  model: "F-250 Super Duty",  vin: "1FT7W2BT0PED00001", plate: "JTREE-6", status: "ACTIVE" as const, departmentId: dLawn, purchasePriceCents: 5_800_000, purchaseDate: new Date(2023, 4, 20), currentMileage: 28_450, serviceIntervalMiles: 5_000 },
    { name: "T-07 Pest Control Van",   brand: "Ford",  model: "Transit 250 Cargo", vin: "1FTBR1Y83PkB00002", plate: "JTREE-7", status: "ACTIVE" as const, departmentId: dPest, purchasePriceCents: 4_200_000, purchaseDate: new Date(2022, 8, 14), currentMileage: 61_230, serviceIntervalMiles: 5_000 },
    { name: "T-08 Land Loader",        brand: "Isuzu", model: "NPR-HD Flatbed",    vin: "JALC4W16XP7000003", plate: "JTREE-8", status: "ACTIVE" as const, departmentId: dLand, purchasePriceCents: 6_650_000, purchaseDate: new Date(2021, 11, 3),  currentMileage: 88_620, serviceIntervalMiles: 7_500 },
  ];

  for (const t of trucksToAdd) {
    if (truckNames.has(t.name)) continue;
    const [row] = await db.insert(trucksTable).values(t).returning();
    if (row) {
      const slug = `truck-${row.id}-${slugify(row.name)}`;
      await db.update(trucksTable).set({ slug }).where(eq(trucksTable.id, row.id));
    }
  }

  // ── Maintenance logs ──────────────────────────────────────────────────────
  const allTrucks = await db
    .select({ id: trucksTable.id, name: trucksTable.name, currentMileage: trucksTable.currentMileage })
    .from(trucksTable);
  const truckByName = new Map(allTrucks.map((t) => [t.name, t]));

  type LogRow = {
    truckId?: number; equipmentId?: number;
    kind: "SCHEDULED" | "REPAIR" | "INSPECTION";
    description: string; performedAt: Date;
    performedByUserId?: number;
    laborCostCents: number; partsCostCents: number; costCents: number;
    mileageAtService?: number;
  };
  const newMaintLogs: LogRow[] = [];

  const addTruckLogs = (
    truckName: string,
    logs: Array<{ kind: "SCHEDULED" | "REPAIR" | "INSPECTION"; desc: string; daysBack: number; labor: number; parts: number; milesBack: number }>,
  ) => {
    const t = truckByName.get(truckName);
    if (!t) return;
    for (const l of logs) {
      newMaintLogs.push({ truckId: t.id, kind: l.kind, description: l.desc, performedAt: daysAgo(l.daysBack), performedByUserId: mech, laborCostCents: l.labor, partsCostCents: l.parts, costCents: l.labor + l.parts, mileageAtService: Math.max(0, t.currentMileage - l.milesBack) });
    }
  };

  addTruckLogs("T-01 Bucket Truck", [
    { kind: "SCHEDULED",  desc: "Oil change, air filter, tire rotation",    daysBack: 14, labor: 12_000, parts: 6_500,  milesBack: 800   },
    { kind: "INSPECTION", desc: "Pre-season inspection — boom, hydraulics", daysBack: 45, labor: 18_000, parts: 0,      milesBack: 3_200 },
    { kind: "REPAIR",     desc: "Hydraulic hose replacement — cab boom",    daysBack: 72, labor: 28_000, parts: 14_500, milesBack: 5_100 },
  ]);
  addTruckLogs("T-02 Chip Truck", [
    { kind: "REPAIR",     desc: "Engine oil leak — rear main seal",         daysBack: 8,  labor: 42_000, parts: 18_000, milesBack: 200   },
    { kind: "SCHEDULED",  desc: "Full fluid service + belts",               daysBack: 62, labor: 22_000, parts: 12_000, milesBack: 4_800 },
  ]);
  addTruckLogs("T-03 Crane Truck", [
    { kind: "SCHEDULED",  desc: "Oil, coolant flush, brake inspection",     daysBack: 22, labor: 16_000, parts: 8_200,  milesBack: 1_400 },
    { kind: "INSPECTION", desc: "Annual crane certification inspection",    daysBack: 55, labor: 35_000, parts: 0,      milesBack: 3_800 },
    { kind: "REPAIR",     desc: "Outrigger pad replacement",                daysBack: 80, labor: 20_000, parts: 11_000, milesBack: 5_600 },
  ]);
  addTruckLogs("T-04 Stump Truck", [
    { kind: "SCHEDULED",  desc: "Oil change, tire check",                   daysBack: 30, labor: 10_000, parts: 5_500,  milesBack: 2_000 },
    { kind: "INSPECTION", desc: "PTO and stump cutter mounting check",      daysBack: 68, labor: 12_000, parts: 0,      milesBack: 4_000 },
  ]);
  addTruckLogs("T-06 Lawn Service Truck", [
    { kind: "SCHEDULED",  desc: "First-year service — oil, filter, fluids", daysBack: 18, labor: 9_500,  parts: 4_800,  milesBack: 900   },
  ]);
  addTruckLogs("T-07 Pest Control Van", [
    { kind: "SCHEDULED",  desc: "Oil change, AC service, tire rotation",    daysBack: 25, labor: 11_000, parts: 5_200,  milesBack: 1_600 },
    { kind: "REPAIR",     desc: "Spray pump pressure regulator replaced",   daysBack: 50, labor: 14_000, parts: 8_500,  milesBack: 3_200 },
  ]);
  addTruckLogs("T-08 Land Loader", [
    { kind: "SCHEDULED",  desc: "Transmission service + differential",      daysBack: 35, labor: 24_000, parts: 13_000, milesBack: 3_500 },
    { kind: "INSPECTION", desc: "Annual DOT inspection",                    daysBack: 60, labor: 15_000, parts: 0,      milesBack: 5_200 },
    { kind: "REPAIR",     desc: "Brake drums + pads — front axle",          daysBack: 85, labor: 32_000, parts: 19_500, milesBack: 7_000 },
  ]);

  if (newMaintLogs.length > 0) {
    await db.insert(maintenanceLogsTable).values(newMaintLogs);
  }

  // ── Service requests — 6 open PORTAL requests from new customers ──────────
  // service_type enum is tree-focused; other depts use the same types.
  // All set to NEW (open) so the Leads page has a healthy queue.
  await db.insert(serviceRequestsTable).values([
    {
      customerId: brandon.id, propertyId: bP.id,
      service: "TREE_REMOVAL", status: "NEW", source: "PORTAL",
      notes: "3 large live oaks after Hurricane Ian — need removal + stump grinding",
      preferredWindowStart: daysFromNow(5), preferredWindowEnd: daysFromNow(12),
    },
    {
      customerId: carol.id, propertyId: cP.id,
      service: "TRIMMING_PRUNING", status: "NEW", source: "PORTAL",
      notes: "Banyan overhanging pool cage, needs heavy pruning",
      preferredWindowStart: daysFromNow(7), preferredWindowEnd: daysFromNow(14),
    },
    {
      customerId: douglas.id, propertyId: dP.id,
      service: "TRIMMING_PRUNING", status: "NEW", source: "PORTAL",
      notes: "6 sabal palms need annual trimming and boot cleaning",
      preferredWindowStart: daysFromNow(10), preferredWindowEnd: daysFromNow(20),
    },
    {
      customerId: irving.id, propertyId: iP.id,
      service: "STUMP_GRINDING", status: "NEW", source: "PORTAL",
      notes: "4 stumps left from prior removal, need grinding before sod install",
      preferredWindowStart: daysFromNow(3), preferredWindowEnd: daysFromNow(8),
    },
    {
      customerId: martin.id, propertyId: mP.id,
      service: "EMERGENCY_STORM", status: "NEW", source: "PORTAL",
      notes: "Large laurel oak limb over garage roof — needs emergency removal",
      preferredWindowStart: daysFromNow(1), preferredWindowEnd: daysFromNow(3),
    },
    {
      customerId: nancy.id, propertyId: nP.id,
      service: "CRANE_ASSISTED", status: "NEW", source: "PORTAL",
      notes: "Cluster of tall royal palms near power lines — crane required",
      preferredWindowStart: daysFromNow(14), preferredWindowEnd: daysFromNow(21),
    },
  ]);
}
