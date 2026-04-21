import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  rolesTable,
  sectionPermissionsTable,
  SECTION_KEYS,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

const updateSchema = z.object({
  roleKey: z.string().min(1),
  sectionKey: z.enum(SECTION_KEYS as unknown as [string, ...string[]]),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

router.post(
  "/admin/section-permissions",
  requireAuth,
  requireRole("ADMIN"),
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
  "/admin/section-permissions",
  requireAuth,
  requireRole("ADMIN"),
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

export default router;
