/**
 * Idempotent demo-data backfill.
 *
 * Adds realistic SW-Florida customers, Lawn/Land/Pest/Tree jobs, quotes,
 * invoices spread over 6 months, crews per department, extra trucks, and
 * maintenance logs so every page of the admin console looks fully populated
 * during a live demo walkthrough.
 *
 * Guard: skips entirely when the customers table already has 22+ rows,
 * meaning a prior run succeeded. Safe to call on every server boot.
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
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 60);
}

export async function backfillDemoData(): Promise<void> {
  // ── Guard ─────────────────────────────────────────────────────────────────
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customersTable);
  if (n >= 22) return; // already seeded

  // ── Resolve IDs from the live DB ──────────────────────────────────────────
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
  const lead1  = uid("lead1@joshuatreeinc.test")!;   // Land dept
  const lead2  = uid("lead2@joshuatreeinc.test")!;   // Land dept
  const lead3  = uid("lead3@joshuatreeinc.test")!;   // Tree dept
  const mech   = uid("mechanic@joshuatreeinc.test")!;// Pest dept

  // ── Fix existing crew department assignments ───────────────────────────────
  // Crews seeded by autoSeed have null department_id; backfill them so the
  // accounting department attribution chain works.
  const existingCrews = await db.select().from(crewsTable);
  for (const c of existingCrews) {
    if (c.departmentId != null) continue;
    const lead = users.find((u) => u.id === c.leadUserId);
    if (lead?.departmentId) {
      await db.update(crewsTable).set({ departmentId: lead.departmentId }).where(eq(crewsTable.id, c.id));
    }
  }

  // ── Ensure 2 crews per service department ─────────────────────────────────
  const afterFix = await db.select().from(crewsTable);
  const crewsByDept = (dId: number) => afterFix.filter((c) => c.departmentId === dId);

  // Tree dept: need 2 crews
  let treeCrew1Id: number, treeCrew2Id: number;
  const treeCrews = crewsByDept(dTree);
  if (treeCrews[0]) {
    treeCrew1Id = treeCrews[0].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Tree Crew 1", leadUserId: lead3, departmentId: dTree }).returning();
    treeCrew1Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: lead3 }, { crewId: c.id, userId: admin }]).onConflictDoNothing();
  }
  if (treeCrews[1]) {
    treeCrew2Id = treeCrews[1].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Tree Crew 2", leadUserId: admin, departmentId: dTree }).returning();
    treeCrew2Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: admin }, { crewId: c.id, userId: lead1 }]).onConflictDoNothing();
  }

  // Land dept: need 2 crews
  let landCrew1Id: number, landCrew2Id: number;
  const landCrews = crewsByDept(dLand);
  if (landCrews[0]) {
    landCrew1Id = landCrews[0].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Land Crew 1", leadUserId: lead1, departmentId: dLand }).returning();
    landCrew1Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: lead1 }, { crewId: c.id, userId: mech }]).onConflictDoNothing();
  }
  if (landCrews[1]) {
    landCrew2Id = landCrews[1].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Land Crew 2", leadUserId: lead2, departmentId: dLand }).returning();
    landCrew2Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: lead2 }, { crewId: c.id, userId: sales2 }]).onConflictDoNothing();
  }

  // Lawn dept: need 2 crews
  let lawnCrew1Id: number, lawnCrew2Id: number;
  const lawnCrews = crewsByDept(dLawn);
  if (lawnCrews[0]) {
    lawnCrew1Id = lawnCrews[0].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Lawn Crew 1", leadUserId: sales1, departmentId: dLawn }).returning();
    lawnCrew1Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: sales1 }, { crewId: c.id, userId: lead2 }]).onConflictDoNothing();
  }
  if (lawnCrews[1]) {
    lawnCrew2Id = lawnCrews[1].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Lawn Crew 2", leadUserId: sales2, departmentId: dLawn }).returning();
    lawnCrew2Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: sales2 }, { crewId: c.id, userId: lead3 }]).onConflictDoNothing();
  }

  // Pest dept: need 2 crews
  let pestCrew1Id: number, pestCrew2Id: number;
  const pestCrews = crewsByDept(dPest);
  if (pestCrews[0]) {
    pestCrew1Id = pestCrews[0].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Pest Crew 1", leadUserId: mech, departmentId: dPest }).returning();
    pestCrew1Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: mech }, { crewId: c.id, userId: admin }]).onConflictDoNothing();
  }
  if (pestCrews[1]) {
    pestCrew2Id = pestCrews[1].id;
  } else {
    const [c] = await db.insert(crewsTable).values({ name: "Pest Crew 2", leadUserId: admin, departmentId: dPest }).returning();
    pestCrew2Id = c.id;
    await db.insert(crewMembersTable).values([{ crewId: c.id, userId: admin }, { crewId: c.id, userId: sales1 }]).onConflictDoNothing();
  }

  // ── 12 new customers ──────────────────────────────────────────────────────
  const newCustomers = await db
    .insert(customersTable)
    .values([
      // Tree dept customers
      { fullName: "Brandon Bayside",    email: "brandon@example.com",  phone: "(239) 555-0201", phoneE164: "+12395550201", billingAddress: "88 Bayside Dr, Naples, FL 34112",            ownerUserId: sales1 },
      { fullName: "Carol Coastline",    email: "carol@example.com",    phone: "(239) 555-0202", phoneE164: "+12395550202", billingAddress: "320 Gulf Shore Blvd, Naples, FL 34102",       ownerUserId: sales2 },
      { fullName: "Douglas Dunes",      email: "douglas@example.com",  phone: "(239) 555-0203", phoneE164: "+12395550203", billingAddress: "15 Dune Dr, Sanibel, FL 33957",               ownerUserId: sales1 },
      // Land dept customers
      { fullName: "Elaine Estates",     email: "elaine@example.com",   phone: "(239) 555-0204", phoneE164: "+12395550204", billingAddress: "740 Estate Blvd, Fort Myers, FL 33913",       ownerUserId: sales2 },
      { fullName: "Frank Farmland",     email: "frank@example.com",    phone: "(239) 555-0205", phoneE164: "+12395550205", billingAddress: "1100 County Rd 78, LaBelle, FL 33935",         ownerUserId: sales1 },
      { fullName: "Grace Greenway",     email: "grace@example.com",    phone: "(239) 555-0206", phoneE164: "+12395550206", billingAddress: "230 Greenway Ct, Estero, FL 33928",            ownerUserId: sales2 },
      // Lawn dept customers
      { fullName: "Irving Inlet",       email: "irving@example.com",   phone: "(239) 555-0207", phoneE164: "+12395550207", billingAddress: "50 Inlet Shore Ln, Cape Coral, FL 33914",     ownerUserId: sales1 },
      { fullName: "Janet Junction",     email: "janet@example.com",    phone: "(239) 555-0208", phoneE164: "+12395550208", billingAddress: "901 Junction Ave, Fort Myers, FL 33901",       ownerUserId: sales2 },
      { fullName: "Kevin Keystone",     email: "kevin@example.com",    phone: "(239) 555-0209", phoneE164: "+12395550209", billingAddress: "4 Keystone Ct, Bonita Springs, FL 34135",      ownerUserId: sales1 },
      // Pest dept customers
      { fullName: "Laura Lakeside",     email: "laura@example.com",    phone: "(239) 555-0210", phoneE164: "+12395550210", billingAddress: "88 Lakeside Dr, Cape Coral, FL 33904",         ownerUserId: sales2 },
      { fullName: "Martin Marina",      email: "martin@example.com",   phone: "(239) 555-0211", phoneE164: "+12395550211", billingAddress: "175 Marina Blvd, Fort Myers Beach, FL 33931",  ownerUserId: sales1 },
      { fullName: "Nancy Northgate",    email: "nancy@example.com",    phone: "(239) 555-0212", phoneE164: "+12395550212", billingAddress: "610 Northgate Dr, Naples, FL 34104",           ownerUserId: sales2 },
    ])
    .returning();

  // ── Properties for new customers ──────────────────────────────────────────
  const [brandon, carol, douglas, elaine, frank, grace, irving, janet, kevin, laura, martin, nancy] = newCustomers;

  const newProps = await db
    .insert(propertiesTable)
    .values([
      { customerId: brandon.id, address: "88 Bayside Dr",        city: "Naples",             zip: "34112" },
      { customerId: carol.id,   address: "320 Gulf Shore Blvd",  city: "Naples",             zip: "34102" },
      { customerId: douglas.id, address: "15 Dune Dr",           city: "Sanibel",            zip: "33957" },
      { customerId: elaine.id,  address: "740 Estate Blvd",      city: "Fort Myers",         zip: "33913" },
      { customerId: frank.id,   address: "1100 County Rd 78",    city: "LaBelle",            zip: "33935" },
      { customerId: grace.id,   address: "230 Greenway Ct",      city: "Estero",             zip: "33928" },
      { customerId: irving.id,  address: "50 Inlet Shore Ln",    city: "Cape Coral",         zip: "33914" },
      { customerId: janet.id,   address: "901 Junction Ave",     city: "Fort Myers",         zip: "33901" },
      { customerId: kevin.id,   address: "4 Keystone Ct",        city: "Bonita Springs",     zip: "34135" },
      { customerId: laura.id,   address: "88 Lakeside Dr",       city: "Cape Coral",         zip: "33904" },
      { customerId: martin.id,  address: "175 Marina Blvd",      city: "Fort Myers Beach",   zip: "33931" },
      { customerId: nancy.id,   address: "610 Northgate Dr",     city: "Naples",             zip: "34104" },
    ])
    .returning();
  const [bP, cP, dP, eP, fP, gP, iP, jP, kP, lP, mP, nP] = newProps;

  // ── Jobs across all 4 departments ────────────────────────────────────────
  const newJobs = await db
    .insert(jobsTable)
    .values([
      // TREE dept — SCHEDULED
      { propertyId: bP.id, crewId: treeCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(4),  totalCents: 580_000, notes: "Large live oak removal — hurricane damage, 3 trees" },
      { propertyId: cP.id, crewId: treeCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(9),  totalCents: 195_000, notes: "Banyan trimming — overhangs pool cage" },
      { propertyId: dP.id, crewId: treeCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(16), totalCents: 145_000, notes: "Sabal palm trimming & fertilizing — 6 palms" },
      // TREE dept — COMPLETE
      { propertyId: bP.id, crewId: treeCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(12), completedAt: daysAgo(11), totalCents: 420_000, notes: "Laurel oak removal — root damage to pool deck" },
      { propertyId: cP.id, crewId: treeCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(45), completedAt: daysAgo(44), totalCents: 275_000, notes: "3 Australian pines removed — county ordinance" },
      { propertyId: dP.id, crewId: treeCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(90), completedAt: daysAgo(89), totalCents: 165_000, notes: "Storm cleanup — 5 large limbs over fence" },
      // LAND dept — SCHEDULED
      { propertyId: eP.id, crewId: landCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(6),  totalCents: 890_000, notes: "Site grading — 1.2 acre commercial lot prep" },
      { propertyId: fP.id, crewId: landCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(11), totalCents: 340_000, notes: "Retention pond excavation — county spec" },
      { propertyId: gP.id, crewId: landCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(20), totalCents: 215_000, notes: "Property line grading + French drain" },
      // LAND dept — IN_PROGRESS
      { propertyId: eP.id, crewId: landCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(1),      totalCents: 480_000, notes: "Sod installation — 12,000 sq ft Bahia grass" },
      // LAND dept — COMPLETE
      { propertyId: fP.id, crewId: landCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(18), completedAt: daysAgo(17), totalCents: 620_000, notes: "Land clearing — 2 acres for new construction" },
      { propertyId: gP.id, crewId: landCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(55), completedAt: daysAgo(54), totalCents: 295_000, notes: "Retaining wall construction — 80 linear ft" },
      { propertyId: eP.id, crewId: landCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(95), completedAt: daysAgo(94), totalCents: 185_000, notes: "Driveway base prep — grading + compaction" },
      // LAWN dept — SCHEDULED
      { propertyId: iP.id, crewId: lawnCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(2),  totalCents:  58_000, notes: "Bi-weekly lawn maintenance — mow, edge, blow" },
      { propertyId: jP.id, crewId: lawnCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(7),  totalCents: 145_000, notes: "Sod replacement — 3,500 sq ft St. Augustine" },
      { propertyId: kP.id, crewId: lawnCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(13), totalCents:  75_000, notes: "Lawn aeration + overseeding" },
      // LAWN dept — IN_PROGRESS
      { propertyId: iP.id, crewId: lawnCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(0),      totalCents:  92_000, notes: "Fertilization treatment — 4-step program first application" },
      // LAWN dept — COMPLETE
      { propertyId: jP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(8),  completedAt: daysAgo(7),  totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      { propertyId: kP.id, crewId: lawnCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(22), completedAt: daysAgo(21), totalCents: 115_000, notes: "Mulch refresh — 8 yards cypress mulch, beds edged" },
      { propertyId: iP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(38), completedAt: daysAgo(37), totalCents:  68_000, notes: "Weed control + pre-emergent application" },
      { propertyId: jP.id, crewId: lawnCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(65), completedAt: daysAgo(64), totalCents:  58_000, notes: "Bi-weekly lawn maintenance" },
      { propertyId: kP.id, crewId: lawnCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(85), completedAt: daysAgo(84), totalCents: 195_000, notes: "Full lawn renovation — dead turf removed, resodded" },
      // PEST dept — SCHEDULED
      { propertyId: lP.id, crewId: pestCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(3),  totalCents:  48_000, notes: "Quarterly pest control — interior + exterior perimeter" },
      { propertyId: mP.id, crewId: pestCrew2Id, status: "SCHEDULED",   scheduledFor: daysFromNow(8),  totalCents:  65_000, notes: "Termite inspection + spot treatment" },
      { propertyId: nP.id, crewId: pestCrew1Id, status: "SCHEDULED",   scheduledFor: daysFromNow(15), totalCents:  38_000, notes: "Fire ant treatment — 1/2 acre property" },
      // PEST dept — IN_PROGRESS
      { propertyId: lP.id, crewId: pestCrew2Id, status: "IN_PROGRESS", scheduledFor: daysAgo(0), totalCents:  82_000, notes: "Rodent exclusion + bait station install" },
      // PEST dept — COMPLETE
      { propertyId: mP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(6),  completedAt: daysAgo(5),  totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: nP.id, crewId: pestCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(28), completedAt: daysAgo(27), totalCents:  95_000, notes: "Drywood termite tenting — whole structure" },
      { propertyId: lP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(50), completedAt: daysAgo(49), totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: mP.id, crewId: pestCrew2Id, status: "COMPLETE", scheduledFor: daysAgo(78), completedAt: daysAgo(77), totalCents:  48_000, notes: "Quarterly pest control" },
      { propertyId: nP.id, crewId: pestCrew1Id, status: "COMPLETE", scheduledFor: daysAgo(100), completedAt: daysAgo(99), totalCents: 48_000, notes: "Quarterly pest control" },
    ])
    .returning();

  // ── Quotes — 10 more across all departments ───────────────────────────────
  const newQuotes = await db
    .insert(quotesTable)
    .values([
      // APPROVED
      { customerId: brandon.id, propertyId: bP.id, ownerUserId: sales1, status: "APPROVED", subtotalCents: 580_000, totalCents: 620_600 },
      { customerId: elaine.id,  propertyId: eP.id, ownerUserId: sales2, status: "APPROVED", subtotalCents: 480_000, totalCents: 513_600 },
      { customerId: irving.id,  propertyId: iP.id, ownerUserId: sales1, status: "APPROVED", subtotalCents:  92_000, totalCents:  98_440 },
      { customerId: laura.id,   propertyId: lP.id, ownerUserId: sales2, status: "APPROVED", subtotalCents:  82_000, totalCents:  87_740 },
      // SENT
      { customerId: carol.id,   propertyId: cP.id, ownerUserId: sales1, status: "SENT", subtotalCents: 195_000, totalCents: 208_650 },
      { customerId: frank.id,   propertyId: fP.id, ownerUserId: sales2, status: "SENT", subtotalCents: 340_000, totalCents: 363_800 },
      { customerId: janet.id,   propertyId: jP.id, ownerUserId: sales1, status: "SENT", subtotalCents: 145_000, totalCents: 155_150 },
      { customerId: martin.id,  propertyId: mP.id, ownerUserId: sales2, status: "SENT", subtotalCents:  65_000, totalCents:  69_550 },
      // DRAFT
      { customerId: douglas.id, propertyId: dP.id, ownerUserId: sales1, status: "DRAFT", subtotalCents: 145_000, totalCents: 155_150 },
      { customerId: nancy.id,   propertyId: nP.id, ownerUserId: sales2, status: "DRAFT", subtotalCents:  95_000, totalCents: 101_650 },
    ])
    .returning();

  // Line items on approved quotes
  if (newQuotes[0]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: newQuotes[0].id, description: "Live oak removal (3 trees)", unitPriceCents: 160_000, qty: 3 },
      { quoteId: newQuotes[0].id, description: "Debris haul-off & disposal",  unitPriceCents:  40_000, qty: 1 },
    ]);
  }
  if (newQuotes[1]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: newQuotes[1].id, description: "Sod installation (sq ft)",  unitPriceCents:     75, qty: 6400 },
    ]);
  }
  if (newQuotes[2]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: newQuotes[2].id, description: "Fertilization treatment",   unitPriceCents:  65_000, qty: 1 },
      { quoteId: newQuotes[2].id, description: "Bi-weekly maintenance (mo)",unitPriceCents:  27_000, qty: 1 },
    ]);
  }
  if (newQuotes[3]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: newQuotes[3].id, description: "Rodent exclusion program",  unitPriceCents:  82_000, qty: 1 },
    ]);
  }

  // ── Invoices — spread over past 6 months with job attribution ─────────────
  // Jobs completed in the past; we pick completed ones per dept to link invoices.
  // This ensures accounting department breakdown shows real per-dept revenue.
  const completedTree = newJobs.filter((j) => j.status === "COMPLETE" && j.crewId === treeCrew1Id || j.status === "COMPLETE" && j.crewId === treeCrew2Id);
  const completedLand = newJobs.filter((j) => j.status === "COMPLETE" && (j.crewId === landCrew1Id || j.crewId === landCrew2Id));
  const completedLawn = newJobs.filter((j) => j.status === "COMPLETE" && (j.crewId === lawnCrew1Id || j.crewId === lawnCrew2Id));
  const completedPest = newJobs.filter((j) => j.status === "COMPLETE" && (j.crewId === pestCrew1Id || j.crewId === pestCrew2Id));

  type InvRow = { jobId?: number; customerId: number; status: "PAID" | "SENT" | "OVERDUE" | "DRAFT"; totalCents: number; issuedAt: Date; paidAt?: Date };
  const invoiceRows: InvRow[] = [];

  // Tree — 3 invoices (2 paid going back 3-4 months, 1 sent)
  if (completedTree[0])
    invoiceRows.push({ jobId: completedTree[0].id, customerId: brandon.id, status: "PAID",    totalCents: 420_000, issuedAt: daysAgo(10), paidAt: daysAgo(5)  });
  if (completedTree[1])
    invoiceRows.push({ jobId: completedTree[1].id, customerId: carol.id,   status: "PAID",    totalCents: 275_000, issuedAt: daysAgo(43), paidAt: daysAgo(35) });
  if (completedTree[2])
    invoiceRows.push({ jobId: completedTree[2].id, customerId: douglas.id, status: "PAID",    totalCents: 165_000, issuedAt: daysAgo(88), paidAt: daysAgo(78) });

  // Land — 3 invoices (2 paid, 1 overdue)
  if (completedLand[0])
    invoiceRows.push({ jobId: completedLand[0].id, customerId: elaine.id,  status: "PAID",    totalCents: 480_000, issuedAt: daysAgo(16), paidAt: daysAgo(8)  });
  if (completedLand[1])
    invoiceRows.push({ jobId: completedLand[1].id, customerId: frank.id,   status: "PAID",    totalCents: 620_000, issuedAt: daysAgo(53), paidAt: daysAgo(42) });
  if (completedLand[2])
    invoiceRows.push({ jobId: completedLand[2].id, customerId: grace.id,   status: "OVERDUE", totalCents: 295_000, issuedAt: daysAgo(93) });

  // Lawn — 4 invoices (3 paid at different months, 1 sent)
  if (completedLawn[0])
    invoiceRows.push({ jobId: completedLawn[0].id, customerId: janet.id,   status: "PAID",    totalCents:  58_000, issuedAt: daysAgo(6),  paidAt: daysAgo(3)  });
  if (completedLawn[1])
    invoiceRows.push({ jobId: completedLawn[1].id, customerId: kevin.id,   status: "PAID",    totalCents: 115_000, issuedAt: daysAgo(20), paidAt: daysAgo(14) });
  if (completedLawn[2])
    invoiceRows.push({ jobId: completedLawn[2].id, customerId: irving.id,  status: "PAID",    totalCents:  68_000, issuedAt: daysAgo(36), paidAt: daysAgo(28) });
  if (completedLawn[3])
    invoiceRows.push({ jobId: completedLawn[3].id, customerId: janet.id,   status: "SENT",    totalCents:  58_000, issuedAt: daysAgo(63) });

  // Pest — 4 invoices (3 paid recurring, 1 overdue)
  if (completedPest[0])
    invoiceRows.push({ jobId: completedPest[0].id, customerId: martin.id,  status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(4),  paidAt: daysAgo(2)  });
  if (completedPest[1])
    invoiceRows.push({ jobId: completedPest[1].id, customerId: nancy.id,   status: "PAID",    totalCents:  95_000, issuedAt: daysAgo(26), paidAt: daysAgo(20) });
  if (completedPest[2])
    invoiceRows.push({ jobId: completedPest[2].id, customerId: laura.id,   status: "PAID",    totalCents:  48_000, issuedAt: daysAgo(48), paidAt: daysAgo(41) });
  if (completedPest[3])
    invoiceRows.push({ jobId: completedPest[3].id, customerId: martin.id,  status: "OVERDUE", totalCents:  48_000, issuedAt: daysAgo(76) });

  if (invoiceRows.length > 0) {
    await db.insert(invoicesTable).values(invoiceRows);
  }

  // ── 2 more trucks ────────────────────────────────────────────────────────
  const existingTrucks = await db.select({ name: trucksTable.name }).from(trucksTable);
  const truckNames = new Set(existingTrucks.map((t) => t.name));

  const trucksToAdd = [
    { name: "T-06 Lawn Service Truck",    brand: "Ford",   model: "F-250 Super Duty",   vin: "1FT7W2BT0PED00001", plate: "JTREE-6", status: "ACTIVE" as const, departmentId: dLawn, purchasePriceCents: 5_800_000, purchaseDate: new Date(2023, 4, 20), currentMileage: 28_450, serviceIntervalMiles: 5_000 },
    { name: "T-07 Pest Control Van",      brand: "Ford",   model: "Transit 250 Cargo",  vin: "1FTBR1Y83PkB00002", plate: "JTREE-7", status: "ACTIVE" as const, departmentId: dPest, purchasePriceCents: 4_200_000, purchaseDate: new Date(2022, 8, 14), currentMileage: 61_230, serviceIntervalMiles: 5_000 },
    { name: "T-08 Land Loader",           brand: "Isuzu",  model: "NPR-HD Flatbed",     vin: "JALC4W16XP7000003", plate: "JTREE-8", status: "ACTIVE" as const, departmentId: dLand, purchasePriceCents: 6_650_000, purchaseDate: new Date(2021, 11, 3),  currentMileage: 88_620, serviceIntervalMiles: 7_500 },
  ];

  const insertedNewTrucks: Array<{ id: number; name: string; currentMileage: number }> = [];
  for (const t of trucksToAdd) {
    if (truckNames.has(t.name)) continue;
    const [row] = await db.insert(trucksTable).values(t).returning();
    if (row) {
      const slug = `truck-${row.id}-${slugify(row.name)}`;
      await db.update(trucksTable).set({ slug }).where(eq(trucksTable.id, row.id));
      insertedNewTrucks.push({ id: row.id, name: row.name, currentMileage: t.currentMileage });
    }
  }

  // ── Maintenance logs — rich spread across existing + new trucks ───────────
  // Fetch all trucks to add realistic logs to each dept's vehicles
  const allTrucks = await db.select({ id: trucksTable.id, name: trucksTable.name, currentMileage: trucksTable.currentMileage, departmentId: trucksTable.departmentId }).from(trucksTable);

  const truckByName = new Map(allTrucks.map((t) => [t.name, t]));
  const newMaintLogs: Array<{
    truckId?: number; equipmentId?: number; kind: "SCHEDULED" | "REPAIR" | "INSPECTION";
    description: string; performedAt: Date; performedByUserId?: number;
    laborCostCents: number; partsCostCents: number; costCents: number;
    mileageAtService?: number;
  }> = [];

  const addTruckLogs = (truckName: string, logs: Array<{ kind: "SCHEDULED"|"REPAIR"|"INSPECTION"; desc: string; daysBack: number; labor: number; parts: number; milesBack: number; performedBy: number }>) => {
    const t = truckByName.get(truckName);
    if (!t) return;
    for (const l of logs) {
      const cost = l.labor + l.parts;
      newMaintLogs.push({ truckId: t.id, kind: l.kind, description: l.desc, performedAt: daysAgo(l.daysBack), performedByUserId: l.performedBy, laborCostCents: l.labor, partsCostCents: l.parts, costCents: cost, mileageAtService: Math.max(0, t.currentMileage - l.milesBack) });
    }
  };

  addTruckLogs("T-01 Bucket Truck", [
    { kind: "SCHEDULED",  desc: "Oil change, air filter, tire rotation",       daysBack: 14, labor: 12_000, parts: 6_500,  milesBack: 800,   performedBy: mech },
    { kind: "INSPECTION", desc: "Pre-season inspection — boom, hydraulics",    daysBack: 45, labor: 18_000, parts: 0,      milesBack: 3_200, performedBy: mech },
    { kind: "REPAIR",     desc: "Hydraulic hose replacement — cab boom",       daysBack: 72, labor: 28_000, parts: 14_500, milesBack: 5_100, performedBy: mech },
  ]);
  addTruckLogs("T-02 Chip Truck", [
    { kind: "REPAIR",     desc: "Engine oil leak — rear main seal",            daysBack: 8,  labor: 42_000, parts: 18_000, milesBack: 200,   performedBy: mech },
    { kind: "SCHEDULED",  desc: "Full fluid service + belts",                  daysBack: 62, labor: 22_000, parts: 12_000, milesBack: 4_800, performedBy: mech },
  ]);
  addTruckLogs("T-03 Crane Truck", [
    { kind: "SCHEDULED",  desc: "Oil, coolant flush, brake inspection",        daysBack: 22, labor: 16_000, parts: 8_200,  milesBack: 1_400, performedBy: mech },
    { kind: "INSPECTION", desc: "Annual crane certification inspection",       daysBack: 55, labor: 35_000, parts: 0,      milesBack: 3_800, performedBy: mech },
    { kind: "REPAIR",     desc: "Outrigger pad replacement",                   daysBack: 80, labor: 20_000, parts: 11_000, milesBack: 5_600, performedBy: mech },
  ]);
  addTruckLogs("T-04 Stump Truck", [
    { kind: "SCHEDULED",  desc: "Oil change, tire check",                      daysBack: 30, labor: 10_000, parts: 5_500,  milesBack: 2_000, performedBy: mech },
    { kind: "INSPECTION", desc: "PTO and stump cutter mounting check",         daysBack: 68, labor: 12_000, parts: 0,      milesBack: 4_000, performedBy: mech },
  ]);
  addTruckLogs("T-06 Lawn Service Truck", [
    { kind: "SCHEDULED",  desc: "First-year service — oil, filter, fluids",   daysBack: 18, labor: 9_500,  parts: 4_800,  milesBack: 900,   performedBy: mech },
  ]);
  addTruckLogs("T-07 Pest Control Van", [
    { kind: "SCHEDULED",  desc: "Oil change, AC service, tire rotation",       daysBack: 25, labor: 11_000, parts: 5_200,  milesBack: 1_600, performedBy: mech },
    { kind: "REPAIR",     desc: "Spray pump pressure regulator replaced",      daysBack: 50, labor: 14_000, parts: 8_500,  milesBack: 3_200, performedBy: mech },
  ]);
  addTruckLogs("T-08 Land Loader", [
    { kind: "SCHEDULED",  desc: "Transmission service + differential fluid",  daysBack: 35, labor: 24_000, parts: 13_000, milesBack: 3_500, performedBy: mech },
    { kind: "INSPECTION", desc: "Annual DOT inspection",                       daysBack: 60, labor: 15_000, parts: 0,      milesBack: 5_200, performedBy: mech },
    { kind: "REPAIR",     desc: "Brake drums + pads — front axle",            daysBack: 85, labor: 32_000, parts: 19_500, milesBack: 7_000, performedBy: mech },
  ]);

  if (newMaintLogs.length > 0) {
    await db.insert(maintenanceLogsTable).values(newMaintLogs);
  }
}
