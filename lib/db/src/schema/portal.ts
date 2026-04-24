import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const customerSessionsTable = pgTable(
  "customer_sessions",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customer_sessions_token_hash_uq").on(t.tokenHash),
    index("customer_sessions_customer_id_idx").on(t.customerId),
    index("customer_sessions_expires_at_idx").on(t.expiresAt),
  ],
);

export const otpCodesTable = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    phoneE164: text("phone_e164").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("otp_codes_phone_e164_idx").on(t.phoneE164),
    index("otp_codes_expires_at_idx").on(t.expiresAt),
  ],
);

export type CustomerSession = typeof customerSessionsTable.$inferSelect;
export type OtpCode = typeof otpCodesTable.$inferSelect;
