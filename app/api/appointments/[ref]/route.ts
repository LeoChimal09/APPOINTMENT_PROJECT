import { NextRequest, NextResponse } from "next/server";
import {
  getAppointment,
  updateAppointmentStatus,
} from "@/server/repositories/appointments-repository";
import {
  appointmentStatusValues,
  canTransitionAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointments/appointment.types";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";

type AppointmentRouteContext = {
  params: Promise<{
    ref: string;
  }>;
};

function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && appointmentStatusValues.includes(value as AppointmentStatus);
}

export async function GET(_request: NextRequest, context: AppointmentRouteContext) {
  if (!isOwnerAuthorized(_request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { ref } = await context.params;

  try {
    const appointment = await getAppointment(ref);
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load appointment." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: AppointmentRouteContext) {
  if (!isOwnerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { ref } = await context.params;
  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;

  if (!isAppointmentStatus(status)) {
    return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });
  }

  try {
    const existingAppointment = await getAppointment(ref);
    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    if (!canTransitionAppointmentStatus(existingAppointment.status, status)) {
      return NextResponse.json(
        { error: "This appointment cannot move to that status from its current state." },
        { status: 409 },
      );
    }

    const updatedAppointment = await updateAppointmentStatus(ref, status);
    return NextResponse.json(updatedAppointment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update appointment." },
      { status: 500 },
    );
  }
}