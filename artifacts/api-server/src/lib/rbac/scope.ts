import { eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  customersTable,
  quotesTable,
  jobsTable,
  crewsTable,
  crewMembersTable,
  serviceRequestsTable,
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
    // Per the FSM brief, sales sees jobs ONLY via quotes they own — not
    // every job for a customer they happen to own. We resolve a job's
    // visibility through a quote whose owner_user_id is this rep, matched
    // on the same property the job is performed at.
    return inArray(
      jobsTable.propertyId,
      sql<number[]>`(SELECT ${quotesTable.propertyId} FROM ${quotesTable} WHERE ${quotesTable.ownerUserId} = ${user.id} AND ${quotesTable.propertyId} IS NOT NULL)`,
    );
  }
  return sql`false`;
}

// Service-request (lead) scoping — leads belong to a customer, so SALES sees
// requests for customers they own. ADMIN sees everything; everyone else: deny.
export function scopeServiceRequests(user: AuthenticatedUser): SQL | undefined {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "SALES") {
    return inArray(
      serviceRequestsTable.customerId,
      sql<number[]>`(SELECT ${customersTable.id} FROM ${customersTable} WHERE ${customersTable.ownerUserId} = ${user.id})`,
    );
  }
  return sql`false`;
}
