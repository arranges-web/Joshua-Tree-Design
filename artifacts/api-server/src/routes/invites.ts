import { Router, type IRouter } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { eq, isNull, and, desc, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  invitesTable,
  usersTable,
  rolesTable,
  departmentsTable,
  ROLE_KEYS,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
} from "../lib/auth/sessions";

const router: IRouter = Router();

const DEFAULT_EXPIRY_DAYS = 14;

function generateToken(): string {
  // 32 bytes of entropy → 43-char base64url string. Plenty for a
  // single-use claim URL; matches the shape of password-reset
  // tokens in well-behaved auth systems.
  return randomBytes(32).toString("base64url");
}

function publicInvite(row: typeof invitesTable.$inferSelect, opts: {
  roleKey?: string;
  deptKey?: string;
  deptLabel?: string;
  createdByName?: string | null;
}) {
  return {
    id: row.id,
    token: row.token,
    email: row.email,
    fullName: row.fullName,
    roleId: row.roleId,
    roleKey: opts.roleKey ?? null,
    departmentId: row.departmentId,
    departmentKey: opts.deptKey ?? null,
    departmentLabel: opts.deptLabel ?? null,
    createdByUserId: row.createdByUserId,
    createdByName: opts.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    acceptedByUserId: row.acceptedByUserId,
    status: row.acceptedAt
      ? ("accepted" as const)
      : row.revokedAt
        ? ("revoked" as const)
        : row.expiresAt.getTime() < Date.now()
          ? ("expired" as const)
          : ("pending" as const),
  };
}

// ---------- ADMIN: create / list / revoke ----------

const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1).max(120).optional(),
  roleKey: z.enum(ROLE_KEYS),
  departmentId: z.number().int().positive(),
  expiresInDays: z.number().int().min(1).max(60).optional(),
});

router.post("/invites", requireAuth, async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const [role] = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.key, parsed.data.roleKey));
  if (!role) {
    res.status(400).json({ error: "role_not_found" });
    return;
  }
  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.id, parsed.data.departmentId));
  if (!dept) {
    res.status(400).json({ error: "department_not_found" });
    return;
  }

  const expiresAt = new Date(
    Date.now() +
      (parsed.data.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86_400_000,
  );
  const token = generateToken();

  const [row] = await db
    .insert(invitesTable)
    .values({
      token,
      email: parsed.data.email,
      fullName: parsed.data.fullName ?? null,
      roleId: role.id,
      departmentId: dept.id,
      createdByUserId: req.user.id,
      expiresAt,
    })
    .returning();
  if (!row) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }
  res.status(201).json({
    invite: publicInvite(row, {
      roleKey: role.key,
      deptKey: dept.key,
      deptLabel: dept.label,
      createdByName: req.user.fullName ?? null,
    }),
  });
});

router.get("/invites", requireAuth, async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  // Join role + dept + creator name so the UI doesn't need a
  // second round trip per row.
  const rows = await db
    .select({
      invite: invitesTable,
      roleKey: rolesTable.key,
      deptKey: departmentsTable.key,
      deptLabel: departmentsTable.label,
      createdByName: usersTable.fullName,
    })
    .from(invitesTable)
    .leftJoin(rolesTable, eq(invitesTable.roleId, rolesTable.id))
    .leftJoin(
      departmentsTable,
      eq(invitesTable.departmentId, departmentsTable.id),
    )
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .orderBy(desc(invitesTable.createdAt));
  res.json({
    invites: rows.map((r) =>
      publicInvite(r.invite, {
        roleKey: r.roleKey ?? undefined,
        deptKey: r.deptKey ?? undefined,
        deptLabel: r.deptLabel ?? undefined,
        createdByName: r.createdByName,
      }),
    ),
  });
});

router.post("/invites/:id/revoke", requireAuth, async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const [row] = await db
    .update(invitesTable)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(invitesTable.id, id), isNull(invitesTable.acceptedAt)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "not_found_or_already_used" });
    return;
  }
  res.json({ ok: true });
});

// ---------- PUBLIC: lookup + accept ----------

// Look up a single invite by its token. Returns metadata the
// accept page needs to render (suggested email, role, dept, who
// invited you). Public on purpose — possession of the token IS
// the auth gate.
router.get("/invites/lookup/:token", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 16) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }
  const [row] = await db
    .select({
      invite: invitesTable,
      roleKey: rolesTable.key,
      deptKey: departmentsTable.key,
      deptLabel: departmentsTable.label,
      createdByName: usersTable.fullName,
    })
    .from(invitesTable)
    .leftJoin(rolesTable, eq(invitesTable.roleId, rolesTable.id))
    .leftJoin(
      departmentsTable,
      eq(invitesTable.departmentId, departmentsTable.id),
    )
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .where(eq(invitesTable.token, token));
  if (!row) {
    res.status(404).json({ error: "invite_not_found" });
    return;
  }
  if (row.invite.acceptedAt) {
    res.status(410).json({ error: "invite_already_used" });
    return;
  }
  if (row.invite.revokedAt) {
    res.status(410).json({ error: "invite_revoked" });
    return;
  }
  if (row.invite.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error: "invite_expired" });
    return;
  }
  // Strip the token from the response — the URL already carries it,
  // and we don't want to surface it again.
  const { token: _t, ...invite } = publicInvite(row.invite, {
    roleKey: row.roleKey ?? undefined,
    deptKey: row.deptKey ?? undefined,
    deptLabel: row.deptLabel ?? undefined,
    createdByName: row.createdByName,
  });
  void _t;
  res.json({ invite });
});

const acceptInviteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8).max(200),
});

router.post("/invites/:token/accept", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 16) {
    res.status(400).json({ error: "invalid_token" });
    return;
  }
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  // SELECT … FOR UPDATE-equivalent: re-fetch and re-check claim
  // state right before we flip acceptedAt. Drizzle on Postgres
  // doesn't have a direct FOR UPDATE helper here, but the UPDATE
  // below uses a WHERE clause that fails if another claim landed
  // first, so a duplicate POST returns "already used".
  const [row] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.token, token));
  if (!row) {
    res.status(404).json({ error: "invite_not_found" });
    return;
  }
  if (row.acceptedAt) {
    res.status(410).json({ error: "invite_already_used" });
    return;
  }
  if (row.revokedAt) {
    res.status(410).json({ error: "invite_revoked" });
    return;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error: "invite_expired" });
    return;
  }

  const finalEmail = (parsed.data.email ?? row.email).toLowerCase();
  // Email must not collide with an existing user.
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, finalEmail))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "email_taken" });
    return;
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: finalEmail,
      fullName: parsed.data.fullName,
      hashedPassword,
      roleId: row.roleId,
      departmentId: row.departmentId,
      isActive: true,
    })
    .returning();
  if (!user) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }

  // Flip the invite to accepted. Guarded by acceptedAt IS NULL so
  // two concurrent accept requests can't both succeed — second one
  // gets the early "invite_already_used" guard above on its retry.
  const claim = await db
    .update(invitesTable)
    .set({ acceptedAt: new Date(), acceptedByUserId: user.id })
    .where(
      and(eq(invitesTable.id, row.id), isNull(invitesTable.acceptedAt)),
    )
    .returning({ id: invitesTable.id });
  if (claim.length === 0) {
    // Rare race: another acceptor won. Roll back the user we just
    // created so we don't leak a half-claimed seat.
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    res.status(410).json({ error: "invite_already_used" });
    return;
  }

  // Look up the role/dept keys for the session response so the SPA
  // can land the user directly on the admin home without an extra
  // /me round trip.
  const [meta] = await db
    .select({
      roleKey: rolesTable.key,
      deptKey: departmentsTable.key,
      deptLabel: departmentsTable.label,
    })
    .from(rolesTable)
    .innerJoin(departmentsTable, gt(departmentsTable.id, 0))
    .where(
      and(
        eq(rolesTable.id, user.roleId),
        eq(departmentsTable.id, user.departmentId),
      ),
    );

  const { token: sessionToken, expiresAt } = await createSession({
    userId: user.id,
    userAgent: req.get("user-agent") ?? null,
    ip: req.ip ?? null,
  });
  res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions(expiresAt));
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: meta?.roleKey ?? null,
      department: meta?.deptKey ?? null,
      departmentId: user.departmentId,
      departmentLabel: meta?.deptLabel ?? null,
    },
  });
});

export default router;
