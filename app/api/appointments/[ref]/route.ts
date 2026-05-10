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
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter";
import { getAuthSession } from "@/lib/auth";

type AppointmentRouteContext = {
  params: Promise<{
    ref: string;
  }>;
};

function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && appointmentStatusValues.includes(value as AppointmentStatus);
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

  const normalizedDateIso = normalizeDateIsoInput(candidate.dateIso);
  if (!normalizedDateIso) {
    return null;
  }

  return {
    service: candidate.service,
    barber: candidate.barber,
    dateIso: normalizedDateIso,
    dateLabel: candidate.dateLabel,
    time: candidate.time,
    customerName: candidate.customerName,
    customerEmail: candidate.customerEmail,
    customerPhone: candidate.customerPhone,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
  };
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
    console.error("[appointments GET ref]", error);
    return NextResponse.json({ error: "Failed to load appointment." }, { status: 500 });
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

  const patchRateLimitResult = await checkRateLimit(`rl:appointments:update:ip:${ip}`, 20, 60 * 1000);
  if (patchRateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: getRateLimitHeaders(patchRateLimitResult) },
    );
  }

  const body = await request.json().catch(() => null);
  const shouldOverwrite =
    body && typeof body === "object" && (body as { overwrite?: unknown }).overwrite === true;
  const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
  const cancellationNote = getCancellationNoteFromBody(body);
  const isOwnerRequest = await isOwnerAuthorized(request);
  const session = await getAuthSession();
  const sessionCustomerEmail = session?.user?.email?.trim().toLowerCase() ?? null;

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
        sessionCustomerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === sessionCustomerEmail;
      const canCustomerOverwrite = isCustomerOwnedAppointment && existingAppointment.status === "pending";

      if (!isOwnerRequest && !canCustomerOverwrite) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      const nextCustomerEmail = isOwnerRequest
        ? overwritePayload.customerEmail.trim().toLowerCase()
        : sessionCustomerEmail;

      if (!nextCustomerEmail) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      const overwrittenAppointment = await overwriteAppointmentDetails(ref, {
        ...overwritePayload,
        customerEmail: nextCustomerEmail,
        notes: overwritePayload.notes?.trim() ? overwritePayload.notes.trim() : null,
      });

      return NextResponse.json(overwrittenAppointment);
    } catch {
      return NextResponse.json(
        { error: "Failed to replace appointment." },
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
      sessionCustomerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === sessionCustomerEmail;

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
  } catch {
    return NextResponse.json(
      { error: "Failed to update appointment." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: AppointmentRouteContext) {
  const { ref } = await context.params;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope")?.trim().toLowerCase();

  if (!ref || ref.length > 40) {
    return NextResponse.json({ error: "Invalid appointment reference." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const deleteRateLimitResult = await checkRateLimit(`rl:appointments:delete:ip:${ip}`, 20, 60 * 1000);
  if (deleteRateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: getRateLimitHeaders(deleteRateLimitResult) },
    );
  }

  const isOwnerRequest = await isOwnerAuthorized(request);
  const session = await getAuthSession();
  const sessionCustomerEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  try {
    const existingAppointment = await getAppointment(ref);
    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    // Explicit owner scope forces owner-hidden behavior, even when
    // the signed-in owner email also matches the customer email.
    if (scope === "owner" && isOwnerRequest) {
      const hiddenAppointment = await hideAppointmentFromOwner(ref);
      return NextResponse.json({
        success: true,
        deleted: hiddenAppointment === undefined,
        appointment: hiddenAppointment ?? null,
      });
    }

    const isCustomerOwnedAppointment =
      sessionCustomerEmail !== null && existingAppointment.customerEmail.trim().toLowerCase() === sessionCustomerEmail;
    const isCustomerDeletableStatus =
      existingAppointment.status === "completed" ||
      existingAppointment.status === "cancelled" ||
      existingAppointment.status === "denied" ||
      existingAppointment.status === "expired";

    const isValidCustomerDeleteRequest =
      isCustomerOwnedAppointment && isCustomerDeletableStatus;

    if (!isOwnerRequest && !isValidCustomerDeleteRequest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // If request includes a valid customer identity, honor customer-side hide
    // even when the same user is also an owner/admin.
    if (isValidCustomerDeleteRequest) {
      const hiddenAppointment = await hideAppointmentFromCustomer(ref);
      return NextResponse.json({
        success: true,
        deleted: hiddenAppointment === undefined,
        appointment: hiddenAppointment ?? null,
      });
    }

    const hiddenAppointment = await hideAppointmentFromOwner(ref);
    return NextResponse.json({
      success: true,
      deleted: hiddenAppointment === undefined,
      appointment: hiddenAppointment ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete appointment." },
      { status: 500 },
    );
  }
}