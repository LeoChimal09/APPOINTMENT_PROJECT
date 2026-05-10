import { and, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type {
  AppointmentRecord,
  AppointmentRequestInput,
  AppointmentStatus,
} from "@/lib/appointments/appointment.types";
import { getDb, getPool } from "@/server/db/client";
import { appointmentsTable } from "@/server/db/schema";
import {
  printAdminAppointmentExpiredNotification,
  printCustomerAppointmentExpiredNotification,
} from "@/lib/mailer";

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

      // Migrate status enum to include 'expired' if not already present
      const [enumRows] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'appointments'
          AND COLUMN_NAME = 'status'
      `);

      const enumType = (enumRows as Array<{ COLUMN_TYPE: string }>)[0]?.COLUMN_TYPE ?? "";
      if (!enumType.includes("'expired'")) {
        await pool.query(`
          ALTER TABLE appointments
          MODIFY COLUMN status ENUM('pending','accepted','denied','cancelled','completed','expired') NOT NULL DEFAULT 'pending'
        `);
      }

      // Cleanup for legacy behavior: fully hidden records should not remain in storage.
      await pool.query(`
        DELETE FROM appointments
        WHERE customer_hidden = TRUE
          AND owner_hidden = TRUE
      `);
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

export async function cancelAcceptedAppointmentsForBarberOnDate(
  barber: string,
  dateIso: string,
  cancellationNote?: string | null,
) {
  await ensureAppointmentsSchema();
  const db = getDb();

  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.barber, barber),
        eq(appointmentsTable.appointmentDateIso, dateIso),
        eq(appointmentsTable.status, "accepted"),
      ),
    );

  if (rows.length === 0) {
    return [] as AppointmentRecord[];
  }

  const trimmedNote = cancellationNote?.trim() ? cancellationNote.trim() : null;
  const updatedAppointments: AppointmentRecord[] = [];

  for (const row of rows) {
    const nextNotes = trimmedNote
      ? row.notes?.trim()
        ? `${row.notes.trim()}\n\nAdmin cancellation note: ${trimmedNote}`
        : `Admin cancellation note: ${trimmedNote}`
      : row.notes;

    await db
      .update(appointmentsTable)
      .set({
        status: "cancelled",
        notes: nextNotes,
      })
      .where(eq(appointmentsTable.ref, row.ref));

    updatedAppointments.push(
      toAppointmentRecord({
        ...row,
        status: "cancelled",
        notes: nextNotes,
      }),
    );
  }

  return updatedAppointments;
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

async function hideAndMaybeDeleteAppointment(ref: string, scope: "customer" | "owner") {
  await ensureAppointmentsSchema();
  const db = getDb();

  if (scope === "customer") {
    await db.update(appointmentsTable).set({ customerHidden: true }).where(eq(appointmentsTable.ref, ref));
  }

  if (scope === "owner") {
    await db.update(appointmentsTable).set({ ownerHidden: true }).where(eq(appointmentsTable.ref, ref));
  }

  // Purge the record only when both sides are hidden in the persisted row state.
  await db.delete(appointmentsTable).where(
    and(
      eq(appointmentsTable.ref, ref),
      eq(appointmentsTable.customerHidden, true),
      eq(appointmentsTable.ownerHidden, true),
    ),
  );

  return getAppointment(ref);
}

export async function hideAppointmentFromCustomer(ref: string) {
  return hideAndMaybeDeleteAppointment(ref, "customer");
}

export async function hideAppointmentFromOwner(ref: string) {
  return hideAndMaybeDeleteAppointment(ref, "owner");
}

export async function isTimeSlotAvailable(
  dateIso: string,
  time: string,
  barber: string
): Promise<boolean> {
  await ensureAppointmentsSchema();
  const db = getDb();

  // Check if there's an accepted or completed appointment at this time slot with the same barber
  const conflictingAppointments = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.appointmentDateIso, dateIso),
        eq(appointmentsTable.appointmentTime, time),
        eq(appointmentsTable.barber, barber),
        // Only block if the appointment is accepted or completed
        inArray(appointmentsTable.status, ["accepted", "completed"]),
        eq(appointmentsTable.ownerHidden, false)
      )
    );

  return conflictingAppointments.length === 0;
}

function parseTimeLabelToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, rawHour, rawMinutes, rawPeriod] = match;
  let hour = Number.parseInt(rawHour, 10) % 12;
  const minutes = Number.parseInt(rawMinutes, 10);
  if (rawPeriod.toUpperCase() === "PM") {
    hour += 12;
  }

  return hour * 60 + minutes;
}

export async function expireStalePendingAppointments(): Promise<number> {
  await ensureAppointmentsSchema();
  const db = getDb();

  // Load all pending appointments
  const pending = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.status, "pending"));

  if (pending.length === 0) {
    return 0;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const expiredRefs: string[] = [];

  for (const row of pending) {
    const dateIso = row.appointmentDateIso.trim().slice(0, 10);
    const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      continue;
    }

    const [, rawYear, rawMonth, rawDay] = match;
    const year = Number.parseInt(rawYear, 10);
    const month = Number.parseInt(rawMonth, 10);
    const day = Number.parseInt(rawDay, 10);

    const apptMinutes = parseTimeLabelToMinutes(row.appointmentTime);
    if (apptMinutes === null) {
      continue;
    }

    const apptHour = Math.floor(apptMinutes / 60);
    const apptMin = apptMinutes % 60;
    const cutoffMs = new Date(year, month - 1, day, apptHour, apptMin, 0, 0).getTime();

    if (nowMs > cutoffMs) {
      expiredRefs.push(row.ref);
    }
  }

  if (expiredRefs.length === 0) {
    return 0;
  }

  const expiredRefSet = new Set(expiredRefs);
  const expiredRows = pending.filter((row) => expiredRefSet.has(row.ref));

  await db
    .update(appointmentsTable)
    .set({ status: "expired" })
    .where(and(
      inArray(appointmentsTable.ref, expiredRefs),
      eq(appointmentsTable.status, "pending"),
    ));

  for (const row of expiredRows) {
    printCustomerAppointmentExpiredNotification({
      ref: row.ref,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      service: row.service,
      barber: row.barber,
      dateLabel: row.appointmentDateLabel,
      time: row.appointmentTime,
    });

    printAdminAppointmentExpiredNotification({
      ref: row.ref,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      service: row.service,
      barber: row.barber,
      dateLabel: row.appointmentDateLabel,
      time: row.appointmentTime,
    });
  }

  return expiredRefs.length;
}