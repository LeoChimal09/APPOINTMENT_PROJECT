import { eq } from "drizzle-orm";
import type { RowDataPacket } from "mysql2/promise";
import { getDb, getPool } from "@/server/db/client";
import {
  staffMembersTable,
  staffUnavailabilityTable,
  staffWeeklyAvailabilityTable,
} from "@/server/db/schema";

export type StaffMember = {
  id: number;
  name: string;
  isActive: boolean;
};

export type StaffUnavailability = {
  id: number;
  staffId: number;
  dateIso: string;
  endDateIso: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  reason: string;
  createdAt: string;
};

export type StaffWeeklyAvailability = {
  id: number;
  staffId: number;
  weekday: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  createdAt: string;
};

const DEFAULT_STAFF: StaffMember[] = [
  { id: 1, name: "Luis", isActive: true },
  { id: 2, name: "Marcos", isActive: true },
  { id: 3, name: "Andrea", isActive: true },
];

let ensuredStaffSchemaPromise: Promise<void> | null = null;

async function ensureStaffSchema() {
  if (!ensuredStaffSchemaPromise) {
    ensuredStaffSchemaPromise = (async () => {
      const pool = getPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_members (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at VARCHAR(40) NOT NULL
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_weekly_availability (
          id INT AUTO_INCREMENT PRIMARY KEY,
          staff_id INT NOT NULL,
          weekday INT NOT NULL,
          start_time VARCHAR(20) NOT NULL,
          end_time VARCHAR(20) NOT NULL,
          is_working BOOLEAN NOT NULL DEFAULT TRUE,
          created_at VARCHAR(40) NOT NULL
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_unavailability (
          id INT AUTO_INCREMENT PRIMARY KEY,
          staff_id INT NOT NULL,
          date_iso VARCHAR(40) NOT NULL,
          reason VARCHAR(255) NOT NULL DEFAULT 'Unavailable',
          created_at VARCHAR(40) NOT NULL
        )
      `);

      const [existingColumns] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'staff_unavailability'
          AND COLUMN_NAME IN ('end_date_iso', 'start_time', 'end_time', 'is_all_day')
      `);

      const columnNames = new Set(
        (existingColumns as Array<{ COLUMN_NAME: string }>)
          .map((row) => row.COLUMN_NAME?.toLowerCase())
          .filter(Boolean),
      );

      if (!columnNames.has("end_date_iso")) {
        await pool.query(`
          ALTER TABLE staff_unavailability
          ADD COLUMN end_date_iso VARCHAR(40) NOT NULL DEFAULT ''
        `);
      }

      if (!columnNames.has("start_time")) {
        await pool.query(`
          ALTER TABLE staff_unavailability
          ADD COLUMN start_time VARCHAR(20) NULL
        `);
      }

      if (!columnNames.has("end_time")) {
        await pool.query(`
          ALTER TABLE staff_unavailability
          ADD COLUMN end_time VARCHAR(20) NULL
        `);
      }

      if (!columnNames.has("is_all_day")) {
        await pool.query(`
          ALTER TABLE staff_unavailability
          ADD COLUMN is_all_day BOOLEAN NOT NULL DEFAULT TRUE
        `);
      }

      await pool.query(`
        UPDATE staff_unavailability
        SET end_date_iso = date_iso
        WHERE end_date_iso = '' OR end_date_iso IS NULL
      `);
    })().catch((error) => {
      ensuredStaffSchemaPromise = null;
      throw error;
    });
  }

  await ensuredStaffSchemaPromise;
}

function parseTimeLabelToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, rawHour, rawMinutes, rawPeriod] = match;
  const period = rawPeriod.toUpperCase();
  let hour = Number.parseInt(rawHour, 10) % 12;
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hour) || Number.isNaN(minutes)) {
    return null;
  }

  if (period === "PM") {
    hour += 12;
  }

  return (hour * 60) + minutes;
}

function isDateWithinRange(dateIso: string, startDateIso: string, endDateIso: string) {
  return dateIso >= startDateIso && dateIso <= endDateIso;
}

function getWeekdayFromDateIso(dateIso: string) {
  const normalizedDateIso = dateIso.trim().slice(0, 10);
  return new Date(`${normalizedDateIso}T12:00:00Z`).getUTCDay();
}

export async function getAllStaff(): Promise<StaffMember[]> {
  try {
    await ensureStaffSchema();
    const db = getDb();
    const rows = await db
      .select()
      .from(staffMembersTable)
      .orderBy(staffMembersTable.name);

    if (rows.length === 0) {
      return DEFAULT_STAFF;
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
    }));
  } catch {
    // If table doesn't exist yet, return default staff
    return DEFAULT_STAFF;
  }
}

export async function getActiveStaff(): Promise<StaffMember[]> {
  try {
    await ensureStaffSchema();
    const db = getDb();
    const rows = await db
      .select()
      .from(staffMembersTable)
      .where(eq(staffMembersTable.isActive, true))
      .orderBy(staffMembersTable.name);

    if (rows.length === 0) {
      return DEFAULT_STAFF.filter((s) => s.isActive);
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
    }));
  } catch {
    // If table doesn't exist yet, return default active staff
    return DEFAULT_STAFF.filter((s) => s.isActive);
  }
}

export async function createStaffMember(name: string): Promise<StaffMember> {
  await ensureStaffSchema();
  const db = getDb();
  const result = await db.insert(staffMembersTable).values({
    name: name.trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  const id = result[0]?.insertId as number | undefined;
  if (!id) {
    throw new Error("Failed to create staff member");
  }

  return {
    id,
    name: name.trim(),
    isActive: true,
  };
}

export async function updateStaffMember(id: number, isActive: boolean): Promise<StaffMember | undefined> {
  await ensureStaffSchema();
  const db = getDb();
  await db
    .update(staffMembersTable)
    .set({ isActive })
    .where(eq(staffMembersTable.id, id));

  const rows = await db
    .select()
    .from(staffMembersTable)
    .where(eq(staffMembersTable.id, id));

  const row = rows[0];
  return row ? { id: row.id, name: row.name, isActive: row.isActive } : undefined;
}

export async function markStaffUnavailable(
  staffId: number,
  dateIso: string,
  endDateIso: string,
  startTime: string | null,
  endTime: string | null,
  isAllDay: boolean,
  reason: string
): Promise<StaffUnavailability> {
  await ensureStaffSchema();
  const db = getDb();
  const createdAt = new Date().toISOString();
  const result = await db.insert(staffUnavailabilityTable).values({
    staffId,
    dateIso,
    endDateIso,
    startTime,
    endTime,
    isAllDay,
    reason: reason.trim(),
    createdAt,
  });

  const id = result[0]?.insertId as number | undefined;
  if (!id) {
    throw new Error("Failed to mark staff unavailable");
  }

  return {
    id,
    staffId,
    dateIso,
    endDateIso,
    startTime,
    endTime,
    isAllDay,
    reason: reason.trim(),
    createdAt,
  };
}

export async function getStaffWeeklyAvailability(
  staffId: number,
): Promise<StaffWeeklyAvailability[]> {
  await ensureStaffSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(staffWeeklyAvailabilityTable)
    .where(eq(staffWeeklyAvailabilityTable.staffId, staffId));

  return rows
    .map((row) => ({
      id: row.id,
      staffId: row.staffId,
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      isWorking: row.isWorking,
      createdAt: row.createdAt,
    }))
    .sort((first, second) => first.weekday - second.weekday);
}

export async function replaceStaffWeeklyAvailability(
  staffId: number,
  entries: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    isWorking: boolean;
  }>,
): Promise<StaffWeeklyAvailability[]> {
  await ensureStaffSchema();
  const db = getDb();
  const createdAt = new Date().toISOString();

  await db.delete(staffWeeklyAvailabilityTable).where(eq(staffWeeklyAvailabilityTable.staffId, staffId));

  const rowsToInsert = entries.map((entry) => ({
    staffId,
    weekday: entry.weekday,
    startTime: entry.startTime,
    endTime: entry.endTime,
    isWorking: entry.isWorking,
    createdAt,
  }));

  if (rowsToInsert.length > 0) {
    await db.insert(staffWeeklyAvailabilityTable).values(rowsToInsert);
  }

  return getStaffWeeklyAvailability(staffId);
}

export async function isStaffUnavailableAt(
  staffId: number,
  dateIso: string,
  time: string,
): Promise<boolean> {
  await ensureStaffSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(staffUnavailabilityTable)
    .where(eq(staffUnavailabilityTable.staffId, staffId));

  const appointmentMinutes = parseTimeLabelToMinutes(time);

  return rows.some((row) => {
    const endDateIso = row.endDateIso || row.dateIso;

    if (!isDateWithinRange(dateIso, row.dateIso, endDateIso)) {
      return false;
    }

    if (row.isAllDay) {
      return true;
    }

    if (appointmentMinutes === null || !row.startTime || !row.endTime) {
      return false;
    }

    const startMinutes = parseTimeLabelToMinutes(row.startTime);
    const endMinutes = parseTimeLabelToMinutes(row.endTime);

    if (startMinutes === null || endMinutes === null) {
      return false;
    }

    return appointmentMinutes >= startMinutes && appointmentMinutes < endMinutes;
  });

}

export async function isStaffAvailableForAppointment(
  staffName: string,
  dateIso: string,
  time: string,
): Promise<boolean> {
  const activeStaff = await getActiveStaff();
  const matchedStaff = activeStaff.find(
    (member) => member.name.trim().toLowerCase() === staffName.trim().toLowerCase(),
  );

  if (!matchedStaff) {
    return false;
  }

  const appointmentMinutes = parseTimeLabelToMinutes(time);
  if (appointmentMinutes === null) {
    return false;
  }

  const weeklyAvailability = await getStaffWeeklyAvailability(matchedStaff.id);
  if (weeklyAvailability.length > 0) {
    const weekday = getWeekdayFromDateIso(dateIso);
    const matchingEntries = weeklyAvailability.filter(
      (entry) => entry.weekday === weekday && entry.isWorking,
    );

    const isWithinWeeklySchedule = matchingEntries.some((entry) => {
      const startMinutes = parseTimeLabelToMinutes(entry.startTime);
      const endMinutes = parseTimeLabelToMinutes(entry.endTime);

      if (startMinutes === null || endMinutes === null) {
        return false;
      }

      return appointmentMinutes >= startMinutes && appointmentMinutes < endMinutes;
    });

    if (!isWithinWeeklySchedule) {
      return false;
    }
  }

  return !(await isStaffUnavailableAt(matchedStaff.id, dateIso, time));
}

export async function deleteStaffMember(id: number): Promise<boolean> {
  await ensureStaffSchema();
  const db = getDb();

  // Delete related unavailability records
  await db.delete(staffUnavailabilityTable).where(eq(staffUnavailabilityTable.staffId, id));

  // Delete related weekly availability records
  await db.delete(staffWeeklyAvailabilityTable).where(eq(staffWeeklyAvailabilityTable.staffId, id));

  // Delete the staff member
  await db.delete(staffMembersTable).where(eq(staffMembersTable.id, id));

  return true;
}
