import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { usersTable, departmentsTable, rolesTable } from "./users";

/**
 * Team-invite tokens. The founder generates one row per teammate
 * they want to onboard; the token goes into a shareable URL
 * (`/invite/<token>`) that the recipient opens to claim the seat —
 * they fill in their name + password and a real `users` row is
 * created with the role + department pre-set by whoever issued the
 * invite. Each token is single-use (acceptedAt flips when claimed)
 * and time-bounded (expiresAt, default +14 days).
 */
export const invitesTable = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    // URL-safe random string, never reused. Stored in plaintext on
    // purpose — knowing the token IS the claim, same shape as
    // password-reset links.
    token: text("token").notNull(),
    // Suggested email; the recipient can override on accept.
    email: text("email").notNull(),
    fullName: text("full_name"),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "restrict" }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departmentsTable.id, { onDelete: "restrict" }),
    createdByUserId: integer("created_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: integer("accepted_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    uniqueIndex("invites_token_uq").on(t.token),
    index("invites_email_idx").on(t.email),
    index("invites_created_at_idx").on(t.createdAt),
  ],
);

export type Invite = typeof invitesTable.$inferSelect;
