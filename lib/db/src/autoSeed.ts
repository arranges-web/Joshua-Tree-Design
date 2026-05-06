import bcrypt from "bcryptjs";
import { db } from "./client";
import {
  rolesTable,
  departmentsTable,
  usersTable,
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
  sectionPermissionsTable,
  serviceRequestsTable,
  ROLE_KEYS,
  DEPARTMENT_KEYS,
  SECTION_KEYS,
  type RoleKey,
  type DepartmentKey,
} from "./schema";

const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administrator",
  SALES: "Sales / Estimator",
  CREW_LEAD: "Field Crew Lead",
  MECHANIC: "Mechanic / Fleet",
  ACCOUNTING_MANAGER: "Accounting Manager",
};

const DEPT_LABELS: Record<DepartmentKey, string> = {
  Admin: "Administration",
  Sales: "Sales",
  Lawn: "Lawn",
  Landscaping: "Landscaping",
  Pest: "Pest",
  TreeService: "Tree",
  Fertilization: "Fertilization",
};

const DEFAULT_MATRIX: Record<
  RoleKey,
  Record<string, { canView: boolean; canEdit: boolean }>
> = {
  ADMIN: Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { canView: true, canEdit: true }]),
  ),
  SALES: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: true, canEdit: true },
    jobs: { canView: true, canEdit: false },
    quotes: { canView: true, canEdit: true },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: false, canEdit: false },
    "fleet.equipment": { canView: false, canEdit: false },
    "fleet.maintenance": { canView: false, canEdit: false },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: false, canEdit: false },
    "field.photos": { canView: false, canEdit: false },
    "field.safety": { canView: false, canEdit: false },
    "sales.calendar": { canView: true, canEdit: true },
    "reports.financials": { canView: false, canEdit: false },
    leads: { canView: true, canEdit: true },
    accounting: { canView: false, canEdit: false },
  },
  CREW_LEAD: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: false, canEdit: false },
    jobs: { canView: true, canEdit: true },
    quotes: { canView: false, canEdit: false },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: false, canEdit: false },
    "fleet.equipment": { canView: false, canEdit: false },
    "fleet.maintenance": { canView: false, canEdit: false },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: true, canEdit: true },
    "field.photos": { canView: true, canEdit: true },
    "field.safety": { canView: true, canEdit: true },
    "sales.calendar": { canView: false, canEdit: false },
    "reports.financials": { canView: false, canEdit: false },
    leads: { canView: false, canEdit: false },
    accounting: { canView: false, canEdit: false },
  },
  MECHANIC: {
    "dashboard.global": { canView: false, canEdit: false },
    customers: { canView: false, canEdit: false },
    jobs: { canView: false, canEdit: false },
    quotes: { canView: false, canEdit: false },
    invoices: { canView: false, canEdit: false },
    "fleet.trucks": { canView: true, canEdit: true },
    "fleet.equipment": { canView: true, canEdit: true },
    "fleet.maintenance": { canView: true, canEdit: true },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: false, canEdit: false },
    "field.photos": { canView: false, canEdit: false },
    "field.safety": { canView: false, canEdit: false },
    "sales.calendar": { canView: false, canEdit: false },
    "reports.financials": { canView: false, canEdit: false },
    leads: { canView: false, canEdit: false },
    accounting: { canView: false, canEdit: false },
  },
  ACCOUNTING_MANAGER: {
    "dashboard.global": { canView: true, canEdit: false },
    customers: { canView: true, canEdit: false },
    jobs: { canView: true, canEdit: false },
    quotes: { canView: true, canEdit: false },
    invoices: { canView: true, canEdit: false },
    "fleet.trucks": { canView: true, canEdit: false },
    "fleet.equipment": { canView: true, canEdit: false },
    "fleet.maintenance": { canView: true, canEdit: false },
    "admin.users": { canView: false, canEdit: false },
    "admin.permissions": { canView: false, canEdit: false },
    "field.job_site": { canView: false, canEdit: false },
    "field.photos": { canView: false, canEdit: false },
    "field.safety": { canView: false, canEdit: false },
    "sales.calendar": { canView: false, canEdit: false },
    "reports.financials": { canView: true, canEdit: false },
    leads: { canView: false, canEdit: false },
    accounting: { canView: true, canEdit: false },
  },
};

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 86_400_000);
}

export async function populateData(): Promise<void> {
  // All staff share a single known password for demo simplicity.
  const hash = await bcrypt.hash("password123", 10);

  // ── Roles ─────────────────────────────────────────────────────────────────
  const insertedRoles = await db
    .insert(rolesTable)
    .values(ROLE_KEYS.map((k) => ({ key: k, label: ROLE_LABELS[k] })))
    .returning();
  const roleByKey = new Map<RoleKey, number>(
    insertedRoles.map((r) => [r.key as RoleKey, r.id]),
  );

  // ── Departments ───────────────────────────────────────────────────────────
  const insertedDepts = await db
    .insert(departmentsTable)
    .values(DEPARTMENT_KEYS.map((k) => ({ key: k, label: DEPT_LABELS[k] })))
    .returning();
  const deptByKey = new Map<DepartmentKey, number>(
    insertedDepts.map((d) => [d.key as DepartmentKey, d.id]),
  );

  // ── Section permissions ───────────────────────────────────────────────────
  const permRows: {
    roleId: number;
    sectionKey: string;
    canView: boolean;
    canEdit: boolean;
  }[] = [];
  for (const role of ROLE_KEYS) {
    const roleId = roleByKey.get(role)!;
    for (const section of SECTION_KEYS) {
      const def = DEFAULT_MATRIX[role][section];
      if (!def) continue;
      permRows.push({ roleId, sectionKey: section, ...def });
    }
  }
  await db.insert(sectionPermissionsTable).values(permRows);

  // ── Users ─────────────────────────────────────────────────────────────────
  const userDefs = [
    { email: "admin@joshuatreeinc.test",    fullName: "Alex Admin",     role: "ADMIN"     as RoleKey, dept: "Admin"        as DepartmentKey },
    { email: "sales1@joshuatreeinc.test",   fullName: "Sam Sales",      role: "SALES"     as RoleKey, dept: "Sales"        as DepartmentKey },
    { email: "sales2@joshuatreeinc.test",   fullName: "Sara Estimator", role: "SALES"     as RoleKey, dept: "Sales"        as DepartmentKey },
    { email: "lead1@joshuatreeinc.test",    fullName: "Carl CrewLead",  role: "CREW_LEAD" as RoleKey, dept: "Landscaping"  as DepartmentKey },
    { email: "lead2@joshuatreeinc.test",    fullName: "Cathy CrewLead", role: "CREW_LEAD" as RoleKey, dept: "Lawn"         as DepartmentKey },
    { email: "lead3@joshuatreeinc.test",    fullName: "Bobby CrewLead", role: "CREW_LEAD" as RoleKey, dept: "TreeService"  as DepartmentKey },
    { email: "mechanic@joshuatreeinc.test", fullName: "Mike Mechanic",  role: "MECHANIC"  as RoleKey, dept: "Pest"         as DepartmentKey },
    { email: "accounting@joshuatreeinc.test", fullName: "Anna Accountant", role: "ACCOUNTING_MANAGER" as RoleKey, dept: "Admin"     as DepartmentKey },
  ];
  const insertedUsers = await db
    .insert(usersTable)
    .values(
      userDefs.map((u) => ({
        email: u.email,
        hashedPassword: hash,
        fullName: u.fullName,
        roleId: roleByKey.get(u.role)!,
        departmentId: deptByKey.get(u.dept)!,
      })),
    )
    .returning();
  const uByEmail = new Map(insertedUsers.map((x) => [x.email, x]));
  const sales1 = uByEmail.get("sales1@joshuatreeinc.test")!;
  const sales2 = uByEmail.get("sales2@joshuatreeinc.test")!;
  const lead1  = uByEmail.get("lead1@joshuatreeinc.test")!;
  const lead2  = uByEmail.get("lead2@joshuatreeinc.test")!;
  const lead3  = uByEmail.get("lead3@joshuatreeinc.test")!;
  const mech   = uByEmail.get("mechanic@joshuatreeinc.test")!;

  // ── Customers ─────────────────────────────────────────────────────────────
  const insertedCustomers = await db
    .insert(customersTable)
    .values([
      { fullName: "Hank Homeowner",    email: "hank@example.com",    phone: "(239) 555-0101", phoneE164: "+12395550101", billingAddress: "123 Palm Way, Cape Coral, FL 33904",        ownerUserId: sales1.id },
      { fullName: "Lisa Landowner",    email: "lisa@example.com",    phone: "(239) 555-0102", phoneE164: "+12395550102", billingAddress: "55 Mango Ln, Fort Myers, FL 33901",          ownerUserId: sales1.id },
      { fullName: "Pete Property",     email: "pete@example.com",    phone: "(239) 555-0103", phoneE164: "+12395550103", billingAddress: "9 Banyan Rd, Estero, FL 33928",              ownerUserId: sales1.id },
      { fullName: "Maya Mansion",      email: "maya@example.com",    phone: "(239) 555-0104", phoneE164: "+12395550104", billingAddress: "200 Oak Dr, Naples, FL 34102",               ownerUserId: sales2.id },
      { fullName: "Quentin Quail",     email: "q@example.com",       phone: "(239) 555-0105", phoneE164: "+12395550105", billingAddress: "77 Cypress Ct, Bonita Springs, FL 34135",   ownerUserId: sales2.id },
      { fullName: "Rachel Riverfront", email: "rachel@example.com",  phone: "(239) 555-0106", phoneE164: "+12395550106", billingAddress: "412 Riviera Dr, Cape Coral, FL 33904",      ownerUserId: sales1.id },
      { fullName: "Derek Dockside",    email: "derek@example.com",   phone: "(239) 555-0107", phoneE164: "+12395550107", billingAddress: "18 Harbor Ln, Fort Myers Beach, FL 33931",  ownerUserId: sales2.id },
      { fullName: "Fiona Fairway",     email: "fiona@example.com",   phone: "(239) 555-0108", phoneE164: "+12395550108", billingAddress: "600 Fairway Blvd, Naples, FL 34108",        ownerUserId: sales2.id },
      { fullName: "George Glade",      email: "george@example.com",  phone: "(239) 555-0109", phoneE164: "+12395550109", billingAddress: "301 Glade Rd, Lehigh Acres, FL 33936",      ownerUserId: sales1.id },
      { fullName: "Harriet Harbor",    email: "harriet@example.com", phone: "(239) 555-0110", phoneE164: "+12395550110", billingAddress: "5 Harbor Isle, Marco Island, FL 34145",     ownerUserId: sales2.id },
    ])
    .returning();
  const [hank, lisa, pete, maya, quentin, rachel, derek, fiona, george, harriet] = insertedCustomers as [
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
    typeof insertedCustomers[number],
  ];

  // ── Properties ────────────────────────────────────────────────────────────
  // Hank (demo portal user) gets exactly 2 properties per spec.
  const insertedProperties = await db
    .insert(propertiesTable)
    .values([
      // Hank — 2 properties (matches customer portal demo requirements)
      { customerId: hank.id, address: "123 Palm Way",       city: "Cape Coral",       zip: "33904" },
      { customerId: hank.id, address: "1400 Surfside Blvd", city: "Cape Coral",       zip: "33914" },
      // Others — 1-2 properties each
      { customerId: lisa.id,    address: "55 Mango Ln",       city: "Fort Myers",       zip: "33901" },
      { customerId: lisa.id,    address: "210 Iona Rd",        city: "Fort Myers",       zip: "33908" },
      { customerId: pete.id,    address: "9 Banyan Rd",        city: "Estero",           zip: "33928" },
      { customerId: maya.id,    address: "200 Oak Dr",         city: "Naples",           zip: "34102" },
      { customerId: maya.id,    address: "5100 Pelican Bay",   city: "Naples",           zip: "34108" },
      { customerId: quentin.id, address: "77 Cypress Ct",      city: "Bonita Springs",   zip: "34135" },
      { customerId: rachel.id,  address: "412 Riviera Dr",     city: "Cape Coral",       zip: "33904" },
      { customerId: derek.id,   address: "18 Harbor Ln",       city: "Fort Myers Beach", zip: "33931" },
      { customerId: fiona.id,   address: "600 Fairway Blvd",   city: "Naples",           zip: "34108" },
      { customerId: george.id,  address: "301 Glade Rd",       city: "Lehigh Acres",     zip: "33936" },
      { customerId: harriet.id, address: "5 Harbor Isle",      city: "Marco Island",     zip: "34145" },
    ])
    .returning();
  const [
    hankP1, hankP2,
    lisaP1, lisaP2,
    peteP1,
    mayaP1, mayaP2,
    quintP1,
    rachelP1,
    derekP1,
    fionaP1,
    georgeP1,
    harrietP1,
  ] = insertedProperties as Array<typeof insertedProperties[number]>;

  // ── Crews ─────────────────────────────────────────────────────────────────
  const insertedCrews = await db
    .insert(crewsTable)
    .values([
      { name: "Crew Alpha", leadUserId: lead1.id },
      { name: "Crew Beta",  leadUserId: lead2.id },
      { name: "Crew Gamma", leadUserId: lead3.id },
    ])
    .returning();
  const [alpha, beta, gamma] = insertedCrews as Array<typeof insertedCrews[number]>;
  await db.insert(crewMembersTable).values([
    { crewId: alpha.id, userId: lead1.id },
    { crewId: alpha.id, userId: mech.id },
    { crewId: alpha.id, userId: sales1.id },
    { crewId: beta.id,  userId: lead2.id },
    { crewId: beta.id,  userId: sales2.id },
    { crewId: gamma.id, userId: lead3.id },
    { crewId: gamma.id, userId: lead2.id },
  ]);

  // ── Jobs ──────────────────────────────────────────────────────────────────
  // Hank's jobs: 1 SCHEDULED (upcoming) + 2 COMPLETE (recent history)
  await db.insert(jobsTable).values([
    { propertyId: hankP1.id, crewId: alpha.id, status: "SCHEDULED",  scheduledFor: daysFromNow(7),  totalCents: 195_000, notes: "Annual palm pruning — 4 royal palms along driveway" },
    { propertyId: hankP1.id, crewId: alpha.id, status: "COMPLETE",   scheduledFor: daysAgo(28),  completedAt: daysAgo(27), totalCents: 320_000, notes: "Large live oak removal — root zone near pool cage" },
    { propertyId: hankP2.id, crewId: beta.id,  status: "COMPLETE",   scheduledFor: daysAgo(55),  completedAt: daysAgo(54), totalCents: 87_500,  notes: "Stump grinding — 2 stumps left from prior removal" },
  ]);

  // Additional 22 jobs across other customers (SCHEDULED, IN_PROGRESS, COMPLETE)
  await db.insert(jobsTable).values([
    // SCHEDULED (upcoming)
    { propertyId: lisaP1.id,   crewId: beta.id,   status: "SCHEDULED",   scheduledFor: daysFromNow(3),  totalCents: 145_000, notes: "Trim 3 queen palms, remove dead fronds" },
    { propertyId: peteP1.id,   crewId: gamma.id,  status: "SCHEDULED",   scheduledFor: daysFromNow(5),  totalCents: 260_000, notes: "Banyan tree thinning — permit obtained" },
    { propertyId: mayaP1.id,   crewId: alpha.id,  status: "SCHEDULED",   scheduledFor: daysFromNow(10), totalCents: 480_000, notes: "Full canopy reduction — 6 oaks" },
    { propertyId: quintP1.id,  crewId: beta.id,   status: "SCHEDULED",   scheduledFor: daysFromNow(12), totalCents: 95_000,  notes: "Cypress crown raising — 4 ft clearance" },
    { propertyId: rachelP1.id, crewId: gamma.id,  status: "SCHEDULED",   scheduledFor: daysFromNow(14), totalCents: 75_000,  notes: "Palm trimming, hurricane prep" },
    { propertyId: derekP1.id,  crewId: alpha.id,  status: "SCHEDULED",   scheduledFor: daysFromNow(18), totalCents: 340_000, notes: "Mangrove trim — DEP permit active" },
    { propertyId: harrietP1.id, crewId: gamma.id,  status: "SCHEDULED",   scheduledFor: daysFromNow(21), totalCents: 115_000, notes: "Laurel oak limb removal — over fence line" },
    // IN_PROGRESS (today / active)
    { propertyId: lisaP2.id,   crewId: beta.id,   status: "IN_PROGRESS", scheduledFor: daysFromNow(0),  totalCents: 210_000, notes: "Storm cleanup — 4 downed limbs over pool" },
    { propertyId: mayaP2.id,   crewId: gamma.id,  status: "IN_PROGRESS", scheduledFor: daysFromNow(0),  totalCents: 165_000, notes: "Crane-assisted removal — 70 ft Laurel oak" },
    { propertyId: georgeP1.id, crewId: alpha.id,  status: "IN_PROGRESS", scheduledFor: daysAgo(1),   totalCents: 58_000,  notes: "Sabal palm removal — 3 trees" },
    { propertyId: fionaP1.id,  crewId: beta.id,   status: "IN_PROGRESS", scheduledFor: daysFromNow(0),  totalCents: 130_000, notes: "Fairway edge trimming — HOA spec" },
    // COMPLETE (recent history)
    { propertyId: harrietP1.id, crewId: gamma.id, status: "COMPLETE", scheduledFor: daysAgo(5),  completedAt: daysAgo(4),  totalCents: 225_000, notes: "Emergency storm removal — leaning pine" },
    { propertyId: rachelP1.id,  crewId: alpha.id, status: "COMPLETE", scheduledFor: daysAgo(10), completedAt: daysAgo(9),  totalCents: 110_000, notes: "Ficus hedge reduction" },
    { propertyId: peteP1.id,    crewId: beta.id,  status: "COMPLETE", scheduledFor: daysAgo(15), completedAt: daysAgo(14), totalCents: 88_000,  notes: "Australian pine removal x2" },
    { propertyId: mayaP1.id,    crewId: gamma.id, status: "COMPLETE", scheduledFor: daysAgo(20), completedAt: daysAgo(19), totalCents: 395_000, notes: "Back-yard canopy cleanup post-storm" },
    { propertyId: lisaP1.id,    crewId: alpha.id, status: "COMPLETE", scheduledFor: daysAgo(30), completedAt: daysAgo(29), totalCents: 72_000,  notes: "Annual palm skinning — 5 palms" },
    { propertyId: derekP1.id,   crewId: beta.id,  status: "COMPLETE", scheduledFor: daysAgo(40), completedAt: daysAgo(39), totalCents: 185_000, notes: "Seawall-side mangrove trim" },
    { propertyId: quintP1.id,   crewId: gamma.id, status: "COMPLETE", scheduledFor: daysAgo(50), completedAt: daysAgo(49), totalCents: 145_000, notes: "3 laurel oaks thinned — HOA request" },
    { propertyId: fionaP1.id,   crewId: alpha.id, status: "COMPLETE", scheduledFor: daysAgo(60), completedAt: daysAgo(59), totalCents: 62_000,  notes: "Queen palm nutrient inject + frond removal" },
    { propertyId: georgeP1.id,  crewId: beta.id,  status: "COMPLETE", scheduledFor: daysAgo(70), completedAt: daysAgo(69), totalCents: 310_000, notes: "3 large oaks removed — land clearing" },
    { propertyId: harrietP1.id, crewId: gamma.id, status: "COMPLETE", scheduledFor: daysAgo(80), completedAt: daysAgo(79), totalCents: 195_000, notes: "Emergency call — tree on fence line" },
  ]);

  // ── Quotes — 5 DRAFT, 3 SENT, 2 APPROVED = 10 total ─────────────────────
  const insertedQuotes = await db
    .insert(quotesTable)
    .values([
      // APPROVED (2)
      { customerId: hank.id,    propertyId: hankP1.id,    ownerUserId: sales1.id, status: "APPROVED", subtotalCents: 195_000, totalCents: 208_650 },
      { customerId: lisa.id,    propertyId: lisaP1.id,    ownerUserId: sales1.id, status: "APPROVED", subtotalCents: 145_000, totalCents: 155_150 },
      // SENT (3)
      { customerId: pete.id,    propertyId: peteP1.id,    ownerUserId: sales1.id, status: "SENT",     subtotalCents: 260_000, totalCents: 278_200 },
      { customerId: maya.id,    propertyId: mayaP1.id,    ownerUserId: sales2.id, status: "SENT",     subtotalCents: 480_000, totalCents: 513_600 },
      { customerId: rachel.id,  propertyId: rachelP1.id,  ownerUserId: sales1.id, status: "SENT",     subtotalCents: 75_000,  totalCents:  80_250 },
      // DRAFT (5)
      { customerId: derek.id,   propertyId: derekP1.id,   ownerUserId: sales2.id, status: "DRAFT",    subtotalCents: 340_000, totalCents: 363_800 },
      { customerId: fiona.id,   propertyId: fionaP1.id,   ownerUserId: sales2.id, status: "DRAFT",    subtotalCents: 130_000, totalCents: 139_100 },
      { customerId: george.id,  propertyId: georgeP1.id,  ownerUserId: sales1.id, status: "DRAFT",    subtotalCents: 310_000, totalCents: 331_700 },
      { customerId: harriet.id, propertyId: harrietP1.id, ownerUserId: sales2.id, status: "DRAFT",    subtotalCents: 420_000, totalCents: 449_400 },
      { customerId: quentin.id, propertyId: quintP1.id,   ownerUserId: sales2.id, status: "DRAFT",    subtotalCents: 95_000,  totalCents: 101_650 },
    ])
    .returning();

  // Line items on the two approved quotes
  if (insertedQuotes[0]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: insertedQuotes[0].id, description: "Royal palm pruning (4 trees)", unitPriceCents: 42_500, qty: 4 },
      { quoteId: insertedQuotes[0].id, description: "Debris haul-off & disposal",   unitPriceCents: 25_000, qty: 1 },
    ]);
  }
  if (insertedQuotes[1]) {
    await db.insert(quoteLineItemsTable).values([
      { quoteId: insertedQuotes[1].id, description: "Queen palm trim (3 trees)",    unitPriceCents: 29_000, qty: 3 },
      { quoteId: insertedQuotes[1].id, description: "Debris haul-off",              unitPriceCents: 58_000, qty: 1 },
    ]);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  await db.insert(invoicesTable).values([
    { customerId: hank.id,   status: "PAID", totalCents: 320_000, issuedAt: daysAgo(30), paidAt: daysAgo(18) },
    { customerId: hank.id,   status: "PAID", totalCents:  87_500, issuedAt: daysAgo(60), paidAt: daysAgo(48) },
    { customerId: lisa.id,   status: "SENT", totalCents: 210_000, issuedAt: daysAgo(3)  },
    { customerId: maya.id,   status: "SENT", totalCents: 395_000, issuedAt: daysAgo(5)  },
    { customerId: george.id, status: "PAID", totalCents: 310_000, issuedAt: daysAgo(75), paidAt: daysAgo(62) },
  ]);

  // ── Fleet ─────────────────────────────────────────────────────────────────
  // Trucks include brand/model/purchase data + odometer state so the Smart
  // Asset Registry, QR-code action pages, and Pulse dashboard have rich data.
  // Each visible department gets at least one truck so the dept-filter
  // dropdown changes the data shown.
  const dSales         = deptByKey.get("Sales")!;
  const dLawn          = deptByKey.get("Lawn")!;
  const dLandscaping   = deptByKey.get("Landscaping")!;
  const dPest          = deptByKey.get("Pest")!;
  const dTreeService   = deptByKey.get("TreeService")!;
  const dFertilization = deptByKey.get("Fertilization")!;

  const insertedTrucks = await db
    .insert(trucksTable)
    .values([
      {
        name: "T-01 Bucket Truck",
        brand: "Ford",
        model: "F-750 Bucket",
        vin: "1FDXX0000000A1",
        plate: "JTREE-1",
        status: "ACTIVE",
        departmentId: dLandscaping,
        assignedCrewId: alpha.id,
        purchasePriceCents: 8_500_000,
        purchaseDate: new Date(2021, 2, 14),
        currentMileage: 64_820,
        serviceIntervalMiles: 5_000,
      },
      {
        name: "T-02 Chip Truck",
        brand: "International",
        model: "MV607 Chip Box",
        vin: "1FDXX0000000A2",
        plate: "JTREE-2",
        status: "IN_SHOP",
        departmentId: dTreeService,
        assignedCrewId: beta.id,
        purchasePriceCents: 9_200_000,
        purchaseDate: new Date(2019, 7, 9),
        currentMileage: 118_450,
        serviceIntervalMiles: 5_000,
      },
      {
        name: "T-03 Crane Truck",
        brand: "Freightliner",
        model: "M2-106 Crane",
        vin: "1FDXX0000000A3",
        plate: "JTREE-3",
        status: "ACTIVE",
        departmentId: dTreeService,
        assignedCrewId: gamma.id,
        purchasePriceCents: 14_750_000,
        purchaseDate: new Date(2022, 5, 1),
        currentMileage: 41_310,
        serviceIntervalMiles: 7_500,
      },
      {
        name: "T-06 Lawn Service Truck",
        brand: "Ford",
        model: "F-250 Super Duty",
        vin: "1FT7W2BT0PED00006",
        plate: "JTREE-6",
        status: "ACTIVE",
        departmentId: dLawn,
        purchasePriceCents: 5_800_000,
        purchaseDate: new Date(2023, 4, 20),
        currentMileage: 28_450,
        serviceIntervalMiles: 5_000,
      },
      {
        name: "T-07 Pest Control Van",
        brand: "Ford",
        model: "Transit 250 Cargo",
        vin: "1FTBR1Y83PKB00007",
        plate: "JTREE-7",
        status: "ACTIVE",
        departmentId: dPest,
        purchasePriceCents: 4_200_000,
        purchaseDate: new Date(2022, 8, 14),
        currentMileage: 61_230,
        serviceIntervalMiles: 5_000,
      },
      {
        name: "T-08 Sales Estimator",
        brand: "Toyota",
        model: "Tacoma SR5",
        vin: "3TYCZ5AN0PT00008",
        plate: "JTREE-8",
        status: "ACTIVE",
        departmentId: dSales,
        purchasePriceCents: 3_950_000,
        purchaseDate: new Date(2024, 2, 6),
        currentMileage: 12_140,
        serviceIntervalMiles: 5_000,
      },
      {
        name: "T-09 Fertilization Tank Truck",
        brand: "Isuzu",
        model: "NPR-HD Tanker",
        vin: "JALC4W160P7000009",
        plate: "JTREE-9",
        status: "ACTIVE",
        departmentId: dFertilization,
        purchasePriceCents: 6_450_000,
        purchaseDate: new Date(2023, 1, 18),
        currentMileage: 22_770,
        serviceIntervalMiles: 5_000,
      },
    ])
    .returning();
  const [t1, t2, t3] = insertedTrucks as Array<typeof insertedTrucks[number]>;

  const insertedEquip = await db
    .insert(equipmentTable)
    .values([
      {
        name: "Stihl MS-462",
        type: "Chainsaw",
        brand: "Stihl",
        model: "MS-462 C-M",
        serial: "ST462-001",
        status: "ACTIVE",
        departmentId: dLandscaping,
        assignedTruckId: t1.id,
        purchasePriceCents: 119_900,
        purchaseDate: new Date(2023, 1, 4),
        currentHours: 412,
        serviceIntervalHours: 50,
      },
      {
        name: "Vermeer BC1500",
        type: "Chipper",
        brand: "Vermeer",
        model: "BC1500 XL",
        serial: "VR1500-02",
        status: "IN_SHOP",
        departmentId: dTreeService,
        assignedTruckId: t2.id,
        purchasePriceCents: 7_850_000,
        purchaseDate: new Date(2020, 4, 18),
        currentHours: 2_385,
        serviceIntervalHours: 250,
      },
      {
        name: "Husqvarna 572 XP",
        type: "Chainsaw",
        brand: "Husqvarna",
        model: "572 XP",
        serial: "HQ572-003",
        status: "IN_SHOP",
        departmentId: dTreeService,
        assignedTruckId: t3.id,
        purchasePriceCents: 134_900,
        purchaseDate: new Date(2024, 0, 21),
        currentHours: 168,
        serviceIntervalHours: 50,
      },
      {
        name: "Echo CS-590",
        type: "Chainsaw",
        brand: "Echo",
        model: "CS-590 Timber Wolf",
        serial: "EC590-004",
        status: "ACTIVE",
        departmentId: dPest,
        assignedTruckId: t1.id,
        purchasePriceCents: 44_900,
        purchaseDate: new Date(2023, 5, 12),
        currentHours: 290,
        serviceIntervalHours: 50,
      },
      {
        name: "Dingo TX-1000",
        type: "Compact Utility Loader",
        brand: "Toro",
        model: "Dingo TX-1000",
        serial: "TX1000-005",
        status: "ACTIVE",
        departmentId: dLandscaping,
        assignedTruckId: t1.id,
        purchasePriceCents: 3_450_000,
        purchaseDate: new Date(2022, 8, 20),
        currentHours: 875,
        serviceIntervalHours: 200,
      },
      // Sales — laser measure (estimating gear)
      {
        name: "Bosch GLM-50 Laser",
        type: "Measuring Tool",
        brand: "Bosch",
        model: "GLM-50 C",
        serial: "BSH-GLM50-006",
        status: "ACTIVE",
        departmentId: dSales,
        purchasePriceCents: 18_900,
        purchaseDate: new Date(2024, 1, 10),
        currentHours: 0,
        serviceIntervalHours: 999,
      },
      // Lawn dept primary mower
      {
        name: "Exmark Lazer Z Mower",
        type: "Zero-Turn Mower",
        brand: "Exmark",
        model: "Lazer Z X-Series",
        serial: "EX-LZX-007",
        status: "ACTIVE",
        departmentId: dLawn,
        purchasePriceCents: 1_200_000,
        purchaseDate: new Date(2023, 2, 10),
        currentHours: 620,
        serviceIntervalHours: 200,
      },
      // Fertilization dept rig
      {
        name: "Z-Spray Junior Spreader",
        type: "Spreader/Sprayer",
        brand: "Z-Spray",
        model: "Junior Max",
        serial: "ZS-JR-008",
        status: "ACTIVE",
        departmentId: dFertilization,
        purchasePriceCents: 985_000,
        purchaseDate: new Date(2023, 7, 11),
        currentHours: 410,
        serviceIntervalHours: 200,
      },
    ])
    .returning();
  const [e1, e2, e3] = insertedEquip as Array<typeof insertedEquip[number]>;

  // Each maintenance log captures labor + parts split and a usage snapshot so
  // the Pulse dashboard and life-to-date money pits chart have real data.
  await db.insert(maintenanceLogsTable).values([
    { truckId: t1.id,     kind: "SCHEDULED",  description: "Oil & filter change, lube fittings",            performedByUserId: mech.id, laborCostCents:  7_500, partsCostCents:  5_000, costCents: 12_500, performedAt: daysAgo(14), mileageAtService: 60_120 },
    { truckId: t2.id,     kind: "REPAIR",     description: "Hydraulic line blow-out repair",                performedByUserId: mech.id, laborCostCents: 52_500, partsCostCents: 35_000, costCents: 87_500, performedAt: daysAgo(7),  mileageAtService: 117_800 },
    { truckId: t2.id,     kind: "REPAIR",     description: "Replaced PTO clutch — slipping under load",     performedByUserId: mech.id, laborCostCents: 18_000, partsCostCents: 28_000, costCents: 46_000, performedAt: daysAgo(60), mileageAtService: 110_400 },
    { truckId: t3.id,     kind: "INSPECTION", description: "Annual FDOT safety inspection",                 performedByUserId: mech.id, laborCostCents: 18_000, partsCostCents: 12_000, costCents: 30_000, performedAt: daysAgo(30), mileageAtService: 38_900 },
    { equipmentId: e1.id, kind: "SCHEDULED",  description: "Bar & chain replaced, guide bar straightened",  performedByUserId: mech.id, laborCostCents:  2_700, partsCostCents:  1_800, costCents:  4_500, performedAt: daysAgo(10), hoursAtService: 380 },
    { equipmentId: e2.id, kind: "REPAIR",     description: "Drum knife set replaced — excessive wear",      performedByUserId: mech.id, laborCostCents: 13_200, partsCostCents:  8_800, costCents: 22_000, performedAt: daysAgo(7),  hoursAtService: 2_310 },
    { equipmentId: e2.id, kind: "REPAIR",     description: "Hydraulic pump rebuild",                        performedByUserId: mech.id, laborCostCents: 22_000, partsCostCents: 41_500, costCents: 63_500, performedAt: daysAgo(45), hoursAtService: 2_140 },
    { equipmentId: e3.id, kind: "REPAIR",     description: "Cylinder rebuild — compression failure",        performedByUserId: mech.id, laborCostCents: 22_800, partsCostCents: 15_200, costCents: 38_000, performedAt: daysAgo(3),  hoursAtService: 155 },
  ]);

  // ── Service requests ──────────────────────────────────────────────────────
  // Hank gets exactly 2: one NEW (fresh lead) and one CONTACTED (follow-up stage)
  await db.insert(serviceRequestsTable).values([
    {
      customerId: hank.id, propertyId: hankP2.id,
      service: "TREE_REMOVAL", source: "PORTAL", status: "NEW",
      notes: "Large oak leaning over garage — worried after last hurricane. Same week if possible.",
      preferredWindowStart: daysFromNow(3), preferredWindowEnd: daysFromNow(7),
    },
    {
      customerId: hank.id, propertyId: hankP1.id,
      service: "TRIMMING_PRUNING", source: "PORTAL", status: "CONTACTED",
      notes: "Four sabal palms along fence line — fronds dragging on roof.",
      preferredWindowStart: daysFromNow(14), preferredWindowEnd: daysFromNow(21),
    },
    // Additional leads in the inbox
    {
      customerId: lisa.id, propertyId: lisaP2.id,
      service: "EMERGENCY_STORM", source: "WEB", status: "NEW",
      notes: "Branches down across pool cage, need same-day or next-day cleanup.",
    },
    {
      customerId: pete.id, propertyId: peteP1.id,
      service: "STUMP_GRINDING", source: "PORTAL", status: "NEW",
      notes: "Two large stumps left over from removal last month.",
      preferredWindowStart: daysFromNow(7), preferredWindowEnd: daysFromNow(14),
    },
    {
      customerId: rachel.id, propertyId: rachelP1.id,
      service: "MANGROVE_CARE", source: "WEB", status: "NEW",
      notes: "Annual DEP-permitted trim along canal. Same scope as last year.",
      preferredWindowStart: daysFromNow(21), preferredWindowEnd: daysFromNow(35),
    },
    {
      customerId: fiona.id, propertyId: fionaP1.id,
      service: "CRANE_ASSISTED", source: "PHONE", status: "NEW",
      notes: "Need crane job for 80-ft Mahogany — tight space between house and wall.",
    },
    {
      customerId: maya.id, propertyId: mayaP2.id,
      service: "TRIMMING_PRUNING", source: "PORTAL", status: "CONTACTED",
      notes: "6 oaks along back property line — HOA sent notice. Quote ASAP.",
      preferredWindowStart: daysFromNow(5), preferredWindowEnd: daysFromNow(12),
    },
    {
      customerId: george.id, propertyId: georgeP1.id,
      service: "TREE_REMOVAL", source: "WALKIN", status: "QUOTED",
      notes: "3 dead pines near fence line. Quote sent — waiting on approval.",
    },
  ]);

  void quentin; void derek; void harriet;
}

export async function seedIfEmpty(): Promise<boolean> {
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length > 0) {
    return false;
  }
  await populateData();
  return true;
}
