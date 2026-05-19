import { Router, type IRouter } from "express";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  rolesTable,
  departmentsTable,
} from "@workspace/db";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
} from "../lib/auth/sessions";

const router: IRouter = Router();

/**
 * Returns true when the database has no users at all — i.e. this is
 * a brand-new install and the founder needs to create the first
 * admin account. We expose this publicly (no auth) so the SPA can
 * decide whether to redirect to /setup before showing the login
 * form.
 *
 * Once any user exists, this endpoint always returns false; the
 * /setup/founder endpoint also re-checks and rejects if a user
 * showed up between the two calls.
 */
router.get("/setup/needs-setup", async (_req, res) => {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(usersTable);
  const needsSetup = (row?.n ?? 0) === 0;
  res.json({ needsSetup });
});

const founderSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

/**
 * Founder bootstrap: creates the very first ADMIN user. Only works
 * when the DB has zero users. Idempotent-by-race: we re-check the
 * count inside the same request to defend against two concurrent
 * setup attempts.
 *
 * On success, immediately issues a session cookie so the founder
 * lands signed-in on the admin console.
 */
router.post("/setup/founder", async (req, res) => {
  const parsed = founderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  // Re-check the empty-DB guard within the request.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(usersTable);
  if ((row?.n ?? 0) > 0) {
    res.status(409).json({ error: "setup_already_complete" });
    return;
  }

  // Resolve ADMIN role + Admin department. These are guaranteed to
  // exist because backfillDepartments runs before the server
  // accepts requests, but we still guard defensively.
  const [adminRole] = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.key, "ADMIN"));
  const [adminDept] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.key, "Admin"));
  if (!adminRole || !adminDept) {
    res.status(500).json({ error: "core_seed_missing" });
    return;
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      hashedPassword,
      roleId: adminRole.id,
      departmentId: adminDept.id,
      isActive: true,
    })
    .returning();
  if (!user) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }

  const { token, expiresAt } = await createSession({
    userId: user.id,
    userAgent: req.get("user-agent") ?? null,
    ip: req.ip ?? null,
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: adminRole.key,
      department: adminDept.key,
      departmentId: adminDept.id,
    },
  });
});

export default router;
