import { boolean, int, mysqlEnum, mysqlTable, text, unique, varchar } from "drizzle-orm/mysql-core";
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

export const customersTable = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: varchar("created_at", { length: 40 }).notNull(),
  },
  (table) => ({
    emailUnique: unique("email").on(table.email),
  }),
);

export const customerEmailVerificationTokensTable = mysqlTable(
  "customer_email_verification_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }),
    expiresAt: varchar("expires_at", { length: 40 }).notNull(),
    createdAt: varchar("created_at", { length: 40 }).notNull(),
  },
  (table) => ({
    tokenHashUnique: unique("token_hash").on(table.tokenHash),
  }),
);

export const staffMembersTable = mysqlTable("staff_members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: varchar("created_at", { length: 40 }).notNull(),
});

export const staffWeeklyAvailabilityTable = mysqlTable("staff_weekly_availability", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staff_id").notNull(),
  weekday: int("weekday").notNull(),
  startTime: varchar("start_time", { length: 20 }).notNull(),
  endTime: varchar("end_time", { length: 20 }).notNull(),
  isWorking: boolean("is_working").notNull().default(true),
  createdAt: varchar("created_at", { length: 40 }).notNull(),
});

export const businessStatusTable = mysqlTable("business_status", {
  id: int("id").autoincrement().primaryKey(),
  acceptsBookings: boolean("accepts_bookings").notNull().default(true),
  closureMessage: varchar("closure_message", { length: 255 }).notNull().default(""),
  updatedAt: varchar("updated_at", { length: 40 }).notNull(),
});

export const businessWeeklyHoursTable = mysqlTable("business_weekly_hours", {
  id: int("id").autoincrement().primaryKey(),
  weekday: int("weekday").notNull(),
  isOpen: boolean("is_open").notNull().default(true),
  startTime: varchar("start_time", { length: 20 }).notNull(),
  endTime: varchar("end_time", { length: 20 }).notNull(),
  updatedAt: varchar("updated_at", { length: 40 }).notNull(),
});