import { NextRequest, NextResponse } from "next/server";
import {
  getAppointment,
  hideAppointmentFromCustomer,
  hideAppointmentFromOwner,
  overwriteAppointmentDetails,
  updateAppointmentStatus,
} from "@/server/repositories/appointments-repository";
import {
  appointmentStatusValues,
  canTransitionAppointmentStatus,
  type AppointmentRequestInput,
  type AppointmentStatus,
} from "@/lib/appointments/appointment.types";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { printCustomerStatusUpdateNotification } from "@/lib/mailer";
import { isRateLimited } from "@/lib/rate-limiter";

type AppointmentRouteContext = {
  params: Promise<{
    ref: string;
  }>;
};

function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && appointmentStatusValues.includes(value as AppointmentStatus);
}

function getCustomerEmailFromBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = (body as { customerEmail?: unknown }).customerEmail;
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function getCancellationNoteFromBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = (body as { cancellationNote?: unknown }).cancellationNote;
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1000) : null;
}

function getOverwritePayload(body: unknown): AppointmentRequestInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Partial<AppointmentRequestInput>;

  if (
    typeof candidate.service !== "string" ||
    typeof candidate.barber !== "string" ||
    typeof candidate.dateIso !== "string" ||
    typeof candidate.dateLabel !== "string" ||
    typeof candidate.time !== "string" ||
    typeof candidate.customerName !== "string" ||
    typeof candidate.customerEmail !== "string" ||
    typeof candidate.customerPhone !== "string"
  ) {
    return null;
  }

  return {
    service: candidate.service,
    barber: candidate.barber,
    dateIso: candidate.dateIso,
    dateLabel: candidate.dateLabel,
    time: candidate.time,
    customerName: candidate.customerName,
    customerEmail: candidate.customerEmail,
    customerPhone: candidate.customerPhone,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
  };
}

const OVERWRITE_FIELD_LIMITS: Record<string, number> = {
  service: 120,
  barber: 120,
  dateIso: 40,
  dateLabel: 80,
  time: 20,
  customerName: 255,
  customerEmail: 255,
  customerPhone: 40,
};

function overwriteExceedsLengthLimits(payload: AppointmentRequestInput) {
  for (const [field, max] of Object.entries(OVERWRITE_FIELD_LIMITS)) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > max) {
      return true;
    }
  }
  if (payload.notes && payload.notes.length > 2000) {
    return true;
  }
  return false;
}

export async function GET(_request: NextRequest, context: AppointmentRouteContext) {
  if (!(await isOwnerAuthorized(_request))) {
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
  const { ref } = await context.params;

  if (!ref || ref.length > 40) {
    return NextResponse.json({ error: "Invalid appointment reference." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(`patch:ip:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const shouldOverwrite =
    body && typeof body === "object" && (body as { overwrite?: unknown }).overwrite === true;
  const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
  const customerEmail = getCustomerEmailFromBody(body);
  const cancellationNote = getCancellationNoteFromBody(body);
  const isOwnerRequest = await isOwnerAuthorized(request);

  if (shouldOverwrite) {
    const overwritePayload = getOverwritePayload(body);
    if (!overwritePayload) {
      return NextResponse.json({ error: "Invalid replace payload." }, { status: 400 });
    }

    if (overwriteExceedsLengthLimits(overwritePayload)) {
      return NextResponse.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
    }

    try {
      const existingAppointment = await getAppointment(ref);
      if (!existingAppointment) {
        return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      }

      const isCustomerOwnedAppointment =
        customerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === customerEmail;
      const canCustomerOverwrite = isCustomerOwnedAppointment && existingAppointment.status === "pending";

      if (!isOwnerRequest && !canCustomerOverwrite) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      const overwrittenAppointment = await overwriteAppointmentDetails(ref, {
        ...overwritePayload,
        notes: overwritePayload.notes?.trim() ? overwritePayload.notes.trim() : null,
      });

      return NextResponse.json(overwrittenAppointment);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to replace appointment." },
        { status: 500 },
      );
    }
  }

  if (!isAppointmentStatus(status)) {
    return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });
  }

  try {
    const existingAppointment = await getAppointment(ref);
    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    const isCustomerOwnedAppointment =
      customerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === customerEmail;

    const canCustomerCancel =
      isCustomerOwnedAppointment &&
      status === "cancelled" &&
      (existingAppointment.status === "pending" || existingAppointment.status === "accepted");

    if (!isOwnerRequest && !canCustomerCancel) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!canTransitionAppointmentStatus(existingAppointment.status, status)) {
      return NextResponse.json(
        { error: "This appointment cannot move to that status from its current state." },
        { status: 409 },
      );
    }

    const shouldAttachAdminCancellationNote =
      isOwnerRequest && status === "cancelled" && cancellationNote !== null;

    const nextNotes = shouldAttachAdminCancellationNote
      ? existingAppointment.notes?.trim()
        ? `${existingAppointment.notes.trim()}\n\nAdmin cancellation note: ${cancellationNote}`
        : `Admin cancellation note: ${cancellationNote}`
      : undefined;

    const updatedAppointment = await updateAppointmentStatus(ref, status, nextNotes);

    if (isOwnerRequest && updatedAppointment) {
      printCustomerStatusUpdateNotification({
        ref: updatedAppointment.ref,
        customerName: updatedAppointment.customerName,
        customerEmail: updatedAppointment.customerEmail,
        service: updatedAppointment.service,
        barber: updatedAppointment.barber,
        dateLabel: updatedAppointment.dateLabel,
        time: updatedAppointment.time,
        fromStatus: existingAppointment.status,
        toStatus: updatedAppointment.status,
        cancellationNote: shouldAttachAdminCancellationNote ? cancellationNote : null,
      });
    }

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update appointment." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: AppointmentRouteContext) {
  const { ref } = await context.params;

  if (!ref || ref.length > 40) {
    return NextResponse.json({ error: "Invalid appointment reference." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(`delete:ip:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const customerEmail = getCustomerEmailFromBody(body);
  const isOwnerRequest = await isOwnerAuthorized(request);

  try {
    const existingAppointment = await getAppointment(ref);
    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    const isCustomerOwnedAppointment =
      customerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === customerEmail;
    const isCustomerDeletableStatus =
      existingAppointment.status === "completed" ||
      existingAppointment.status === "cancelled" ||
      existingAppointment.status === "denied";

    const isValidCustomerDeleteRequest =
      isCustomerOwnedAppointment && isCustomerDeletableStatus;

    if (!isOwnerRequest && !isValidCustomerDeleteRequest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // If request includes a valid customer identity, honor customer-side hide
    // even when the same user is also an owner/admin.
    if (isValidCustomerDeleteRequest) {
      const hiddenAppointment = await hideAppointmentFromCustomer(ref);
      return NextResponse.json(hiddenAppointment);
    }

    const hiddenAppointment = await hideAppointmentFromOwner(ref);
    return NextResponse.json(hiddenAppointment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete appointment." },
      { status: 500 },
    );
  }
}