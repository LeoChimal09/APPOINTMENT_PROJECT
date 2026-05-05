import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { markStaffUnavailable } from "@/server/repositories/staff-repository";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
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

export async function POST(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const staffId = typeof body?.staffId === "number" ? body.staffId : null;
  const startDateIso = typeof body?.startDateIso === "string" ? body.startDateIso.trim() : "";
  const endDateIso = typeof body?.endDateIso === "string" ? body.endDateIso.trim() : startDateIso;
  const isAllDay = typeof body?.isAllDay === "boolean" ? body.isAllDay : true;
  const startTime = typeof body?.startTime === "string" ? body.startTime.trim() : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "Unavailable";

  if (!staffId || staffId <= 0) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  if (!startDateIso || !isoDatePattern.test(startDateIso)) {
    return NextResponse.json({ error: "Invalid start date format (YYYY-MM-DD)" }, { status: 400 });
  }

  if (!endDateIso || !isoDatePattern.test(endDateIso)) {
    return NextResponse.json({ error: "Invalid end date format (YYYY-MM-DD)" }, { status: 400 });
  }

  if (endDateIso < startDateIso) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  if (!isAllDay) {
    if (!timeLabelPattern.test(startTime) || !timeLabelPattern.test(endTime)) {
      return NextResponse.json({ error: "Invalid time format. Use values like 1:00 PM." }, { status: 400 });
    }

    const startMinutes = parseTimeLabelToMinutes(startTime);
    const endMinutes = parseTimeLabelToMinutes(endTime);

    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return NextResponse.json({ error: "End time must be later than start time" }, { status: 400 });
    }
  }

  if (!reason || reason.length === 0 || reason.length > 255) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  try {
    const unavailability = await markStaffUnavailable(
      staffId,
      startDateIso,
      endDateIso,
      isAllDay ? null : startTime,
      isAllDay ? null : endTime,
      isAllDay,
      reason,
    );
    return NextResponse.json(unavailability, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark unavailability" },
      { status: 500 },
    );
  }
}
