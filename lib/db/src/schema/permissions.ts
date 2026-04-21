import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { rolesTable } from "./users";

// Section keys are the units the toggle panel operates on. Routes / UI
// modules check `requireSection(key, 'view' | 'edit')`. Defaults live in
// code (rbac/matrix.ts) and are mirrored to this table on first boot so
// admins can override without redeploys.
export const SECTION_KEYS = [
  "dashboard.global",
  "customers",
  "jobs",
  "quotes",
  "invoices",
  "fleet.trucks",
  "fleet.equipment",
  "fleet.maintenance",
  "admin.users",
  "admin.permissions",
  "field.job_site",
  "field.photos",
  "field.safety",
  "sales.calendar",
  "reports.financials",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const sectionPermissionsTable = pgTable(
  "section_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    sectionKey: text("section_key").notNull(),
    canView: boolean("can_view").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
  },
  (t) => [
    uniqueIndex("section_permissions_role_section_uq").on(
      t.roleId,
      t.sectionKey,
    ),
  ],
);

export type SectionPermission = typeof sectionPermissionsTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertSectionPermissionSchema = createInsertSchema(sectionPermissionsTable);
export const selectSectionPermissionSchema = createSelectSchema(sectionPermissionsTable);
