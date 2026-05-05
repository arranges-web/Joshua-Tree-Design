import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Role keys (kept as a TS const for type-safety). The actual `roles` table
// is the source of truth at runtime so admins can extend roles via the
// permission panel without code changes.
export const ROLE_KEYS = [
  "ADMIN",
  "SALES",
  "CREW_LEAD",
  "MECHANIC",
  "ACCOUNTING_MANAGER",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const DEPARTMENT_KEYS = ["Admin", "Lawn", "Landscaping", "Pest", "TreeService", "Irrigation"] as const;
export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number];

export const rolesTable = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("roles_key_uq").on(t.key)],
);

export const departmentsTable = pgTable(
  "departments",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("departments_key_uq").on(t.key)],
);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    hashedPassword: text("hashed_password").notNull(),
    fullName: text("full_name").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "restrict" }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departmentsTable.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_id_idx").on(t.roleId),
    index("users_department_id_idx").on(t.departmentId),
  ],
);

export const sessionsTable = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

export type Role = typeof rolesTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertRoleSchema = createInsertSchema(rolesTable);
export const selectRoleSchema = createSelectSchema(rolesTable);
export const insertDepartmentSchema = createInsertSchema(departmentsTable);
export const selectDepartmentSchema = createSelectSchema(departmentsTable);
export const insertUserSchema = createInsertSchema(usersTable);
export const selectUserSchema = createSelectSchema(usersTable);
export const insertSessionSchema = createInsertSchema(sessionsTable);
export const selectSessionSchema = createSelectSchema(sessionsTable);
