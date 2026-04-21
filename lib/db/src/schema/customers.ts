import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const customersTable = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    billingAddress: text("billing_address"),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("customers_owner_user_id_idx").on(t.ownerUserId)],
);

export const propertiesTable = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    city: text("city").notNull(),
    zip: text("zip").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    notes: text("notes"),
  },
  (t) => [index("properties_customer_id_idx").on(t.customerId)],
);

export type Customer = typeof customersTable.$inferSelect;
export type Property = typeof propertiesTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertCustomerSchema = createInsertSchema(customersTable);
export const selectCustomerSchema = createSelectSchema(customersTable);
export const insertPropertySchema = createInsertSchema(propertiesTable);
export const selectPropertySchema = createSelectSchema(propertiesTable);
