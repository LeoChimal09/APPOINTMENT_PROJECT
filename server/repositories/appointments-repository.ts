import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type {
  AppointmentRecord,
  AppointmentRequestInput,
  AppointmentStatus,
} from "@/lib/appointments/appointment.types";
import { getDb } from "@/server/db/client";
import { appointmentsTable } from "@/server/db/schema";

type DbAppointmentRow = typeof appointmentsTable.$inferSelect;

function generateAppointmentRef() {
  return `APT-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function toAppointmentRecord(row: DbAppointmentRow): AppointmentRecord {
  return {
    ref: row.ref,
    createdAt: row.createdAt,
    status: row.status as AppointmentStatus,
    service: row.service,
    barber: row.barber,
    dateIso: row.appointmentDateIso,
    dateLabel: row.appointmentDateLabel,
    time: row.appointmentTime,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    notes: row.notes ?? null,
  };
}

export async function getAllAppointments() {
  const db = getDb();
  const rows = await db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.createdAt));
  return rows.map(toAppointmentRecord);
}

export async function getAppointmentsByEmail(email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.customerEmail, email.trim().toLowerCase()))
    .orderBy(desc(appointmentsTable.createdAt));
  return rows.map(toAppointmentRecord);
}

export async function getAppointment(ref: string) {
  const db = getDb();
  const rows = await db.select().from(appointmentsTable).where(eq(appointmentsTable.ref, ref)).limit(1);
  const row = rows.at(0);
  return row ? toAppointmentRecord(row) : undefined;
}

export async function createAppointment(input: AppointmentRequestInput) {
  const db = getDb();
  const appointment: AppointmentRecord = {
    ref: generateAppointmentRef(),
    createdAt: new Date().toISOString(),
    status: "pending",
    ...input,
  };

  await db.insert(appointmentsTable).values({
    ref: appointment.ref,
    createdAt: appointment.createdAt,
    status: appointment.status,
    appointmentDateIso: appointment.dateIso,
    appointmentDateLabel: appointment.dateLabel,
    appointmentTime: appointment.time,
    service: appointment.service,
    barber: appointment.barber,
    customerName: appointment.customerName,
    customerEmail: appointment.customerEmail.trim().toLowerCase(),
    customerPhone: appointment.customerPhone,
    notes: appointment.notes,
  });

  return appointment;
}

export async function updateAppointmentStatus(ref: string, status: AppointmentStatus) {
  const db = getDb();
  await db.update(appointmentsTable).set({ status }).where(eq(appointmentsTable.ref, ref));
  return getAppointment(ref);
}