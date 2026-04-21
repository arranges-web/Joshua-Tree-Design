import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

export const SESSION_COOKIE = "fsm_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionOpts {
  userId: number;
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession({
  userId,
  userAgent,
  ip,
}: CreateSessionOpts): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: userAgent ?? null,
    ip: ip ?? null,
  });
  return { token, expiresAt };
}

export async function findSessionByToken(token: string) {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashToken(token)));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

export function sessionCookieOptions(expiresAt: Date) {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    expires: expiresAt,
  };
}

export function clearSessionCookieOptions() {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 0,
  };
}
