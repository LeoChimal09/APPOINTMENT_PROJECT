import type { AppointmentRecord } from "@/lib/appointments/appointment.types";

const GUEST_APPOINTMENTS_STORAGE_KEY = "cutting_edge_guest_appointments";
const MAX_STORED_GUEST_APPOINTMENTS = 100;

function parseStoredAppointments(value: string | null): AppointmentRecord[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is AppointmentRecord => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<AppointmentRecord>;
      return (
        typeof candidate.ref === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.status === "string" &&
        typeof candidate.service === "string" &&
        typeof candidate.barber === "string" &&
        typeof candidate.dateIso === "string" &&
        typeof candidate.dateLabel === "string" &&
        typeof candidate.time === "string" &&
        typeof candidate.customerName === "string" &&
        typeof candidate.customerEmail === "string" &&
        typeof candidate.customerPhone === "string"
      );
    });
  } catch {
    return [];
  }
}

export function getStoredGuestAppointments() {
  if (typeof window === "undefined") {
    return [] as AppointmentRecord[];
  }

  try {
    return parseStoredAppointments(localStorage.getItem(GUEST_APPOINTMENTS_STORAGE_KEY));
  } catch {
    return [] as AppointmentRecord[];
  }
}

export function setStoredGuestAppointments(appointments: AppointmentRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (appointments.length === 0) {
      localStorage.removeItem(GUEST_APPOINTMENTS_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      GUEST_APPOINTMENTS_STORAGE_KEY,
      JSON.stringify(appointments.slice(0, MAX_STORED_GUEST_APPOINTMENTS)),
    );
  } catch {
    // no-op
  }
}

export function upsertStoredGuestAppointment(nextAppointment: AppointmentRecord) {
  const current = getStoredGuestAppointments();
  const withoutDuplicate = current.filter((appointment) => appointment.ref !== nextAppointment.ref);
  setStoredGuestAppointments([nextAppointment, ...withoutDuplicate]);
}

export function removeStoredGuestAppointment(ref: string) {
  const current = getStoredGuestAppointments();
  setStoredGuestAppointments(current.filter((appointment) => appointment.ref !== ref));
}
