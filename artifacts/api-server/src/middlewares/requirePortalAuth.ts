import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, customersTable, type Customer } from "@workspace/db";
import {
  findPortalSessionByToken,
  PORTAL_SESSION_COOKIE,
} from "../lib/auth/portalSessions";
import { SESSION_COOKIE } from "../lib/auth/sessions";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: Customer;
    }
  }
}

// Portal auth middleware. Hard-rejects requests that present a staff
// cookie even if a portal cookie is also present — that prevents a
// staff session from accidentally authenticating against /api/portal/*
// (and prevents the inverse, see requireAuth which only reads the staff
// cookie). Cross-cookie isolation is the central security boundary of
// the portal task.
export const requirePortalAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const staffCookie = req.signedCookies?.[SESSION_COOKIE] as
    | string
    | undefined;
  if (staffCookie) {
    res.status(401).json({ error: "staff_session_not_allowed_here" });
    return;
  }

  const token = req.signedCookies?.[PORTAL_SESSION_COOKIE] as
    | string
    | undefined;
  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const session = await findPortalSessionByToken(token);
  if (!session) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, session.customerId))
    .limit(1);
  const customer = rows[0];
  if (!customer) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  req.customer = customer;
  next();
};
