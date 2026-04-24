import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { customersTable, propertiesTable } from "./customers";
import { quotesTable } from "./quotes";

// Mirrors the marketing site service catalogue (Joshua Tree Inc. /services)
// so leads coming in from the public site / portal map cleanly.
export const serviceTypeEnum = pgEnum("service_type", [
  "TREE_REMOVAL",
  "TRIMMING_PRUNING",
  "MANGROVE_CARE",
  "STUMP_GRINDING",
  "EMERGENCY_STORM",
  "CRANE_ASSISTED",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "DISMISSED",
]);

export const requestSourceEnum = pgEnum("request_source", [
  "PORTAL",
  "PHONE",
  "WEB",
  "WALKIN",
]);

export const serviceRequestsTable = pgTable(
  "service_requests",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    propertyId: integer("property_id").references(() => propertiesTable.id, {
      onDelete: "set null",
    }),
    service: serviceTypeEnum("service").notNull(),
    notes: text("notes"),
    preferredWindowStart: timestamp("preferred_window_start", {
      withTimezone: true,
    }),
    preferredWindowEnd: timestamp("preferred_window_end", {
      withTimezone: true,
    }),
    status: requestStatusEnum("status").notNull().default("NEW"),
    source: requestSourceEnum("source").notNull().default("PORTAL"),
    convertedQuoteId: integer("converted_quote_id").references(
      () => quotesTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_requests_customer_id_idx").on(t.customerId),
    index("service_requests_status_idx").on(t.status),
    index("service_requests_created_at_idx").on(t.createdAt),
  ],
);

export type ServiceRequest = typeof serviceRequestsTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertServiceRequestSchema =
  createInsertSchema(serviceRequestsTable);
export const selectServiceRequestSchema =
  createSelectSchema(serviceRequestsTable);
