import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  usersTable,
  rolesTable,
  departmentsTable,
} from "@workspace/db";
import { dummyVerify, verifyPassword } from "../lib/auth/passwords";
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
  createSession,
  revokeSessionByToken,
  sessionCookieOptions,
} from "../lib/auth/sessions";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Basic brute-force protection: cap login attempts per IP. Counts both
// successes and failures (keeps the limiter logic simple and is fine for
// an internal tool with a small known IP set).
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

router.post("/login", loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const { email, password } = parsed.data;

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      hashedPassword: usersTable.hashedPassword,
      isActive: usersTable.isActive,
      role: rolesTable.key,
      department: departmentsTable.key,
      departmentId: departmentsTable.id,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .innerJoin(
      departmentsTable,
      eq(usersTable.departmentId, departmentsTable.id),
    )
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) {
    // Run a dummy bcrypt compare to keep response time roughly constant
    // and avoid leaking which emails exist / are active.
    await dummyVerify(password);
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const ok = await verifyPassword(password, row.hashedPassword);
  if (!ok) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const { token, expiresAt } = await createSession({
    userId: row.id,
    userAgent: req.get("user-agent") ?? null,
    ip: req.ip ?? null,
  });

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.json({
    user: {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      department: row.department,
      departmentId: row.departmentId,
    },
  });
});

router.post("/logout", async (req, res) => {
  const cookieToken = req.signedCookies?.[SESSION_COOKIE] as string | undefined;
  const bearerToken = extractBearer(req.headers.authorization);
  // Revoke whichever transport(s) the caller presented so logout works
  // for both browser (cookie) and mobile (Authorization: Bearer) clients.
  await Promise.all(
    [cookieToken, bearerToken]
      .filter((t): t is string => Boolean(t))
      .map((t) => revokeSessionByToken(t)),
  );
  res.cookie(SESSION_COOKIE, "", clearSessionCookieOptions());
  res.json({ ok: true });
});

function extractBearer(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim() || undefined;
}

router.get("/me", requireAuth, (req, res) => {
  const user = req.user!;
  // Build effective permissions map: default matrix merged with per-user DB overrides.
  const { DEFAULT_MATRIX } = require("../lib/rbac/matrix") as typeof import("../lib/rbac/matrix");
  const { SECTION_KEYS } = require("@workspace/db") as typeof import("@workspace/db");
  const permissions: Record<string, { canView: boolean; canEdit: boolean }> = {};
  for (const section of SECTION_KEYS) {
    const override = user.overrides[section];
    const def = DEFAULT_MATRIX[user.role]?.[section] ?? { canView: false, canEdit: false };
    permissions[section] = override ?? def;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      departmentId: user.departmentId,
      permissions,
    },
  });
});

export default router;
