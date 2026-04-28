import { NextRequest, NextResponse } from "next/server";
import { createAppointment, getAllAppointments, getAppointmentsByEmail } from "@/server/repositories/appointments-repository";
import type { AppointmentRequestInput } from "@/lib/appointments/appointment.types";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope")?.trim().toLowerCase();
  const email = url.searchParams.get("email")?.trim().toLowerCase();

  if (scope === "owner") {
    if (!isOwnerAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      return NextResponse.json(await getAllAppointments());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to load appointments." },
        { status: 500 },
      );
    }
  }

  if (email) {
    try {
      return NextResponse.json(await getAppointmentsByEmail(email));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to load appointments." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isAppointmentRequestInput(body)) {
    return NextResponse.json({ error: "Invalid appointment payload." }, { status: 400 });
  }

  try {
    const appointment = await createAppointment({
      ...body,
      notes: body.notes?.trim() ? body.notes.trim() : null,
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create appointment.",
      },
      { status: 500 },
    );
  }
}