import { boolean, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { appointmentStatusValues } from "@/lib/appointments/appointment.types";

export const appointmentsTable = mysqlTable("appointments", {
  ref: varchar("ref", { length: 32 }).primaryKey(),
  createdAt: varchar("created_at", { length: 40 }).notNull(),
  customerHidden: boolean("customer_hidden").notNull().default(false),
  ownerHidden: boolean("owner_hidden").notNull().default(false),
  status: mysqlEnum("status", appointmentStatusValues).notNull().default("pending"),
  appointmentDateIso: varchar("appointment_date_iso", { length: 40 }).notNull(),
  appointmentDateLabel: varchar("appointment_date_label", { length: 80 }).notNull(),
  appointmentTime: varchar("appointment_time", { length: 20 }).notNull(),
  service: varchar("service", { length: 120 }).notNull(),
  barber: varchar("barber", { length: 120 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  notes: text("notes"),
});

export const customersTable = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 40 }).notNull(),
});

export const customerEmailVerificationTokensTable = mysqlTable(
  "customer_email_verification_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    expiresAt: varchar("expires_at", { length: 40 }).notNull(),
    createdAt: varchar("created_at", { length: 40 }).notNull(),
  },
);