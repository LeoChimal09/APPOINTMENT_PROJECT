import { NextRequest, NextResponse } from "next/server";
import { createAppointment, getAllAppointments, getAppointmentsByEmail } from "@/server/repositories/appointments-repository";
import type { AppointmentRequestInput } from "@/lib/appointments/appointment.types";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { printAdminNewAppointmentNotification } from "@/lib/mailer";
import { isRateLimited } from "@/lib/rate-limiter";
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope")?.trim().toLowerCase();
  const email = url.searchParams.get("email")?.trim().toLowerCase();

  if (scope === "owner") {
    if (!(await isOwnerAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      return NextResponse.json(await getAllAppointments());
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to load appointments." }, // Don't expose internal error details
        { status: 500 },
      );
    }
  }

  if (email) {
    // Get the authenticated session to verify the user
    const session = await getAuthSession();
    
    // Check if user is authenticated and owns the requested email
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    
    // Normalize emails for comparison
    const sessionEmail = session.user.email.trim().toLowerCase();
    const requestedEmail = email.trim().toLowerCase();
    
    // Users can only access their own appointments
    if (sessionEmail !== requestedEmail) {
      return NextResponse.json({ error: "Unauthorized access to appointments." }, { status: 403 });
    }
    
    try {
      return NextResponse.json(await getAppointmentsByEmail(email));
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to load appointments." }, // Don't expose internal error details
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(`book:ip:${ip}`, 10, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!isAppointmentRequestInput(body)) {
    return NextResponse.json({ error: "Invalid appointment payload." }, { status: 400 });
  }

  if (exceedsLengthLimits(body)) {
    return NextResponse.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
  }

  try {
    const appointment = await createAppointment({
      ...body,
      notes: body.notes?.trim() ? body.notes.trim() : null,
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
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create appointment.", // Don't expose internal error details
      },
      { status: 500 },
    );
  }
}