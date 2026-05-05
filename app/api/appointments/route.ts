import { NextRequest, NextResponse } from "next/server";
import { createAppointment, getAllAppointments, getAppointmentsByEmail, isTimeSlotAvailable } from "@/server/repositories/appointments-repository";
import type { AppointmentRequestInput } from "@/lib/appointments/appointment.types";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { printAdminNewAppointmentNotification } from "@/lib/mailer";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter";
import { isStaffAvailableForAppointment } from "@/server/repositories/staff-repository";
import { getAuthSession } from "@/lib/auth";

function isAppointmentRequestInput(value: unknown): value is AppointmentRequestInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppointmentRequestInput>;
  return (
    typeof candidate.service === "string" &&
    typeof candidate.barber === "string" &&
    typeof candidate.dateIso === "string" &&
    typeof candidate.dateLabel === "string" &&
    typeof candidate.time === "string" &&
    typeof candidate.customerName === "string" &&
    typeof candidate.customerEmail === "string" &&
    typeof candidate.customerPhone === "string"
  );
}

const FIELD_LIMITS: Record<string, number> = {
  service: 120,
  barber: 120,
  dateIso: 40,
  dateLabel: 80,
  time: 20,
  customerName: 255,
  customerEmail: 255,
  customerPhone: 40,
};

function exceedsLengthLimits(body: AppointmentRequestInput) {
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > max) {
      return true;
    }
  }
  if (body.notes && body.notes.length > 2000) {
    return true;
  }
  return false;
}

function normalizeDateIsoInput(value: string) {
  const trimmed = value.trim();
  const directIsoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (directIsoMatch) {
    return directIsoMatch[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope")?.trim().toLowerCase();

  if (scope === "owner") {
    if (!(await isOwnerAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      return NextResponse.json(await getAllAppointments());
    } catch (err) {
      console.error("[appointments GET owner]", err);
      return NextResponse.json({ error: "Failed to load appointments." }, { status: 500 });
    }
  }

  const session = await getAuthSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase();

  if (sessionEmail) {
    try {
      return NextResponse.json(await getAppointmentsByEmail(sessionEmail));
    } catch (err) {
      console.error("[appointments GET customer]", err);
      return NextResponse.json({ error: "Failed to load appointments." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimitResult = await checkRateLimit(`rl:appointments:create:ip:${ip}`, 10, 60 * 1000);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  const body = await request.json().catch(() => null);

  if (!isAppointmentRequestInput(body)) {
    return NextResponse.json({ error: "Invalid appointment payload." }, { status: 400 });
  }

  if (exceedsLengthLimits(body)) {
    return NextResponse.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
  }

  const normalizedDateIso = normalizeDateIsoInput(body.dateIso);
  if (!normalizedDateIso) {
    return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 });
  }

  const session = await getAuthSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  const normalizedBody: AppointmentRequestInput = {
    ...body,
    dateIso: normalizedDateIso,
    customerEmail: sessionEmail ?? body.customerEmail.trim().toLowerCase(),
  };

  try {
    const staffAvailable = await isStaffAvailableForAppointment(normalizedBody.barber, normalizedBody.dateIso, normalizedBody.time);
    if (!staffAvailable) {
      return NextResponse.json(
        { error: "This staff member is unavailable for the selected date or time." },
        { status: 409 },
      );
    }

    // Check if the time slot is available (not already booked)
    const slotAvailable = await isTimeSlotAvailable(normalizedBody.dateIso, normalizedBody.time, normalizedBody.barber);
    if (!slotAvailable) {
      return NextResponse.json(
        { error: "This time slot is no longer available. Please select a different time." },
        { status: 409 },
      );
    }

    const appointment = await createAppointment({
      ...normalizedBody,
      notes: normalizedBody.notes?.trim() ? normalizedBody.notes.trim() : null,
    });

    printAdminNewAppointmentNotification({
      ref: appointment.ref,
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail,
      customerPhone: appointment.customerPhone,
      service: appointment.service,
      barber: appointment.barber,
      dateLabel: appointment.dateLabel,
      time: appointment.time,
      notes: appointment.notes,
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to create appointment.",
      },
      { status: 500 },
    );
  }
}