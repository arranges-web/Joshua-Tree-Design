import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Audit + approval log for destructive actions across the admin
 * console.  Every DELETE handler funnels through `requestDelete()`
 * (artifacts/api-server/src/lib/deleteGuard.ts) which inserts a row
 * here:
 *
 *   status = "EXECUTED" — user was under the per-hour cap (or is an
 *     ADMIN); the row records what got deleted and when.
 *   status = "PENDING"  — user has hit the 3-per-hour cap; the
 *     deletion is held back and queued for admin approval.
 *   status = "APPROVED" — an admin approved a PENDING request and
 *     the actual delete has now been performed.
 *   status = "DENIED"   — an admin denied the request; the resource
 *     stays put.
 *
 * Deliberately stores `resourceLabel` so the admin review screen
 * doesn't have to JOIN against five different tables to show "what
 * are you about to delete." If the underlying row vanishes between
 * request and approval, the label is still informative.
 */
export const deleteRequestsTable = pgTable(
  "delete_requests",
  {
    id: serial("id").primaryKey(),
    requestedByUserId: integer("requested_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    resourceKind: text("resource_kind").notNull(),
    resourceId: integer("resource_id").notNull(),
    // Human-readable label, e.g. "Customer: Hank Homeowner" or
    // "Maintenance log #42 (T-01 Bucket Truck — $87.50)".
    resourceLabel: text("resource_label"),
    reason: text("reason"),
    status: text("status").notNull().default("EXECUTED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByUserId: integer("decided_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    index("delete_requests_user_created_idx").on(
      t.requestedByUserId,
      t.createdAt,
    ),
    index("delete_requests_status_idx").on(t.status),
  ],
);

export type DeleteRequest = typeof deleteRequestsTable.$inferSelect;
