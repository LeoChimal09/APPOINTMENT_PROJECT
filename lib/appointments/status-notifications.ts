import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments/appointment.types";

const STATUS_SNAPSHOT_STORAGE_KEY = "cutting_edge_appointment_status_snapshot";
const STATUS_UNREAD_STORAGE_KEY = "cutting_edge_appointment_status_unread";

export type AppointmentStatusChangeNotification = {
  ref: string;
  from: AppointmentStatus;
  to: AppointmentStatus;
  service: string;
  dateLabel: string;
  time: string;
  changedAtIso: string;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readSnapshot() {
  if (!canUseStorage()) {
    return {} as Record<string, AppointmentStatus>;
  }

  try {
    const raw = localStorage.getItem(STATUS_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, AppointmentStatus>;
    }

    const parsed = JSON.parse(raw) as Record<string, AppointmentStatus>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, AppointmentStatus>;
  }
}

function writeSnapshot(snapshot: Record<string, AppointmentStatus>) {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(STATUS_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // no-op
  }
}

function readUnreadNotifications() {
  if (!canUseStorage()) {
    return [] as AppointmentStatusChangeNotification[];
  }

  try {
    const raw = localStorage.getItem(STATUS_UNREAD_STORAGE_KEY);
    if (!raw) {
      return [] as AppointmentStatusChangeNotification[];
    }

    const parsed = JSON.parse(raw) as AppointmentStatusChangeNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as AppointmentStatusChangeNotification[];
  }
}

function writeUnreadNotifications(notifications: AppointmentStatusChangeNotification[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(STATUS_UNREAD_STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // no-op
  }
}

export function syncAppointmentStatusChangeNotifications(appointments: AppointmentRecord[]) {
  const previousSnapshot = readSnapshot();
  const nextSnapshot: Record<string, AppointmentStatus> = {};
  const freshChanges: AppointmentStatusChangeNotification[] = [];

  for (const appointment of appointments) {
    nextSnapshot[appointment.ref] = appointment.status;

    const previousStatus = previousSnapshot[appointment.ref];
    if (previousStatus && previousStatus !== appointment.status) {
      freshChanges.push({
        ref: appointment.ref,
        from: previousStatus,
        to: appointment.status,
        service: appointment.service,
        dateLabel: appointment.dateLabel,
        time: appointment.time,
        changedAtIso: new Date().toISOString(),
      });
    }
  }

  const mergedByRef = new Map<string, AppointmentStatusChangeNotification>();

  for (const notification of readUnreadNotifications()) {
    mergedByRef.set(notification.ref, notification);
  }

  for (const notification of freshChanges) {
    mergedByRef.set(notification.ref, notification);
  }

  const mergedNotifications = Array.from(mergedByRef.values()).sort(
    (first, second) =>
      new Date(second.changedAtIso).getTime() - new Date(first.changedAtIso).getTime(),
  );

  writeUnreadNotifications(mergedNotifications);
  writeSnapshot(nextSnapshot);

  return mergedNotifications;
}

export function getUnreadAppointmentStatusChangeNotifications() {
  return readUnreadNotifications();
}

export function clearUnreadAppointmentStatusChangeNotifications() {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.removeItem(STATUS_UNREAD_STORAGE_KEY);
  } catch {
    // no-op
  }
}
