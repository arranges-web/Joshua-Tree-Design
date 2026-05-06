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
import { usersTable, departmentsTable } from "./users";
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

// Trucks and trailers share the same physical-asset shape (VIN, plate,
// make/model, departmental ownership). The `vehicle_type` discriminator
// lets the registry surface them as separate top-level categories while
// keeping a single insert/update code path. Trailers inherit the mileage
// columns but the UI hides them — trailers don't track usage.
export const vehicleTypeEnum = pgEnum("vehicle_type", ["TRUCK", "TRAILER"]);

export const trucksTable = pgTable(
  "trucks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull().default("TRUCK"),
    brand: text("brand"),
    model: text("model"),
    vin: text("vin"),
    plate: text("plate"),
    status: truckStatusEnum("status").notNull().default("ACTIVE"),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departmentsTable.id, { onDelete: "restrict" }),
    assignedCrewId: integer("assigned_crew_id").references(
      () => crewsTable.id,
      { onDelete: "set null" },
    ),
    lastAssignedByUserId: integer("last_assigned_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    lastAssignedAt: timestamp("last_assigned_at", { withTimezone: true }),
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

// Two non-vehicle asset categories live in this table:
//   HANDHELD — chainsaws, blowers, hand tools. Quantity > 1 supported
//              so "30 shovels" is one row with quantity=30.
//   CUSTOM   — anything else (heavy powered equipment, safety gear,
//              consumables). `customCategoryLabel` is a free-form label
//              ("Heavy Equipment", "Safety Gear") that drives grouping.
export const equipmentCategoryEnum = pgEnum("equipment_category", [
  "HANDHELD",
  "CUSTOM",
]);

export const equipmentTable = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    category: equipmentCategoryEnum("category").notNull().default("HANDHELD"),
    customCategoryLabel: text("custom_category_label"),
    quantity: integer("quantity").notNull().default(1),
    brand: text("brand"),
    model: text("model"),
    serial: text("serial"),
    status: equipmentStatusEnum("status").notNull().default("ACTIVE"),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departmentsTable.id, { onDelete: "restrict" }),
    assignedTruckId: integer("assigned_truck_id").references(
      () => trucksTable.id,
      { onDelete: "set null" },
    ),
    assignedCrewId: integer("assigned_crew_id").references(
      () => crewsTable.id,
      { onDelete: "set null" },
    ),
    lastAssignedByUserId: integer("last_assigned_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    lastAssignedAt: timestamp("last_assigned_at", { withTimezone: true }),
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
    // Receipt-tracking fields, set by the maintenance log dialog when a
    // mechanic uploads a photo of a vendor receipt and categorizes it
    // for the accountant. All four are nullable so existing rows pre-
    // dating the feature stay valid.
    vendor: text("vendor"),
    category: text("category"), // LABOR | PARTS | FUEL | OUTSOURCED | OTHER
    notes: text("notes"),
    receiptDataUrl: text("receipt_data_url"),
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

// Audit trail for crew-assignment changes. One row per change. Mirrors
// the `asset_status_log` shape so a single (assetType, assetId) pair can
// resolve back to the underlying truck/equipment row.
//   - newCrewId == null && oldCrewId != null → "returned" / unassigned
//   - newCrewId != null && oldCrewId == null → first assignment
//   - both non-null with different ids       → reassignment
export const assetAssignmentLogTable = pgTable(
  "asset_assignment_log",
  {
    id: serial("id").primaryKey(),
    assetType: text("asset_type").notNull(), // "TRUCK" | "EQUIPMENT"
    assetId: integer("asset_id").notNull(),
    oldCrewId: integer("old_crew_id").references(() => crewsTable.id, {
      onDelete: "set null",
    }),
    newCrewId: integer("new_crew_id").references(() => crewsTable.id, {
      onDelete: "set null",
    }),
    changedByUserId: integer("changed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),
  },
  (t) => [
    index("asset_assignment_log_asset_idx").on(t.assetType, t.assetId),
    index("asset_assignment_log_changed_at_idx").on(t.changedAt),
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

// Consumable items / accessories attached to a piece of equipment.
// Examples: saw chains, guide bars, blades, spark plugs, mixing oil.
export const equipmentItemsTable = pgTable(
  "equipment_items",
  {
    id: serial("id").primaryKey(),
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => equipmentTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("equipment_items_equipment_id_idx").on(t.equipmentId)],
);

export type Truck = typeof trucksTable.$inferSelect;
export type Equipment = typeof equipmentTable.$inferSelect;
export type EquipmentItem = typeof equipmentItemsTable.$inferSelect;
export type MaintenanceLog = typeof maintenanceLogsTable.$inferSelect;
export type UsageReading = typeof usageReadingsTable.$inferSelect;
export type AssetStatusLog = typeof assetStatusLogTable.$inferSelect;
export type AssetAssignmentLog = typeof assetAssignmentLogTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertTruckSchema = createInsertSchema(trucksTable);
export const selectTruckSchema = createSelectSchema(trucksTable);
export const insertEquipmentSchema = createInsertSchema(equipmentTable);
export const selectEquipmentSchema = createSelectSchema(equipmentTable);
export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogsTable);
export const selectMaintenanceLogSchema = createSelectSchema(maintenanceLogsTable);
export const insertUsageReadingSchema = createInsertSchema(usageReadingsTable);
export const selectUsageReadingSchema = createSelectSchema(usageReadingsTable);
export const insertEquipmentItemSchema = createInsertSchema(equipmentItemsTable);
export const selectEquipmentItemSchema = createSelectSchema(equipmentItemsTable);
