/* eslint-disable no-console */
import { db, populateData, usersTable, customersTable } from "../src";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Wiping existing data…");
  // Restart sequences and cascade so every table is clean.
  await db.execute(sql`TRUNCATE
    section_permissions,
    maintenance_logs,
    equipment,
    trucks,
    service_requests,
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
    customer_sessions,
    otp_codes,
    customers,
    sessions,
    users,
    departments,
    roles
    RESTART IDENTITY CASCADE`);

  console.log("Seeding demo data…");
  await populateData();

  console.log("\nSeed complete.");
  console.log("Staff logins (all password: password123):");
  const users = await db
    .select({ email: usersTable.email, name: usersTable.fullName })
    .from(usersTable);
  for (const u of users) console.log(`  ${u.email}  (${u.name})`);

  console.log("\nCustomer portal phones (use for /portal/ login):");
  const cxs = await db
    .select({ name: customersTable.fullName, phone: customersTable.phoneE164 })
    .from(customersTable);
  for (const c of cxs)
    console.log(`  ${(c.name ?? "").padEnd(22)} ${c.phone ?? "—"}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
