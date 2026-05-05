export const appointmentStatusValues = [
  "pending",
  "accepted",
  "denied",
  "cancelled",
  "completed",
  "expired",
] as const;

export type AppointmentStatus = (typeof appointmentStatusValues)[number];

export type AppointmentRequestInput = {
  service: string;
  barber: string;
  dateIso: string;
  dateLabel: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
};

export type AppointmentRecord = AppointmentRequestInput & {
  ref: string;
  createdAt: string;
  status: AppointmentStatus;
};

export function canTransitionAppointmentStatus(
  currentStatus: AppointmentStatus,
  nextStatus: AppointmentStatus,
) {
  if (currentStatus === nextStatus) return true;

  switch (currentStatus) {
    case "pending":
      return (
        nextStatus === "accepted" ||
        nextStatus === "denied" ||
        nextStatus === "cancelled" ||
        nextStatus === "expired"
      );
    case "accepted":
      return nextStatus === "completed" || nextStatus === "cancelled";
    case "denied":
    case "completed":
      return false;
    default:
      return false;
  }
}