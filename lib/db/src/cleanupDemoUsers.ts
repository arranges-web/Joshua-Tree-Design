import { db, usersTable } from "./index";
import { inArray } from "drizzle-orm";

const DEMO_EMAILS = [
  "sales1@joshuatreeinc.test",
  "sales2@joshuatreeinc.test",
  "lead1@joshuatreeinc.test",
  "lead2@joshuatreeinc.test",
  "lead3@joshuatreeinc.test",
  "mechanic@joshuatreeinc.test",
  "accounting@joshuatreeinc.test",
];

/**
 * Idempotent. Removes demo/test user accounts from the database.
 * Safe to call on every boot — no-ops when those accounts don't exist.
 * Real accounts (admin@joshuatreeinc.test, jtapps@myjoshuatree.com, etc.)
 * are never touched.
 */
export async function cleanupDemoUsers(): Promise<void> {
  await db
    .delete(usersTable)
    .where(inArray(usersTable.email, DEMO_EMAILS));
}
