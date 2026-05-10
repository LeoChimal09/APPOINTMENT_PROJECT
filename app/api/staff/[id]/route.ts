import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { updateStaffMember, deleteStaffMember } from "@/server/repositories/staff-repository";
import { cancelAcceptedAppointmentsForBarberOnDate } from "@/server/repositories/appointments-repository";
import { printCustomerStatusUpdateNotification } from "@/lib/mailer";

type StaffRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: StaffRouteContext) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const staffId = parseInt(id, 10);

  if (!staffId || staffId <= 0) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;

  if (isActive === null) {
    return NextResponse.json({ error: "isActive field is required" }, { status: 400 });
  }

  try {
    const staff = await updateStaffMember(staffId, isActive);
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    if (!isActive) {
      const todayIso = new Date().toISOString().split("T")[0];
      const autoCancellationNote = "Appointment cancelled because your barber was marked inactive for today.";
      const cancelledAppointments = await cancelAcceptedAppointmentsForBarberOnDate(
        staff.name,
        todayIso,
        autoCancellationNote,
      );

      for (const appointment of cancelledAppointments) {
        printCustomerStatusUpdateNotification({
          ref: appointment.ref,
          customerName: appointment.customerName,
          customerEmail: appointment.customerEmail,
          service: appointment.service,
          barber: appointment.barber,
          dateLabel: appointment.dateLabel,
          time: appointment.time,
          fromStatus: "accepted",
          toStatus: "cancelled",
          cancellationNote: autoCancellationNote,
        });
      }
    }

    return NextResponse.json(staff);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update staff member" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: StaffRouteContext) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const staffId = parseInt(id, 10);

  if (!staffId || staffId <= 0) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  try {
    const deleted = await deleteStaffMember(staffId);
    if (!deleted) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete staff member" },
      { status: 500 },
    );
  }
}
