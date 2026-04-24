import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  rolesTable,
  departmentsTable,
  usersTable,
  sectionPermissionsTable,
  SECTION_KEYS,
  ROLE_KEYS,
  type RoleKey,
} from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";
import { requireSection } from "../middlewares/requireSection";
import { hashPassword } from "../lib/auth/passwords";
import { DEFAULT_MATRIX } from "../lib/rbac/matrix";

const router: IRouter = Router();

// ---------- Section permissions ----------
const updateSchema = z.object({
  roleKey: z.string().min(1),
  sectionKey: z.enum(SECTION_KEYS as unknown as [string, ...string[]]),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

router.get(
  "/admin/section-permissions",
  requireAuth,
  requireSection("admin.permissions", "view"),
  async (_req, res) => {
    const rows = await db
      .select({
        id: sectionPermissionsTable.id,
        roleKey: rolesTable.key,
        sectionKey: sectionPermissionsTable.sectionKey,
        canView: sectionPermissionsTable.canView,
        canEdit: sectionPermissionsTable.canEdit,
      })
      .from(sectionPermissionsTable)
      .innerJoin(rolesTable, eq(sectionPermissionsTable.roleId, rolesTable.id));
    res.json({ permissions: rows });
  },
);

router.post(
  "/admin/section-permissions",
  requireAuth,
  requireSection("admin.permissions", "edit"),
  async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const { roleKey, sectionKey, canView, canEdit } = parsed.data;

    const role = (
      await db.select().from(rolesTable).where(eq(rolesTable.key, roleKey)).limit(1)
    )[0];
    if (!role) {
      res.status(404).json({ error: "unknown_role" });
      return;
    }

    const existing = (
      await db
        .select()
        .from(sectionPermissionsTable)
        .where(
          and(
            eq(sectionPermissionsTable.roleId, role.id),
            eq(sectionPermissionsTable.sectionKey, sectionKey),
          ),
        )
        .limit(1)
    )[0];

    if (existing) {
      await db
        .update(sectionPermissionsTable)
        .set({ canView, canEdit })
        .where(eq(sectionPermissionsTable.id, existing.id));
    } else {
      await db
        .insert(sectionPermissionsTable)
        .values({ roleId: role.id, sectionKey, canView, canEdit });
    }
    res.json({ ok: true });
  },
);

router.get(
  "/admin/section-permissions/matrix",
  requireAuth,
  requireSection("admin.permissions", "view"),
  async (_req, res) => {
    const dbRows = await db
      .select({
        roleKey: rolesTable.key,
        sectionKey: sectionPermissionsTable.sectionKey,
        canView: sectionPermissionsTable.canView,
        canEdit: sectionPermissionsTable.canEdit,
      })
      .from(sectionPermissionsTable)
      .innerJoin(rolesTable, eq(sectionPermissionsTable.roleId, rolesTable.id));

    const overrides = new Map<string, { canView: boolean; canEdit: boolean }>();
    for (const r of dbRows) {
      overrides.set(`${r.roleKey}::${r.sectionKey}`, {
        canView: r.canView,
        canEdit: r.canEdit,
      });
    }

    const cells: Array<{
      roleKey: string;
      sectionKey: string;
      canView: boolean;
      canEdit: boolean;
    }> = [];
    for (const role of ROLE_KEYS) {
      for (const section of SECTION_KEYS) {
        const o = overrides.get(`${role}::${section}`);
        const def = DEFAULT_MATRIX[role][section];
        cells.push({
          roleKey: role,
          sectionKey: section,
          canView: o ? o.canView : def.canView,
          canEdit: o ? o.canEdit : def.canEdit,
        });
      }
    }
    res.json({
      roles: ROLE_KEYS,
      sections: SECTION_KEYS,
      cells,
    });
  },
);

// ---------- Roles & Departments ----------
router.get(
  "/admin/roles",
  requireAuth,
  requireSection("admin.users", "view"),
  async (_req, res) => {
    const rows = await db.select().from(rolesTable);
    res.json({ roles: rows });
  },
);

router.get(
  "/admin/departments",
  requireAuth,
  requireSection("admin.users", "view"),
  async (_req, res) => {
    const rows = await db.select().from(departmentsTable);
    res.json({ departments: rows });
  },
);

// ---------- Employees ----------
async function shapeEmployee(userId: number) {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      role: rolesTable.key,
      department: departmentsTable.key,
      roleId: rolesTable.id,
      departmentId: departmentsTable.id,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .innerJoin(
      departmentsTable,
      eq(usersTable.departmentId, departmentsTable.id),
    )
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

router.get(
  "/admin/users",
  requireAuth,
  requireSection("admin.users", "view"),
  async (_req, res) => {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
        role: rolesTable.key,
        department: departmentsTable.key,
        roleId: rolesTable.id,
        departmentId: departmentsTable.id,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .innerJoin(
        departmentsTable,
        eq(usersTable.departmentId, departmentsTable.id),
      );
    res.json({ employees: rows });
  },
);

router.post(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN"),
  requireSection("admin.users", "edit"),
  async (req, res) => {
    const parsed = CreateEmployeeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const { email, password, fullName, roleId, departmentId, isActive } =
      parsed.data;
    const exists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);
    if (exists[0]) {
      res.status(409).json({ error: "email_exists" });
      return;
    }
    const hashedPassword = await hashPassword(password);
    const [row] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        hashedPassword,
        fullName,
        roleId,
        departmentId,
        isActive: isActive ?? true,
      })
      .returning();
    const shaped = await shapeEmployee(row!.id);
    res.status(201).json({ employee: shaped });
  },
);

router.patch(
  "/admin/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  requireSection("admin.users", "edit"),
  async (req, res) => {
    const params = UpdateEmployeeParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateEmployeeBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (body.data.email !== undefined) patch.email = body.data.email;
    if (body.data.fullName !== undefined) patch.fullName = body.data.fullName;
    if (body.data.roleId !== undefined) patch.roleId = body.data.roleId;
    if (body.data.departmentId !== undefined)
      patch.departmentId = body.data.departmentId;
    if (body.data.isActive !== undefined) patch.isActive = body.data.isActive;
    if (body.data.password) {
      patch.hashedPassword = await hashPassword(body.data.password);
    }
    if (Object.keys(patch).length === 0) {
      const shaped = await shapeEmployee(params.data.id);
      if (!shaped) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ employee: shaped });
      return;
    }
    const [row] = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const shaped = await shapeEmployee(row.id);
    res.json({ employee: shaped });
  },
);

router.delete(
  "/admin/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  requireSection("admin.users", "edit"),
  async (req, res) => {
    const params = DeleteEmployeeParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (params.data.id === req.user!.id) {
      res.status(400).json({ error: "cannot_delete_self" });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ isActive: false })
      .where(eq(usersTable.id, params.data.id))
      .returning({ id: usersTable.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
