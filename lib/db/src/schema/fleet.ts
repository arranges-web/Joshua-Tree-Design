import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { crewsTable } from "./jobs";

// NOTE on status enums: the underlying Postgres enum keeps the legacy
// "RETIRED" value for backwards compatibility. The UI renames it to
// "Out of Service" — there is no separate OUT_OF_SERVICE value in the DB.
export const truckStatusEnum = pgEnum("truck_status", [
  "ACTIVE",
  "IN_SHOP",
  "RETIRED",
]);

export const equipmentStatusEnum = pgEnum("equipment_status", [
  "ACTIVE",
  "IN_SHOP",
  "RETIRED",
]);

export const maintenanceKindEnum = pgEnum("maintenance_kind", [
  "SCHEDULED",
  "REPAIR",
  "INSPECTION",
]);

export const trucksTable = pgTable(
  "trucks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    brand: text("brand"),
    model: text("model"),
    vin: text("vin"),
    plate: text("plate"),
    status: truckStatusEnum("status").notNull().default("ACTIVE"),
    assignedCrewId: integer("assigned_crew_id").references(
      () => crewsTable.id,
      { onDelete: "set null" },
    ),
    purchasePriceCents: integer("purchase_price_cents"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    currentMileage: integer("current_mileage").notNull().default(0),
    serviceIntervalMiles: integer("service_interval_miles")
      .notNull()
      .default(5000),
    slug: text("slug"),
  },
  (t) => [
    index("trucks_status_idx").on(t.status),
    uniqueIndex("trucks_slug_uq").on(t.slug),
  ],
);

export const equipmentTable = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    brand: text("brand"),
    model: text("model"),
    serial: text("serial"),
    status: equipmentStatusEnum("status").notNull().default("ACTIVE"),
    assignedTruckId: integer("assigned_truck_id").references(
      () => trucksTable.id,
      { onDelete: "set null" },
    ),
    purchasePriceCents: integer("purchase_price_cents"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    currentHours: integer("current_hours").notNull().default(0),
    serviceIntervalHours: integer("service_interval_hours")
      .notNull()
      .default(100),
    slug: text("slug"),
  },
  (t) => [
    index("equipment_status_idx").on(t.status),
    uniqueIndex("equipment_slug_uq").on(t.slug),
  ],
);

export const maintenanceLogsTable = pgTable(
  "maintenance_logs",
  {
    id: serial("id").primaryKey(),
    truckId: integer("truck_id").references(() => trucksTable.id, {
      onDelete: "cascade",
    }),
    equipmentId: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
    kind: maintenanceKindEnum("kind").notNull().default("SCHEDULED"),
    description: text("description").notNull(),
    performedByUserId: integer("performed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    loggedByUserId: integer("logged_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    laborCostCents: integer("labor_cost_cents").notNull().default(0),
    partsCostCents: integer("parts_cost_cents").notNull().default(0),
    // costCents is the cached total = labor + parts; kept for backwards compat
    // and to keep dashboard sums fast. The API always sets it on write.
    costCents: integer("cost_cents").notNull().default(0),
    mileageAtService: integer("mileage_at_service"),
    hoursAtService: integer("hours_at_service"),
  },
  (t) => [
    index("maintenance_logs_truck_id_idx").on(t.truckId),
    index("maintenance_logs_equipment_id_idx").on(t.equipmentId),
    index("maintenance_logs_performed_at_idx").on(t.performedAt),
  ],
);

// Tracks every status transition for trucks and equipment so the team can see
// who put an asset In Shop or Out of Service and when.
export const assetStatusLogTable = pgTable(
  "asset_status_log",
  {
    id: serial("id").primaryKey(),
    assetType: text("asset_type").notNull(), // "TRUCK" | "EQUIPMENT"
    assetId: integer("asset_id").notNull(),
    oldStatus: text("old_status").notNull(),
    newStatus: text("new_status").notNull(),
    changedByUserId: integer("changed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("asset_status_log_asset_idx").on(t.assetType, t.assetId),
    index("asset_status_log_changed_at_idx").on(t.changedAt),
  ],
);

export const usageReadingsTable = pgTable(
  "usage_readings",
  {
    id: serial("id").primaryKey(),
    truckId: integer("truck_id").references(() => trucksTable.id, {
      onDelete: "cascade",
    }),
    equipmentId: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
    mileage: integer("mileage"),
    hours: integer("hours"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedByUserId: integer("recorded_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
  },
  (t) => [
    index("usage_readings_truck_id_idx").on(t.truckId),
    index("usage_readings_equipment_id_idx").on(t.equipmentId),
    index("usage_readings_recorded_at_idx").on(t.recordedAt),
  ],
);

export type Truck = typeof trucksTable.$inferSelect;
export type Equipment = typeof equipmentTable.$inferSelect;
export type MaintenanceLog = typeof maintenanceLogsTable.$inferSelect;
export type UsageReading = typeof usageReadingsTable.$inferSelect;
export type AssetStatusLog = typeof assetStatusLogTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertTruckSchema = createInsertSchema(trucksTable);
export const selectTruckSchema = createSelectSchema(trucksTable);
export const insertEquipmentSchema = createInsertSchema(equipmentTable);
export const selectEquipmentSchema = createSelectSchema(equipmentTable);
export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogsTable);
export const selectMaintenanceLogSchema = createSelectSchema(maintenanceLogsTable);
export const insertUsageReadingSchema = createInsertSchema(usageReadingsTable);
export const selectUsageReadingSchema = createSelectSchema(usageReadingsTable);
