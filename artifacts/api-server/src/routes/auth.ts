import { Router, type IRouter } from "express";
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

router.post("/login", async (req, res) => {
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
    },
  });
});

router.post("/logout", async (req, res) => {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
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
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
    },
  });
});

export default router;
