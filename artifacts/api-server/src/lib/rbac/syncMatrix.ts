import { eq } from "drizzle-orm";
import {
  db,
  rolesTable,
  sectionPermissionsTable,
  SECTION_KEYS,
  ROLE_KEYS,
} from "@workspace/db";
import { DEFAULT_MATRIX } from "./matrix";
import { logger } from "../logger";

/**
 * Mirrors the in-code DEFAULT_MATRIX into the section_permissions table on
 * boot. Existing rows are LEFT ALONE — admin overrides win. Only missing
 * (role, section) pairs are inserted. Safe to run on every boot.
 */
export async function syncDefaultPermissionMatrix(): Promise<void> {
  const roles = await db.select().from(rolesTable);
  if (roles.length === 0) {
    logger.warn("syncDefaultPermissionMatrix: no roles in DB yet, skipping");
    return;
  }

  let inserted = 0;
  for (const role of roles) {
    if (!ROLE_KEYS.includes(role.key as (typeof ROLE_KEYS)[number])) continue;
    const existing = await db
      .select({ sectionKey: sectionPermissionsTable.sectionKey })
      .from(sectionPermissionsTable)
      .where(eq(sectionPermissionsTable.roleId, role.id));
    const have = new Set(existing.map((r) => r.sectionKey));
    const defaults =
      DEFAULT_MATRIX[role.key as (typeof ROLE_KEYS)[number]] ?? {};

    for (const section of SECTION_KEYS) {
      if (have.has(section)) continue;
      const perm = defaults[section];
      if (!perm) continue;
      await db.insert(sectionPermissionsTable).values({
        roleId: role.id,
        sectionKey: section,
        canView: perm.canView,
        canEdit: perm.canEdit,
      });
      inserted += 1;
    }
  }

  if (inserted > 0) {
    logger.info({ inserted }, "Mirrored default permission rows on boot");
  }
}
