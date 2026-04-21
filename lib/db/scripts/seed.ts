/* eslint-disable no-console */
import bcrypt from "bcryptjs";
import {
  db,
  rolesTable,
  departmentsTable,
  usersTable,
  customersTable,
  propertiesTable,
  crewsTable,
  crewMembersTable,
  jobsTable,
  quotesTable,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
  sectionPermissionsTable,
  ROLE_KEYS,
  DEPARTMENT_KEYS,
  SECTION_KEYS,
  type RoleKey,
  type DepartmentKey,
} from "../src";
import { sql } from "drizzle-orm";

const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administrator",
  SALES: "Sales / Estimator",
  CREW_LEAD: "Field Crew Lead",
  MECHANIC: "Mechanic / Fleet",
};

const DEPT_LABELS: Record<DepartmentKey, string> = {
  Admin: "Administration",
  Sales: "Sales",
  Operations: "Field Operations",
  Fleet: "Fleet & Mechanics",
};

// Default permission matrix mirrored from artifacts/api-server/src/lib/rbac/matrix.ts.
// Kept here (small) to avoid a runtime dep on the api-server package from the seed.
const DEFAULT_MATRIX: Record<RoleKey, Record<string, { canView: boolean; canEdit: boolean }>> = {
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
  },
};

async function main() {
  console.log("⚠️  CHANGE ALL SEEDED PASSWORDS BEFORE PROD — they're 'password123'.");

  // Wipe in dependency order
  console.log("Wiping existing data…");
  await db.execute(sql`TRUNCATE
    section_permissions,
    maintenance_logs,
    equipment,
    trucks,
    quote_line_items,
    invoices,
    quotes,
    job_photos,
    safety_checklists,
    tree_inventory,
    jobs,
    crew_members,
    crews,
    properties,
    customers,
    sessions,
    users,
    departments,
    roles
    RESTART IDENTITY CASCADE`);

  // Roles
  const insertedRoles = await db
    .insert(rolesTable)
    .values(ROLE_KEYS.map((k) => ({ key: k, label: ROLE_LABELS[k] })))
    .returning();
  const roleByKey = new Map<RoleKey, number>(
    insertedRoles.map((r) => [r.key as RoleKey, r.id]),
  );

  // Departments
  const insertedDepts = await db
    .insert(departmentsTable)
    .values(DEPARTMENT_KEYS.map((k) => ({ key: k, label: DEPT_LABELS[k] })))
    .returning();
  const deptByKey = new Map<DepartmentKey, number>(
    insertedDepts.map((d) => [d.key as DepartmentKey, d.id]),
  );

  // Section permissions (mirror defaults)
  const permRows: { roleId: number; sectionKey: string; canView: boolean; canEdit: boolean }[] = [];
  for (const role of ROLE_KEYS) {
    const roleId = roleByKey.get(role)!;
    for (const section of SECTION_KEYS) {
      const def = DEFAULT_MATRIX[role][section];
      if (!def) continue;
      permRows.push({ roleId, sectionKey: section, ...def });
    }
  }
  await db.insert(sectionPermissionsTable).values(permRows);

  // Users
  const hash = await bcrypt.hash("password123", 10);
  const userValues = [
    { email: "admin@joshuatreeinc.test", fullName: "Alex Admin", role: "ADMIN" as RoleKey, dept: "Admin" as DepartmentKey },
    { email: "sales1@joshuatreeinc.test", fullName: "Sam Sales", role: "SALES" as RoleKey, dept: "Sales" as DepartmentKey },
    { email: "sales2@joshuatreeinc.test", fullName: "Sara Estimator", role: "SALES" as RoleKey, dept: "Sales" as DepartmentKey },
    { email: "lead1@joshuatreeinc.test", fullName: "Carl CrewLead", role: "CREW_LEAD" as RoleKey, dept: "Operations" as DepartmentKey },
    { email: "lead2@joshuatreeinc.test", fullName: "Cathy CrewLead", role: "CREW_LEAD" as RoleKey, dept: "Operations" as DepartmentKey },
    { email: "mechanic@joshuatreeinc.test", fullName: "Mike Mechanic", role: "MECHANIC" as RoleKey, dept: "Fleet" as DepartmentKey },
  ];
  const insertedUsers = await db
    .insert(usersTable)
    .values(
      userValues.map((u) => ({
        email: u.email,
        hashedPassword: hash,
        fullName: u.fullName,
        roleId: roleByKey.get(u.role)!,
        departmentId: deptByKey.get(u.dept)!,
      })),
    )
    .returning();
  const userByEmail = new Map(insertedUsers.map((u) => [u.email, u]));

  const sales1 = userByEmail.get("sales1@joshuatreeinc.test")!;
  const sales2 = userByEmail.get("sales2@joshuatreeinc.test")!;
  const lead1 = userByEmail.get("lead1@joshuatreeinc.test")!;
  const lead2 = userByEmail.get("lead2@joshuatreeinc.test")!;

  // Customers (split between the two sales reps)
  const insertedCustomers = await db
    .insert(customersTable)
    .values([
      { fullName: "Hank Homeowner", email: "hank@example.com", phone: "239-555-0101", billingAddress: "123 Palm Way, Cape Coral", ownerUserId: sales1.id },
      { fullName: "Lisa Landowner", email: "lisa@example.com", phone: "239-555-0102", billingAddress: "55 Mango Ln, Fort Myers", ownerUserId: sales1.id },
      { fullName: "Pete Property", email: "pete@example.com", phone: "239-555-0103", billingAddress: "9 Banyan Rd, Estero", ownerUserId: sales1.id },
      { fullName: "Maya Mansion", email: "maya@example.com", phone: "239-555-0104", billingAddress: "200 Oak Dr, Naples", ownerUserId: sales2.id },
      { fullName: "Quentin Quail", email: "q@example.com", phone: "239-555-0105", billingAddress: "77 Cypress Ct, Bonita Springs", ownerUserId: sales2.id },
    ])
    .returning();

  // Properties (1-2 per customer)
  const propValues = insertedCustomers.flatMap((c, i) => [
    { customerId: c.id, address: `${100 + i} Main St`, city: "Cape Coral", zip: "33904" },
  ]);
  // Add a second property for two of them
  propValues.push({ customerId: insertedCustomers[0]!.id, address: "200 Lake Dr", city: "Cape Coral", zip: "33904" });
  propValues.push({ customerId: insertedCustomers[3]!.id, address: "300 Beach Rd", city: "Naples", zip: "34102" });
  propValues.push({ customerId: insertedCustomers[4]!.id, address: "44 Pine St", city: "Estero", zip: "33928" });
  const insertedProperties = await db.insert(propertiesTable).values(propValues).returning();

  // Crews
  const insertedCrews = await db
    .insert(crewsTable)
    .values([
      { name: "Crew Alpha", leadUserId: lead1.id },
      { name: "Crew Bravo", leadUserId: lead2.id },
    ])
    .returning();
  await db.insert(crewMembersTable).values([
    { crewId: insertedCrews[0]!.id, userId: lead1.id },
    { crewId: insertedCrews[1]!.id, userId: lead2.id },
  ]);

  // Jobs (some assigned to each crew)
  await db.insert(jobsTable).values([
    { propertyId: insertedProperties[0]!.id, crewId: insertedCrews[0]!.id, status: "SCHEDULED", totalCents: 240000, scheduledFor: new Date(Date.now() + 86400000), notes: "Live oak removal" },
    { propertyId: insertedProperties[1]!.id, crewId: insertedCrews[0]!.id, status: "IN_PROGRESS", totalCents: 95000, scheduledFor: new Date(), notes: "Trim 3 palms" },
    { propertyId: insertedProperties[2]!.id, crewId: insertedCrews[1]!.id, status: "SCHEDULED", totalCents: 350000, scheduledFor: new Date(Date.now() + 172800000), notes: "Storm cleanup" },
    { propertyId: insertedProperties[3]!.id, crewId: insertedCrews[1]!.id, status: "COMPLETE", totalCents: 180000, completedAt: new Date(Date.now() - 86400000), notes: "Stump grind" },
    { propertyId: insertedProperties[4]!.id, crewId: null, status: "SCHEDULED", totalCents: 120000, notes: "Awaiting crew assignment" },
    { propertyId: insertedProperties[5]!.id, crewId: insertedCrews[0]!.id, status: "SCHEDULED", totalCents: 80000, notes: "Mangrove trim" },
  ]);

  // Quotes (one per sales rep, mix of statuses)
  await db.insert(quotesTable).values([
    { customerId: insertedCustomers[0]!.id, propertyId: insertedProperties[0]!.id, ownerUserId: sales1.id, status: "SENT", subtotalCents: 240000, totalCents: 256800 },
    { customerId: insertedCustomers[1]!.id, propertyId: insertedProperties[1]!.id, ownerUserId: sales1.id, status: "APPROVED", subtotalCents: 95000, totalCents: 101650 },
    { customerId: insertedCustomers[3]!.id, propertyId: insertedProperties[3]!.id, ownerUserId: sales2.id, status: "DRAFT", subtotalCents: 180000, totalCents: 192600 },
    { customerId: insertedCustomers[4]!.id, propertyId: insertedProperties[7]!.id, ownerUserId: sales2.id, status: "REJECTED", subtotalCents: 120000, totalCents: 128400 },
  ]);

  // Trucks + equipment + maintenance logs
  const insertedTrucks = await db
    .insert(trucksTable)
    .values([
      { name: "T-01 Bucket Truck", vin: "1FDXX0000000A1", plate: "JTREE-1", status: "ACTIVE", assignedCrewId: insertedCrews[0]!.id },
      { name: "T-02 Chip Truck", vin: "1FDXX0000000A2", plate: "JTREE-2", status: "IN_SHOP", assignedCrewId: insertedCrews[1]!.id },
      { name: "T-03 Crane", vin: "1FDXX0000000A3", plate: "JTREE-3", status: "ACTIVE", assignedCrewId: null },
    ])
    .returning();
  const insertedEquip = await db
    .insert(equipmentTable)
    .values([
      { name: "Stihl MS-462", type: "Chainsaw", serial: "ST462-1", status: "ACTIVE", assignedTruckId: insertedTrucks[0]!.id },
      { name: "Vermeer BC1500", type: "Chipper", serial: "VR1500-2", status: "ACTIVE", assignedTruckId: insertedTrucks[1]!.id },
    ])
    .returning();
  const mech = userByEmail.get("mechanic@joshuatreeinc.test")!;
  await db.insert(maintenanceLogsTable).values([
    { truckId: insertedTrucks[0]!.id, kind: "SCHEDULED", description: "Oil + filter change", performedByUserId: mech.id, costCents: 12500 },
    { truckId: insertedTrucks[1]!.id, kind: "REPAIR", description: "Hydraulic line replacement", performedByUserId: mech.id, costCents: 87500 },
    { truckId: insertedTrucks[2]!.id, kind: "INSPECTION", description: "Annual DOT inspection", performedByUserId: mech.id, costCents: 30000 },
    { equipmentId: insertedEquip[0]!.id, kind: "SCHEDULED", description: "Chain sharpened, bar replaced", performedByUserId: mech.id, costCents: 4500 },
    { equipmentId: insertedEquip[1]!.id, kind: "REPAIR", description: "Knife set replaced", performedByUserId: mech.id, costCents: 22000 },
  ]);

  console.log("Seed complete.");
  console.log("Users (all password 'password123'):");
  for (const u of insertedUsers) console.log(`  ${u.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
