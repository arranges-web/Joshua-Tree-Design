import { eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  customersTable,
  quotesTable,
  jobsTable,
  crewsTable,
  crewMembersTable,
} from "@workspace/db";
import type { AuthenticatedUser } from "../../middlewares/requireAuth";

// Returns a Drizzle WHERE predicate scoping a customer list to what `user` can see.
// ADMIN: no filter. SALES: only their own customers. Anyone else: deny-all.
export function scopeCustomers(user: AuthenticatedUser): SQL | undefined {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "SALES") return eq(customersTable.ownerUserId, user.id);
  return sql`false`;
}

export function scopeQuotes(user: AuthenticatedUser): SQL | undefined {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "SALES") return eq(quotesTable.ownerUserId, user.id);
  return sql`false`;
}

// Crew leads see jobs assigned to crews they lead OR are a member of.
// We use a subquery so this stays a single SQL statement.
export function scopeJobs(user: AuthenticatedUser): SQL | undefined {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "CREW_LEAD") {
    return or(
      inArray(
        jobsTable.crewId,
        sql<number[]>`(SELECT ${crewsTable.id} FROM ${crewsTable} WHERE ${crewsTable.leadUserId} = ${user.id})`,
      ),
      inArray(
        jobsTable.crewId,
        sql<number[]>`(SELECT ${crewMembersTable.crewId} FROM ${crewMembersTable} WHERE ${crewMembersTable.userId} = ${user.id})`,
      ),
    );
  }
  if (user.role === "SALES") {
    // Sales sees jobs tied to customers they own (joined via property → customer)
    return inArray(
      jobsTable.propertyId,
      sql<number[]>`(SELECT p.id FROM properties p JOIN customers c ON c.id = p.customer_id WHERE c.owner_user_id = ${user.id})`,
    );
  }
  return sql`false`;
}
