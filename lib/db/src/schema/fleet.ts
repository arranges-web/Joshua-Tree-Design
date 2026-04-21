import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { crewsTable } from "./jobs";

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
    vin: text("vin"),
    plate: text("plate"),
    status: truckStatusEnum("status").notNull().default("ACTIVE"),
    assignedCrewId: integer("assigned_crew_id").references(
      () => crewsTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [index("trucks_status_idx").on(t.status)],
);

export const equipmentTable = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    serial: text("serial"),
    status: equipmentStatusEnum("status").notNull().default("ACTIVE"),
    assignedTruckId: integer("assigned_truck_id").references(
      () => trucksTable.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [index("equipment_status_idx").on(t.status)],
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
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    costCents: integer("cost_cents").notNull().default(0),
  },
  (t) => [
    index("maintenance_logs_truck_id_idx").on(t.truckId),
    index("maintenance_logs_equipment_id_idx").on(t.equipmentId),
    index("maintenance_logs_performed_at_idx").on(t.performedAt),
  ],
);

export type Truck = typeof trucksTable.$inferSelect;
export type Equipment = typeof equipmentTable.$inferSelect;
export type MaintenanceLog = typeof maintenanceLogsTable.$inferSelect;
