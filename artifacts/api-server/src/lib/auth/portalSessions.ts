import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, customerSessionsTable } from "@workspace/db";

// Distinct from the staff cookie ("fsm_session") so that a portal token
// can never be misread as a staff token (and vice versa).
export const PORTAL_SESSION_COOKIE = "jt_portal_session";
export const PORTAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function generatePortalSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatePortalSessionOpts {
  customerId: number;
  userAgent?: string | null;
  ip?: string | null;
}

export async function createPortalSession({
  customerId,
  userAgent,
  ip,
}: CreatePortalSessionOpts): Promise<{ token: string; expiresAt: Date }> {
  const token = generatePortalSessionToken();
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_MS);
  await db.insert(customerSessionsTable).values({
    customerId,
    tokenHash: hashPortalToken(token),
    expiresAt,
    userAgent: userAgent ?? null,
    ip: ip ?? null,
  });
  return { token, expiresAt };
}

export async function findPortalSessionByToken(token: string) {
  const rows = await db
    .select()
    .from(customerSessionsTable)
    .where(eq(customerSessionsTable.tokenHash, hashPortalToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function revokePortalSessionByToken(token: string): Promise<void> {
  await db
    .delete(customerSessionsTable)
    .where(eq(customerSessionsTable.tokenHash, hashPortalToken(token)));
}

export async function purgeExpiredPortalSessions(): Promise<void> {
  await db
    .delete(customerSessionsTable)
    .where(lt(customerSessionsTable.expiresAt, new Date()));
}

export function portalSessionCookieOptions(expiresAt: Date) {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    signed: true,
    path: "/",
    expires: expiresAt,
  };
}

export function clearPortalSessionCookieOptions() {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    signed: true,
    path: "/",
    maxAge: 0,
  };
}
