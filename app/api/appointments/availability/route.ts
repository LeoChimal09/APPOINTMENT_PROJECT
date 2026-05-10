import { getDb } from "@/server/db/client";
import { businessWeeklyHoursTable, staffMembersTable, staffWeeklyAvailabilityTable, appointmentsTable } from "@/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { parseTimeLabelToMinutes } from "@/lib/building-hours";

type AvailabilityResult = {
  available: boolean;
  reason: string;
  blockedBy: string | null;
  rank: number | null;
};

type MonthlyAvailabilityResult = {
  available: boolean;
};

function parseHourLabel(value: string) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue < 0 || parsedValue > 23) {
    return null;
  }

  return parsedValue;
}

function getDaysInMonth(monthValue: string) {
  const match = monthValue.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, rawYear, rawMonth] = match;
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDateIso(monthValue: string, day: number) {
  return `${monthValue}-${String(day).padStart(2, "0")}`;
}

async function getMonthlyAvailability(monthValue: string, barber: string): Promise<Record<string, MonthlyAvailabilityResult>> {
  const daysInMonth = getDaysInMonth(monthValue);
  if (daysInMonth === null) {
    throw new Error("Invalid month");
  }

  const monthStart = buildDateIso(monthValue, 1);
  const monthEnd = buildDateIso(monthValue, daysInMonth);
  const db = getDb();

  const [buildingHours, staffMemberRows, appointments] = await Promise.all([
    db.select().from(businessWeeklyHoursTable),
    db.select().from(staffMembersTable).where(eq(staffMembersTable.name, barber)),
    db
      .select()
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.barber, barber),
        eq(appointmentsTable.status, "accepted"),
        gte(appointmentsTable.appointmentDateIso, monthStart),
        lte(appointmentsTable.appointmentDateIso, monthEnd),
      )),
  ]);

  if (staffMemberRows.length === 0 || !staffMemberRows[0].isActive) {
    return Object.fromEntries(
      Array.from({ length: daysInMonth }, (_, index) => [buildDateIso(monthValue, index + 1), { available: false }]),
    );
  }

  const buildingHoursByWeekday = new Map(buildingHours.map((entry) => [entry.weekday, entry]));
  const staffId = staffMemberRows[0].id;

  const weeklyAvailability = await db
    .select()
    .from(staffWeeklyAvailabilityTable)
    .where(eq(staffWeeklyAvailabilityTable.staffId, staffId));

  const weeklyAvailabilityByWeekday = new Map<number, typeof weeklyAvailability>();
  for (const entry of weeklyAvailability) {
    const existingEntries = weeklyAvailabilityByWeekday.get(entry.weekday) ?? [];
    existingEntries.push(entry);
    weeklyAvailabilityByWeekday.set(entry.weekday, existingEntries);
  }

  const bookedHoursByDate = new Map<string, Set<number>>();
  for (const appointment of appointments) {
    const appointmentMinutes = parseTimeLabelToMinutes(appointment.appointmentTime);
    if (appointmentMinutes === null) {
      continue;
    }
    const appointmentHour = Math.floor(appointmentMinutes / 60);

    const existingHours = bookedHoursByDate.get(appointment.appointmentDateIso) ?? new Set<number>();
    existingHours.add(appointmentHour);
    bookedHoursByDate.set(appointment.appointmentDateIso, existingHours);
  }

  const availabilityByDate: Record<string, MonthlyAvailabilityResult> = {};

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateIso = buildDateIso(monthValue, day);
    const weekday = new Date(`${dateIso}T12:00:00Z`).getUTCDay();
    const buildingEntry = buildingHoursByWeekday.get(weekday);

    if (!buildingEntry || !buildingEntry.isOpen) {
      availabilityByDate[dateIso] = { available: false };
      continue;
    }

    const buildingStartMinutes = parseTimeLabelToMinutes(buildingEntry.startTime);
    const buildingEndMinutes = parseTimeLabelToMinutes(buildingEntry.endTime);
    if (buildingStartMinutes === null || buildingEndMinutes === null) {
      availabilityByDate[dateIso] = { available: false };
      continue;
    }

    const weekdayEntries = (weeklyAvailabilityByWeekday.get(weekday) ?? []).filter((entry) => entry.isWorking);
    if (weekdayEntries.length === 0) {
      availabilityByDate[dateIso] = { available: false };
      continue;
    }

    const bookedHours = bookedHoursByDate.get(dateIso) ?? new Set<number>();

    // Generate hourly slots from building hours
    const buildingStartHour = Math.floor(buildingStartMinutes / 60);
    const buildingEndHour = Math.ceil(buildingEndMinutes / 60);
    const buildingHours: number[] = [];
    for (let hour = buildingStartHour; hour < buildingEndHour; hour++) {
      buildingHours.push(hour);
    }

    availabilityByDate[dateIso] = {
      available: buildingHours.some((hourValue) => {
        const appointmentMinutes = hourValue * 60;
        if (appointmentMinutes < buildingStartMinutes || appointmentMinutes >= buildingEndMinutes) {
          return false;
        }

        const isWithinStaffSchedule = weekdayEntries.some((entry) => {
          const startMinutes = parseTimeLabelToMinutes(entry.startTime);
          const endMinutes = parseTimeLabelToMinutes(entry.endTime);

          if (startMinutes === null || endMinutes === null) {
            return false;
          }

          return appointmentMinutes >= startMinutes && appointmentMinutes < endMinutes;
        });

        if (!isWithinStaffSchedule) {
          return false;
        }

        return !bookedHours.has(hourValue);
      }),
    };
  }

  return availabilityByDate;
}

async function getAvailabilityForHour(dateIso: string, barber: string, hourNum: number): Promise<AvailabilityResult> {
  const slotDate = new Date(`${dateIso}T00:00:00Z`);
  const weekday = slotDate.getUTCDay();
  const appointmentMinutes = hourNum * 60;

  const db = getDb();

  const buildingHours = await db
    .select()
    .from(businessWeeklyHoursTable)
    .where(eq(businessWeeklyHoursTable.weekday, weekday));

  if (buildingHours.length === 0 || !buildingHours[0].isOpen) {
    return {
      available: false,
      reason: "Building is closed on this day",
      blockedBy: "Building Hours",
      rank: 1,
    };
  }

  const buildingStartMinutes = parseTimeLabelToMinutes(buildingHours[0].startTime);
  const buildingEndMinutes = parseTimeLabelToMinutes(buildingHours[0].endTime);
  if (
    buildingStartMinutes === null
    || buildingEndMinutes === null
    || appointmentMinutes < buildingStartMinutes
    || appointmentMinutes >= buildingEndMinutes
  ) {
    return {
      available: false,
      reason: `Building is outside operating hours (${buildingHours[0].startTime} - ${buildingHours[0].endTime})`,
      blockedBy: "Building Hours",
      rank: 1,
    };
  }

  const staffMember = await db
    .select()
    .from(staffMembersTable)
    .where(eq(staffMembersTable.name, barber));

  if (staffMember.length === 0 || !staffMember[0].isActive) {
    return {
      available: false,
      reason: "Staff member not found or inactive",
      blockedBy: "Staff Hours",
      rank: 2,
    };
  }

  const staffId = staffMember[0].id;

  const weeklyAvailability = await db
    .select()
    .from(staffWeeklyAvailabilityTable)
    .where(and(
      eq(staffWeeklyAvailabilityTable.staffId, staffId),
      eq(staffWeeklyAvailabilityTable.weekday, weekday),
    ));

  if (weeklyAvailability.length === 0 || !weeklyAvailability[0].isWorking) {
    return {
      available: false,
      reason: "Staff member is not working on this day",
      blockedBy: "Staff Hours",
      rank: 2,
    };
  }

  const staffStartMinutes = parseTimeLabelToMinutes(weeklyAvailability[0].startTime);
  const staffEndMinutes = parseTimeLabelToMinutes(weeklyAvailability[0].endTime);
  if (
    staffStartMinutes === null
    || staffEndMinutes === null
    || appointmentMinutes < staffStartMinutes
    || appointmentMinutes >= staffEndMinutes
  ) {
    return {
      available: false,
      reason: `Staff member is outside their working hours (${weeklyAvailability[0].startTime} - ${weeklyAvailability[0].endTime})`,
      blockedBy: "Staff Hours",
      rank: 2,
    };
  }

  const bookedSlots = await db
    .select()
    .from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.barber, barber),
      eq(appointmentsTable.appointmentDateIso, dateIso),
      eq(appointmentsTable.status, "accepted"),
    ));

  const isSlotBooked = bookedSlots.some((apt) => {
    const appointmentMinutes = parseTimeLabelToMinutes(apt.appointmentTime);
    if (appointmentMinutes === null) {
      return false;
    }

    return Math.floor(appointmentMinutes / 60) === hourNum;
  });

  if (isSlotBooked) {
    return {
      available: false,
      reason: "Time slot is already booked",
      blockedBy: "Customer Appointment",
      rank: 3,
    };
  }

  return {
    available: true,
    reason: "Time slot is available",
    blockedBy: null,
    rank: null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateIso = url.searchParams.get("date");
    const month = url.searchParams.get("month");
    const barber = url.searchParams.get("barber");
    const hour = url.searchParams.get("hour");

    if (month) {
      if (!barber) {
        return Response.json(
          { error: "Missing required parameters: month, barber" },
          { status: 400 },
        );
      }

      return Response.json({
        dates: await getMonthlyAvailability(month, barber),
      });
    }

    if (!dateIso || !barber || !hour) {
      if (!dateIso || !barber) {
        return Response.json(
          { error: "Missing required parameters: date, barber" },
          { status: 400 },
        );
      }

      // Fetch building hours to determine which hours to check
      const db = getDb();
      const slotDate = new Date(`${dateIso}T00:00:00Z`);
      const weekday = slotDate.getUTCDay();
      
      const buildingHoursForDay = await db
        .select()
        .from(businessWeeklyHoursTable)
        .where(eq(businessWeeklyHoursTable.weekday, weekday));

      const hoursToCheck: number[] = (() => {
        if (buildingHoursForDay.length === 0 || !buildingHoursForDay[0].isOpen) {
          return [];
        }
        
        const startMinutes = parseTimeLabelToMinutes(buildingHoursForDay[0].startTime);
        const endMinutes = parseTimeLabelToMinutes(buildingHoursForDay[0].endTime);
        
        if (startMinutes === null || endMinutes === null) {
          return [];
        }
        
        const startHour = Math.floor(startMinutes / 60);
        const endHour = Math.ceil(endMinutes / 60);
        const hours: number[] = [];
        
        for (let hour = startHour; hour < endHour; hour++) {
          hours.push(hour);
        }
        
        return hours;
      })();

      const availability = await Promise.all(
        hoursToCheck.map(async (hourValue) => [hourValue, await getAvailabilityForHour(dateIso, barber, hourValue)] as const),
      );

      return Response.json({
        hours: Object.fromEntries(availability),
      });
    }

    const hourNum = parseHourLabel(hour);
    if (hourNum === null) {
      return Response.json(
        { error: "Invalid hour" },
        { status: 400 },
      );
    }

    return Response.json(await getAvailabilityForHour(dateIso, barber, hourNum));
  } catch (error) {
    console.error("Failed to check availability:", error);
    return Response.json(
      { error: "Failed to check availability" },
      { status: 500 },
    );
  }
}
