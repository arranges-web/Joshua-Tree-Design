import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, deleteRequestsTable } from "@workspace/db";
import type { Request } from "express";

/**
 * Bulk-delete safety net.
 *
 * Goal: stop a disgruntled employee from sweeping the database
 * after a bad day. Every DELETE handler in the admin API funnels
 * through `requestDelete()`. If the requesting user has already
 * deleted (or queued) `BULK_DELETE_CAP` resources in the last
 * `WINDOW_MINUTES`, the next deletion is held back and an admin
 * has to approve it from the Delete Requests page.
 *
 * ADMIN users are exempt — they're the ones doing the approvals,
 * and we don't want to lock the founder out of clean-up tasks.
 *
 * The same table doubles as a permanent audit log of every
 * destructive action across the console.
 */

export const BULK_DELETE_CAP = 3;
export const WINDOW_MINUTES = 60;

export type DeleteOutcome =
  | {
      status: "executed";
      requestId: number;
    }
  | {
      status: "queued";
      requestId: number;
      cap: number;
      windowMinutes: number;
    };

export type RequestDeleteInput = {
  /** Authenticated request (so we know who's deleting). */
  req: Request;
  /** Short resource type tag, e.g. "customer", "job", "invoice". */
  kind: string;
  /** Numeric resource id we'd like to delete. */
  id: number;
  /** Human-readable label rendered on the admin review page. */
  label: string;
  /** Performs the actual SQL DELETE. Returns true when the row was
   *  deleted (or false if it was already gone / the caller chose to
   *  no-op). */
  execute: () => Promise<boolean>;
};

/**
 * Decide whether to execute the delete now or queue it for admin
 * approval, then log the outcome.
 *
 * Returns the structured outcome so the route handler can respond
 * with either 200 (executed) or 202 (queued). On a queued result,
 * the actual `execute()` callback is NOT called — admin approval
 * triggers it later via `approveDeleteRequest()`.
 */
export async function requestDelete(
  input: RequestDeleteInput,
): Promise<DeleteOutcome> {
  const userId = input.req.user?.id;
  if (!userId) {
    // Should never happen — callers gate on requireAuth — but be
    // defensive so an auth bug doesn't surface as an unexplained
    // 500 mid-delete.
    throw new Error("requestDelete called without authenticated user");
  }
  const role = input.req.user?.role;

  // ADMIN users always execute immediately. They still get an
  // EXECUTED audit row so the log is complete.
  if (role === "ADMIN") {
    const deleted = await input.execute();
    const [logged] = await db
      .insert(deleteRequestsTable)
      .values({
        requestedByUserId: userId,
        resourceKind: input.kind,
        resourceId: input.id,
        resourceLabel: input.label,
        status: deleted ? "EXECUTED" : "EXECUTED",
        decidedAt: new Date(),
        decidedByUserId: userId,
      })
      .returning({ id: deleteRequestsTable.id });
    return { status: "executed", requestId: logged?.id ?? 0 };
  }

  // For non-admins, count "active" rows (executed OR pending)
  // attributed to this user in the rolling window. A queued (pending)
  // delete still counts so a user can't keep stacking pending
  // requests beyond the cap.
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deleteRequestsTable)
    .where(
      and(
        eq(deleteRequestsTable.requestedByUserId, userId),
        gte(deleteRequestsTable.createdAt, windowStart),
        inArray(deleteRequestsTable.status, ["EXECUTED", "PENDING"]),
      ),
    );
  const recentCount = countRow?.n ?? 0;

  if (recentCount >= BULK_DELETE_CAP) {
    // Cap hit. Don't execute — record the request as PENDING so an
    // admin can decide.
    const [logged] = await db
      .insert(deleteRequestsTable)
      .values({
        requestedByUserId: userId,
        resourceKind: input.kind,
        resourceId: input.id,
        resourceLabel: input.label,
        status: "PENDING",
      })
      .returning({ id: deleteRequestsTable.id });
    return {
      status: "queued",
      requestId: logged?.id ?? 0,
      cap: BULK_DELETE_CAP,
      windowMinutes: WINDOW_MINUTES,
    };
  }

  // Under the cap — execute and log as EXECUTED.
  const deleted = await input.execute();
  const [logged] = await db
    .insert(deleteRequestsTable)
    .values({
      requestedByUserId: userId,
      resourceKind: input.kind,
      resourceId: input.id,
      resourceLabel: input.label,
      status: "EXECUTED",
      decidedAt: new Date(),
      decidedByUserId: userId,
    })
    .returning({ id: deleteRequestsTable.id });
  void deleted; // we keep the row whether or not the delete actually
  // matched; the audit value is "user tried to delete X at Y" either
  // way.
  return { status: "executed", requestId: logged?.id ?? 0 };
}

/**
 * Helper for route handlers: send the right HTTP response based on a
 * `DeleteOutcome`. Keeps the response shape consistent across every
 * delete endpoint so the SPA can detect queued deletes uniformly.
 */
export function sendDeleteOutcome(
  res: import("express").Response,
  outcome: DeleteOutcome,
): void {
  if (outcome.status === "executed") {
    res.json({ ok: true, requestId: outcome.requestId });
    return;
  }
  res.status(202).json({
    ok: false,
    queued: true,
    requestId: outcome.requestId,
    error: "deletion_queued_for_approval",
    cap: outcome.cap,
    windowMinutes: outcome.windowMinutes,
    message: `You've deleted ${outcome.cap} items in the last ${outcome.windowMinutes} minutes. This deletion has been queued for admin approval.`,
  });
}
