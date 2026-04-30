import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type {
  AppointmentRecord,
  AppointmentRequestInput,
  AppointmentStatus,
} from "@/lib/appointments/appointment.types";
import { getDb, getPool } from "@/server/db/client";
import { appointmentsTable } from "@/server/db/schema";

type DbAppointmentRow = typeof appointmentsTable.$inferSelect;

let ensuredAppointmentsSchemaPromise: Promise<void> | null = null;

async function ensureAppointmentsSchema() {
  if (!ensuredAppointmentsSchemaPromise) {
    ensuredAppointmentsSchemaPromise = (async () => {
      const pool = getPool();
      const [existingColumns] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'appointments'
          AND COLUMN_NAME IN ('customer_hidden', 'owner_hidden')
      `);

      const columnNames = new Set(
        (existingColumns as Array<{ COLUMN_NAME: string }>)
          .map((row) => row.COLUMN_NAME?.toLowerCase())
          .filter(Boolean),
      );

      if (!columnNames.has("customer_hidden")) {
        await pool.query(`
          ALTER TABLE appointments
          ADD COLUMN customer_hidden BOOLEAN NOT NULL DEFAULT FALSE
        `);
      }

      if (!columnNames.has("owner_hidden")) {
        await pool.query(`
          ALTER TABLE appointments
          ADD COLUMN owner_hidden BOOLEAN NOT NULL DEFAULT FALSE
        `);
      }
    })().catch((error) => {
      ensuredAppointmentsSchemaPromise = null;
      throw error;
    });
  }

  await ensuredAppointmentsSchemaPromise;
}

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
  await ensureAppointmentsSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.ownerHidden, false))
    .orderBy(desc(appointmentsTable.createdAt));
  return rows.map(toAppointmentRecord);
}

export async function getAppointmentsByEmail(email: string) {
  await ensureAppointmentsSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.customerEmail, email.trim().toLowerCase()),
        eq(appointmentsTable.customerHidden, false),
      ),
    )
    .orderBy(desc(appointmentsTable.createdAt));
  return rows.map(toAppointmentRecord);
}

export async function getAppointment(ref: string) {
  await ensureAppointmentsSchema();
  const db = getDb();
  const rows = await db.select().from(appointmentsTable).where(eq(appointmentsTable.ref, ref)).limit(1);
  const row = rows.at(0);
  return row ? toAppointmentRecord(row) : undefined;
}

export async function createAppointment(input: AppointmentRequestInput) {
  await ensureAppointmentsSchema();
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
    customerHidden: false,
    ownerHidden: false,
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

export async function updateAppointmentStatus(
  ref: string,
  status: AppointmentStatus,
  notesOverride?: string | null,
) {
  await ensureAppointmentsSchema();
  const db = getDb();
  const updateValues: { status: AppointmentStatus; notes?: string | null } = { status };

  if (notesOverride !== undefined) {
    updateValues.notes = notesOverride;
  }

  await db.update(appointmentsTable).set(updateValues).where(eq(appointmentsTable.ref, ref));
  return getAppointment(ref);
}

export async function overwriteAppointmentDetails(
  ref: string,
  input: AppointmentRequestInput,
) {
  await ensureAppointmentsSchema();
  const db = getDb();
  await db
    .update(appointmentsTable)
    .set({
      status: "pending",
      appointmentDateIso: input.dateIso,
      appointmentDateLabel: input.dateLabel,
      appointmentTime: input.time,
      service: input.service,
      barber: input.barber,
      customerName: input.customerName,
      customerEmail: input.customerEmail.trim().toLowerCase(),
      customerPhone: input.customerPhone,
      notes: input.notes ?? null,
      customerHidden: false,
      ownerHidden: false,
    })
    .where(eq(appointmentsTable.ref, ref));

  return getAppointment(ref);
}

export async function deleteAppointment(ref: string) {
  await ensureAppointmentsSchema();
  const db = getDb();
  await db.delete(appointmentsTable).where(eq(appointmentsTable.ref, ref));
}

export async function hideAppointmentFromCustomer(ref: string) {
  await ensureAppointmentsSchema();
  const db = getDb();
  await db.update(appointmentsTable).set({ customerHidden: true }).where(eq(appointmentsTable.ref, ref));
  return getAppointment(ref);
}

export async function hideAppointmentFromOwner(ref: string) {
  await ensureAppointmentsSchema();
  const db = getDb();
  await db.update(appointmentsTable).set({ ownerHidden: true }).where(eq(appointmentsTable.ref, ref));
  return getAppointment(ref);
}