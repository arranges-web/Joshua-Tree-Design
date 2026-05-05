import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { usersTable, departmentsTable } from "./users";
import { propertiesTable } from "./customers";

export const jobStatusEnum = pgEnum("job_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETE",
  "CANCELLED",
]);

export const photoKindEnum = pgEnum("photo_kind", [
  "BEFORE",
  "AFTER",
  "HAZARD",
  "OTHER",
]);

export const crewsTable = pgTable("crews", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  leadUserId: integer("lead_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  departmentId: integer("department_id").references(
    () => departmentsTable.id,
    { onDelete: "set null" },
  ),
});

export const crewMembersTable = pgTable(
  "crew_members",
  {
    crewId: integer("crew_id")
      .notNull()
      .references(() => crewsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.crewId, t.userId] }),
    index("crew_members_user_id_idx").on(t.userId),
  ],
);

export const jobsTable = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "restrict" }),
    crewId: integer("crew_id").references(() => crewsTable.id, {
      onDelete: "set null",
    }),
    status: jobStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("jobs_crew_id_idx").on(t.crewId),
    index("jobs_status_idx").on(t.status),
    index("jobs_scheduled_for_idx").on(t.scheduledFor),
    index("jobs_property_id_idx").on(t.propertyId),
  ],
);

export const treeInventoryTable = pgTable(
  "tree_inventory",
  {
    id: serial("id").primaryKey(),
    // Per spec: a tree inventory record is associated with a job OR a
    // property (or both). At least one must be non-null — enforced below.
    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    propertyId: integer("property_id").references(() => propertiesTable.id, {
      onDelete: "cascade",
    }),
    species: text("species").notNull(),
    dbhInches: doublePrecision("dbh_inches"),
    heightFt: doublePrecision("height_ft"),
    condition: text("condition"),
    notes: text("notes"),
  },
  (t) => [
    index("tree_inventory_job_id_idx").on(t.jobId),
    index("tree_inventory_property_id_idx").on(t.propertyId),
    check(
      "tree_inventory_job_or_property_chk",
      sql`${t.jobId} IS NOT NULL OR ${t.propertyId} IS NOT NULL`,
    ),
  ],
);

export const safetyChecklistsTable = pgTable(
  "safety_checklists",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    items: jsonb("items").notNull(),
    signedByUserId: integer("signed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    signedAt: timestamp("signed_at", { withTimezone: true }),
  },
  (t) => [index("safety_checklists_job_id_idx").on(t.jobId)],
);

export const jobPhotosTable = pgTable(
  "job_photos",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    kind: photoKindEnum("kind").notNull().default("OTHER"),
    uploadedByUserId: integer("uploaded_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("job_photos_job_id_idx").on(t.jobId)],
);

export type Crew = typeof crewsTable.$inferSelect;
export type Job = typeof jobsTable.$inferSelect;
export type TreeInventory = typeof treeInventoryTable.$inferSelect;
export type SafetyChecklist = typeof safetyChecklistsTable.$inferSelect;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertCrewSchema = createInsertSchema(crewsTable);
export const selectCrewSchema = createSelectSchema(crewsTable);
export const insertCrewMemberSchema = createInsertSchema(crewMembersTable);
export const selectCrewMemberSchema = createSelectSchema(crewMembersTable);
export const insertJobSchema = createInsertSchema(jobsTable);
export const selectJobSchema = createSelectSchema(jobsTable);
export const insertTreeInventorySchema = createInsertSchema(treeInventoryTable);
export const selectTreeInventorySchema = createSelectSchema(treeInventoryTable);
export const insertSafetyChecklistSchema = createInsertSchema(safetyChecklistsTable);
export const selectSafetyChecklistSchema = createSelectSchema(safetyChecklistsTable);
export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable);
export const selectJobPhotoSchema = createSelectSchema(jobPhotosTable);
