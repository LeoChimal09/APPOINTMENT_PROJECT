import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import {
  getStaffWeeklyAvailability,
  replaceStaffWeeklyAvailability,
} from "@/server/repositories/staff-repository";

const timeLabelPattern = /^\d{1,2}:\d{2}\s(?:AM|PM)$/i;

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

export async function GET(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawStaffId = url.searchParams.get("staffId");
  const staffId = rawStaffId ? Number.parseInt(rawStaffId, 10) : NaN;

  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getStaffWeeklyAvailability(staffId));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load staff schedule" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const staffId = typeof body?.staffId === "number" ? body.staffId : NaN;
  const entries = Array.isArray(body?.entries) ? body.entries : null;

  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  if (!entries || entries.length !== 7) {
    return NextResponse.json({ error: "A full 7-day schedule is required" }, { status: 400 });
  }

  const normalizedEntries: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    isWorking: boolean;
  }> = [];

  for (const entry of entries) {
    const weekday = typeof entry?.weekday === "number" ? entry.weekday : NaN;
    const isWorking = typeof entry?.isWorking === "boolean" ? entry.isWorking : false;
    const startTime = typeof entry?.startTime === "string" ? entry.startTime.trim() : "";
    const endTime = typeof entry?.endTime === "string" ? entry.endTime.trim() : "";

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: "Each schedule entry must use weekdays 0 through 6" }, { status: 400 });
    }

    if (!timeLabelPattern.test(startTime) || !timeLabelPattern.test(endTime)) {
      return NextResponse.json({ error: "Invalid time format. Use values like 9:00 AM." }, { status: 400 });
    }

    const startMinutes = parseTimeLabelToMinutes(startTime);
    const endMinutes = parseTimeLabelToMinutes(endTime);

    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return NextResponse.json({ error: "Each working window must end after it starts" }, { status: 400 });
    }

    normalizedEntries.push({ weekday, startTime, endTime, isWorking });
  }

  try {
    return NextResponse.json(await replaceStaffWeeklyAvailability(staffId, normalizedEntries));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save staff schedule" },
      { status: 500 },
    );
  }
}