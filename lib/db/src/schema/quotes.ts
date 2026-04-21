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
import { customersTable, propertiesTable } from "./customers";
import { jobsTable } from "./jobs";

export const quoteStatusEnum = pgEnum("quote_status", [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
]);

export const quotesTable = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "restrict" }),
    propertyId: integer("property_id").references(() => propertiesTable.id, {
      onDelete: "set null",
    }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: quoteStatusEnum("status").notNull().default("DRAFT"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("quotes_owner_user_id_idx").on(t.ownerUserId),
    index("quotes_status_idx").on(t.status),
    index("quotes_customer_id_idx").on(t.customerId),
  ],
);

export const quoteLineItemsTable = pgTable(
  "quote_line_items",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotesTable.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    qty: integer("qty").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
  },
  (t) => [index("quote_line_items_quote_id_idx").on(t.quoteId)],
);

export const invoicesTable = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "restrict" }),
    status: invoiceStatusEnum("status").notNull().default("DRAFT"),
    totalCents: integer("total_cents").notNull().default(0),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("invoices_customer_id_idx").on(t.customerId),
    index("invoices_status_idx").on(t.status),
  ],
);

export type Quote = typeof quotesTable.$inferSelect;
export type QuoteLineItem = typeof quoteLineItemsTable.$inferSelect;
export type Invoice = typeof invoicesTable.$inferSelect;

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const insertQuoteSchema = createInsertSchema(quotesTable);
export const selectQuoteSchema = createSelectSchema(quotesTable);
export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItemsTable);
export const selectQuoteLineItemSchema = createSelectSchema(quoteLineItemsTable);
export const insertInvoiceSchema = createInsertSchema(invoicesTable);
export const selectInvoiceSchema = createSelectSchema(invoicesTable);
