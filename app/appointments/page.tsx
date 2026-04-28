"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments/appointment.types";

const STORAGE_KEY = "cutting_edge_appointments";

const statusColorMap: Record<AppointmentStatus, string> = {
  pending: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-[var(--border)]",
  accepted: "bg-[#c8e6c9] text-[#1b4332] border border-[#a5d6a7]",
  denied: "bg-[#f8d7da] text-[#7a1f2a] border border-[#eeb6be]",
  cancelled: "bg-[#dce3ea] text-[#2f3b4a] border border-[#c2ced9]",
  completed: "bg-[var(--surface-soft)] text-[var(--muted)] border border-[var(--border)]",
};

const deleteButtonColorMap: Record<AppointmentStatus, string> = {
  pending: "bg-[var(--accent-soft)]",
  accepted: "bg-[#c8e6c9]",
  denied: "bg-[var(--surface-strong)]",
  cancelled: "bg-[var(--surface-strong)]",
  completed: "bg-[var(--surface-soft)]",
};

type ConfirmAction =
  | { type: "cancel"; ref: string }
  | { type: "delete"; ref: string }
  | { type: "clearAll" }
  | null;

function parseHourFromLabel(timeLabel: string) {
  const match = timeLabel.trim().match(/^(\d{1,2}):\d{2}\s?(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const requestedHour = Number.parseInt(match[1], 10);
  const isPm = match[2].toUpperCase() === "PM";

  return isPm
    ? requestedHour === 12
      ? 12
      : requestedHour + 12
    : requestedHour === 12
      ? 0
      : requestedHour;
}

function getAppointmentTimestamp(appointment: AppointmentRecord) {
  const parsedDate = new Date(appointment.dateIso);
  const parsedHour = parseHourFromLabel(appointment.time);

  if (Number.isNaN(parsedDate.getTime()) || parsedHour === null) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    parsedHour,
    0,
    0,
    0,
  ).getTime();
}

function getStoredAppointments() {
  if (typeof window === "undefined") {
    return [] as AppointmentRecord[];
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? (stored as AppointmentRecord[]) : [];
  } catch {
    return [] as AppointmentRecord[];
  }
}

function AppointmentCard({
  appointment,
  onRequestCancel,
  onRequestDelete,
}: {
  appointment: AppointmentRecord;
  onRequestCancel: (ref: string) => void;
  onRequestDelete: (ref: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const canCancel = appointment.status === "pending" || appointment.status === "accepted";
  const canDelete = appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "denied";
  const canBookAgain = canDelete;

  return (
    <div className="relative flex flex-col gap-4 p-6">
      {/* Delete button (top-right corner) */}
      {canDelete ? (
        <button
          type="button"
          className={`absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full text-[var(--foreground)] transition hover:opacity-80 ${deleteButtonColorMap[appointment.status]}`}
          onClick={() => onRequestDelete(appointment.ref)}
          title="Remove from history"
        >
          ✕
        </button>
      ) : null}

      {/* Card header — info only */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              {appointment.service}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-0.5 text-sm font-semibold capitalize ${statusColorMap[appointment.status]}`}
            >
              {appointment.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-base text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              {appointment.barber}
            </span>
            <span className="text-[var(--border)]">/</span>
            <span>{appointment.dateLabel}</span>
            <span className="text-[var(--border)]">/</span>
            <span className="font-medium text-[var(--accent-strong)]">{appointment.time}</span>
          </div>
        </div>
      </div>

      {/* Toggle + cancel row */}
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <button
          type="button"
          className="w-fit rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>

        {canCancel ? (
          <button
            type="button"
            className="w-fit rounded-full border border-[var(--border)] bg-transparent px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
            onClick={() => onRequestCancel(appointment.ref)}
          >
            Cancel appointment
          </button>
        ) : null}

        {canBookAgain ? (
          <Link
            href={`/book?date=${encodeURIComponent(
              appointment.dateIso,
            )}&service=${encodeURIComponent(appointment.service)}&barber=${encodeURIComponent(
              appointment.barber,
            )}&time=${encodeURIComponent(appointment.time)}`}
            className="w-fit rounded-full border border-[var(--border)] bg-transparent px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
          >
            Book again
          </Link>
        ) : null}

        <div className="-mt-1 ml-auto flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 font-mono text-sm text-[var(--muted)]">
            {appointment.ref}
          </span>
          <span className="text-sm text-[var(--muted)]">
            Requested{" "}
            {new Date(appointment.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Expanded details — styled like the booking summary panel */}
      {expanded ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(240,196,108,0.15),_rgba(255,255,255,0)_50%),linear-gradient(135deg,var(--panel),#3d0d16)] p-5 text-[var(--surface)]">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--panel-highlight)]">
            Booking details
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <p className="text-xs text-[var(--panel-text-muted)]">Name</p>
              <p className="mt-1 font-semibold text-[var(--surface)]">{appointment.customerName}</p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <p className="text-xs text-[var(--panel-text-muted)]">Email</p>
              <p className="mt-1 font-semibold text-[var(--surface)]">{appointment.customerEmail}</p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <p className="text-xs text-[var(--panel-text-muted)]">Phone</p>
              <p className="mt-1 font-semibold text-[var(--surface)]">{appointment.customerPhone}</p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <p className="text-xs text-[var(--panel-text-muted)]">Barber</p>
              <p className="mt-1 font-semibold text-[var(--surface)]">{appointment.barber}</p>
            </div>
            {appointment.notes ? (
              <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3 sm:col-span-2">
                <p className="text-xs text-[var(--panel-text-muted)]">Notes</p>
                <p className="mt-1 text-sm leading-6 text-[var(--surface)]">{appointment.notes}</p>
              </div>
            ) : null}
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3 sm:col-span-2">
              <p className="text-xs text-[var(--panel-text-muted)]">Appointment slot</p>
              <p className="mt-1 font-semibold text-[var(--panel-highlight)]">
                {appointment.dateLabel} &middot; {appointment.time}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() => getStoredAppointments());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  function handleCancel(ref: string) {
    setAppointments((prev) => {
      const updated = prev.map((a) => (a.ref === ref ? { ...a, status: "cancelled" as const } : a));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function handleDelete(ref: string) {
    setAppointments((prev) => {
      const updated = prev.filter((a) => a.ref !== ref);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function handleClearAll() {
    setAppointments((prev) => {
      const filtered = prev.filter(
        (a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "denied",
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    });
  }

  function runConfirmAction() {
    if (!confirmAction) {
      return;
    }

    if (confirmAction.type === "cancel") {
      handleCancel(confirmAction.ref);
    }

    if (confirmAction.type === "delete") {
      handleDelete(confirmAction.ref);
    }

    if (confirmAction.type === "clearAll") {
      handleClearAll();
    }

    setConfirmAction(null);
  }

  const confirmationContent =
    confirmAction?.type === "cancel"
      ? {
          title: "Cancel this appointment?",
          description: "This request will move to cancelled status.",
          confirmLabel: "Yes, cancel",
        }
      : confirmAction?.type === "delete"
      ? {
          title: "Remove from history?",
          description: "This appointment entry will be permanently removed from this device.",
          confirmLabel: "Yes, remove",
        }
      : confirmAction?.type === "clearAll"
      ? {
          title: "Clear terminal history?",
          description: "Completed, cancelled, and denied appointments will be removed from this device.",
          confirmLabel: "Yes, clear",
        }
      : null;

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((first, second) => {
      const firstIsBottom = first.status === "cancelled" || first.status === "completed";
      const secondIsBottom = second.status === "cancelled" || second.status === "completed";

      if (firstIsBottom !== secondIsBottom) {
        return firstIsBottom ? 1 : -1;
      }

      const firstTime = getAppointmentTimestamp(first);
      const secondTime = getAppointmentTimestamp(second);

      if (firstTime !== null && secondTime !== null) {
        return firstTime - secondTime;
      }

      if (firstTime !== null) {
        return -1;
      }

      if (secondTime !== null) {
        return 1;
      }

      return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    });
  }, [appointments]);

  const hasTerminalAppointments = appointments.some(
    (a) => a.status === "completed" || a.status === "cancelled" || a.status === "denied"
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.92)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.12)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
              Your visits
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              My appointments
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              All appointment requests you have submitted on this device. Once a database is connected, your history will follow you across devices.
            </p>
          </div>
          {hasTerminalAppointments ? (
            <button
              type="button"
              className="w-fit shrink-0 rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setConfirmAction({ type: "clearAll" })}
            >
              Clear all
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {appointments.length === 0 ? (
          <div className="flex flex-col gap-4 p-8">
            <p className="text-[var(--muted)]">
              You have not submitted any appointment requests yet from this device.
            </p>
            <Link
              className="inline-flex w-fit items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              href="/book"
            >
              Book an appointment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {sortedAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.ref}
                appointment={appointment}
                onRequestCancel={(ref) => setConfirmAction({ type: "cancel", ref })}
                onRequestDelete={(ref) => setConfirmAction({ type: "delete", ref })}
              />
            ))}
          </div>
        )}
      </section>

      {confirmationContent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(26,12,12,0.52)] p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_rgba(26,12,12,0.35)]">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Confirm action
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              {confirmationContent.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {confirmationContent.description}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
                onClick={() => setConfirmAction(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                onClick={runConfirmAction}
              >
                {confirmationContent.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
