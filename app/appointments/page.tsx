"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Listbox } from "@headlessui/react";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments/appointment.types";
import {
  clearUnreadAppointmentStatusChangeNotifications,
  getUnreadAppointmentStatusChangeNotifications,
  type AppointmentStatusChangeNotification,
} from "@/lib/appointments/status-notifications";
import {
  getStoredGuestAppointments,
  removeStoredGuestAppointment,
  setStoredGuestAppointments,
} from "@/lib/appointments/guest-appointments";

const statusSlipClassMap: Record<AppointmentStatus, string> = {
  pending: "bg-[color:rgba(251,188,5,0.16)] text-[color:#6b5100] border-[color:rgba(188,134,0,0.45)]",
  accepted: "bg-[var(--status-accepted-bg)] text-[var(--status-accepted-text)] border-[var(--status-accepted-border)]",
  denied: "bg-[var(--status-denied-bg)] text-[var(--status-denied-text)] border-[var(--status-denied-border)]",
  cancelled: "bg-[var(--status-denied-bg)] text-[var(--status-denied-text)] border-[var(--status-denied-border)]",
  completed: "bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border)]",
  expired: "bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border)]",
};

const statusSlipEdgeClassMap: Record<AppointmentStatus, string> = {
  pending: "border-l-[color:#b0882b]",
  accepted: "border-l-[var(--status-accepted-text)]",
  denied: "border-l-[var(--status-denied-text)]",
  cancelled: "border-l-[var(--status-denied-text)]",
  completed: "border-l-[var(--muted)]",
  expired: "border-l-[var(--muted)]",
};

const statusCardClassMap: Record<AppointmentStatus, string> = {
  pending: "border-[color:#c7b07a] bg-[linear-gradient(145deg,#f4efe1_0%,#e9dfc5_100%)]",
  accepted: "border-[var(--status-accepted-card-border)] bg-[linear-gradient(145deg,var(--status-accepted-card-from)_0%,var(--status-accepted-card-to)_100%)]",
  denied: "border-[var(--status-denied-card-border)] bg-[linear-gradient(145deg,var(--status-denied-card-from)_0%,var(--status-denied-card-to)_100%)]",
  cancelled: "border-[var(--status-denied-card-border)] bg-[linear-gradient(145deg,var(--status-denied-card-from)_0%,var(--status-denied-card-to)_100%)]",
  completed: "border-[var(--status-completed-card-border)] bg-[linear-gradient(145deg,var(--status-completed-card-from)_0%,var(--status-completed-card-to)_100%)]",
  expired: "border-[var(--status-cancelled-card-border)] bg-[linear-gradient(145deg,var(--status-cancelled-card-from)_0%,var(--status-cancelled-card-to)_100%)]",
};

const statusStripeClassMap: Record<AppointmentStatus, string> = {
  pending: "from-[color:#d9bc63] to-[color:#b0882b]",
  accepted: "from-[var(--status-accepted-stripe-from)] to-[var(--status-accepted-stripe-to)]",
  denied: "from-[var(--status-denied-stripe-from)] to-[var(--status-denied-stripe-to)]",
  cancelled: "from-[var(--status-denied-stripe-from)] to-[var(--status-denied-stripe-to)]",
  completed: "from-[var(--status-completed-stripe-from)] to-[var(--status-completed-stripe-to)]",
  expired: "from-[var(--status-cancelled-stripe-from)] to-[var(--status-cancelled-stripe-to)]",
};

const statusRank: Record<AppointmentStatus, number> = {
  accepted: 1,
  pending: 2,
  completed: 3,
  cancelled: 4,
  denied: 4,
  expired: 5,
};

const summaryIconButtonClassName =
  "btn-icon";

type ConfirmAction =
  | { type: "cancel"; ref: string }
  | { type: "delete"; ref: string }
  | { type: "clearAll" }
  | null;

type StatusFilter = "all" | AppointmentStatus;

type BarberOption = { value: string; label: string };
type StatusOption = { value: StatusFilter; label: string };

const statusFilterOptions: StatusOption[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Timed out" },
];

function canHideFromHistory(status: AppointmentStatus) {
  return status === "completed" || status === "cancelled" || status === "denied" || status === "expired";
}

function getCustomerActionClass(kind: "cancel" | "bookAgain", disabled: boolean) {
  if (disabled) {
    return "flex flex-col items-center gap-1.5 text-xs font-medium text-[var(--muted)] cursor-not-allowed select-none";
  }

  if (kind === "cancel") {
    return "flex flex-col items-center gap-1.5 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-70";
  }

  return "flex flex-col items-center gap-1.5 text-xs font-medium text-[var(--panel-highlight)] transition-opacity hover:opacity-70";
}

function getCustomerActionDotClass(kind: "cancel" | "bookAgain", disabled: boolean) {
  const base = "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors";
  if (disabled) return `${base} border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]`;
  if (kind === "cancel") return `${base} border-[var(--accent)] bg-[var(--accent)] text-white`;
  return `${base} border-[var(--panel-highlight)] bg-[var(--panel-highlight)] text-white`;
}

function getAppointmentSlotTimestamp(appointment: AppointmentRecord): number | null {
  const dateMatch = appointment.dateIso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = appointment.time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw] = dateMatch;
  const [, hourRaw, minuteRaw, periodRaw] = timeMatch;

  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);

  let hour = Number.parseInt(hourRaw, 10) % 12;
  if (periodRaw.toUpperCase() === "PM") {
    hour += 12;
  }

  const minute = Number.parseInt(minuteRaw, 10);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

export default function MyAppointmentsPage() {
  const { data: session, status } = useSession();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [statusChangeNotifications] = useState<AppointmentStatusChangeNotification[]>(
    () => {
      const notifications = getUnreadAppointmentStatusChangeNotifications();
      clearUnreadAppointmentStatusChangeNotifications();
      return notifications;
    }
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedBarber, setSelectedBarber] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusOption>(statusFilterOptions[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedBarberOption = useMemo<BarberOption>(
    () => ({ value: selectedBarber, label: selectedBarber === "all" ? "All barbers" : selectedBarber }),
    [selectedBarber],
  );

  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const isGuestMode = sessionEmail === "";

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      if (!active) {
        return;
      }

      if (status === "loading") {
        return;
      }

      if (!sessionEmail) {
        setAppointments(getStoredGuestAppointments());
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/appointments", {
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Unable to load appointments.",
          );
        }

        if (active) {
          setAppointments(Array.isArray(payload) ? (payload as AppointmentRecord[]) : []);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setAppointments([]);
          setError(requestError instanceof Error ? requestError.message : "Unable to load appointments.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAppointments();
    return () => {
      active = false;
    };
  }, [sessionEmail, status]);

  async function handleCancel(ref: string) {
    if (isGuestMode) {
      throw new Error("Sign in is required to cancel appointments.");
    }

    const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "cancelled",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Unable to cancel appointment.",
      );
    }

    setError(null);
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.ref === ref ? (payload as AppointmentRecord) : appointment,
      ),
    );
  }

  async function handleDelete(ref: string) {
    if (isGuestMode) {
      removeStoredGuestAppointment(ref);
      setAppointments((prev) => prev.filter((appointment) => appointment.ref !== ref));
      setError(null);
      return;
    }

    const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Unable to hide appointment.",
      );
    }

    setError(null);
    setAppointments((prev) => prev.filter((appointment) => appointment.ref !== ref));
  }

  const barberOptions = useMemo(() => {
    return Array.from(
      new Set(
        appointments
          .map((appointment) => appointment.barber.trim())
          .filter((barber) => barber.length > 0),
      ),
    ).sort((first, second) => first.localeCompare(second));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const matchesBarber = selectedBarber === "all" || appointment.barber.trim() === selectedBarber;
      const matchesStatus = selectedStatus.value === "all" || appointment.status === selectedStatus.value;
      return matchesBarber && matchesStatus;
    });
  }, [appointments, selectedBarber, selectedStatus]);

  async function handleClearAll() {
    if (isGuestMode) {
      const shouldRemove = (appointment: AppointmentRecord) =>
        selectedBarber === "all" || appointment.barber.trim() === selectedBarber;

      const remaining = appointments.filter((appointment) => !shouldRemove(appointment));
      setStoredGuestAppointments(remaining);
      setAppointments(remaining);
      setError(null);
      return;
    }

    const refsToDelete = filteredAppointments
      .filter((appointment) => canHideFromHistory(appointment.status))
      .map((appointment) => appointment.ref);

    await Promise.all(refsToDelete.map((ref) => handleDelete(ref)));
  }

  async function runConfirmAction() {
    if (!confirmAction) {
      return;
    }

    try {
      if (confirmAction.type === "cancel") {
        await handleCancel(confirmAction.ref);
      }

      if (confirmAction.type === "delete") {
        await handleDelete(confirmAction.ref);
      }

      if (confirmAction.type === "clearAll") {
        await handleClearAll();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update appointments.");
    } finally {
      setConfirmAction(null);
    }
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
          title: "Hide from history?",
          description: "This appointment will be removed from your history only.",
          confirmLabel: "Yes, hide",
        }
      : confirmAction?.type === "clearAll"
      ? {
          title: "Clear history?",
          description: "Completed, cancelled, denied, and timed out appointments will be removed from your history.",
          confirmLabel: "Yes, clear",
        }
      : null;

  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((first, second) => {
      const firstRank = statusRank[first.status];
      const secondRank = statusRank[second.status];

      if (firstRank !== secondRank) {
        return firstRank - secondRank;
      }

      const firstSlot = getAppointmentSlotTimestamp(first);
      const secondSlot = getAppointmentSlotTimestamp(second);

      if (firstSlot !== null && secondSlot !== null && firstSlot !== secondSlot) {
        return firstSlot - secondSlot;
      }

      if (firstSlot !== null && secondSlot === null) {
        return -1;
      }

      if (firstSlot === null && secondSlot !== null) {
        return 1;
      }

      const firstCreatedAt = new Date(first.createdAt).getTime();
      const secondCreatedAt = new Date(second.createdAt).getTime();

      return secondCreatedAt - firstCreatedAt;
    });
  }, [filteredAppointments]);

  const hasTerminalAppointments = filteredAppointments.some((appointment) =>
    canHideFromHistory(appointment.status),
  );

  const hasActiveFilter = selectedBarber !== "all" || selectedStatus.value !== "all";

  return (
    <main className="w-full min-h-screen bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,#efefef_0%,var(--section-sand)_100%)]">
      <div className="site-shell flex flex-col gap-8 py-[clamp(2.5rem,5vw,4.5rem)]">
      <section className="px-1 py-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
              Your visits
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              My appointments
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              Review your requests and manage active appointments.
            </p>
            {isGuestMode ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Guest mode: appointments are stored only on this device.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="border-l-2 border-[var(--border)] pl-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Total</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                {hasActiveFilter ? filteredAppointments.length : appointments.length}
                {hasActiveFilter ? (
                  <span className="ml-1.5 text-sm font-normal text-[var(--muted)]">/ {appointments.length}</span>
                ) : null}
              </p>
            </div>
            <Listbox value={selectedBarberOption} onChange={(option) => setSelectedBarber(option.value)}>
              <div className="flex flex-col gap-1 min-w-[12rem]">
                <Listbox.Label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Barber</Listbox.Label>
                <div className="relative">
                  <Listbox.Button className="w-full border-b border-[var(--border)] bg-transparent pb-2 text-left text-base text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]">
                    {selectedBarberOption.label}
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg outline-none">
                    <Listbox.Option value={{ value: "all", label: "All barbers" }} className="cursor-pointer rounded-lg px-3 py-2 text-base text-[var(--foreground)] data-[focus]:bg-[var(--accent-soft)]">
                      All barbers
                    </Listbox.Option>
                    {barberOptions.map((barber) => (
                      <Listbox.Option
                        key={barber}
                        value={{ value: barber, label: barber }}
                        className="cursor-pointer rounded-lg px-3 py-2 text-base text-[var(--foreground)] data-[focus]:bg-[var(--accent-soft)]"
                      >
                        {barber}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </div>
            </Listbox>
            <Listbox value={selectedStatus} onChange={setSelectedStatus}>
              <div className="flex flex-col gap-1 min-w-[12rem]">
                <Listbox.Label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Status</Listbox.Label>
                <div className="relative">
                  <Listbox.Button className="w-full border-b border-[var(--border)] bg-transparent pb-2 text-left text-base text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]">
                    {selectedStatus.label}
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg outline-none">
                    {statusFilterOptions.map((option) => (
                      <Listbox.Option
                        key={option.value}
                        value={option}
                        className="cursor-pointer rounded-lg px-3 py-2 text-base text-[var(--foreground)] data-[focus]:bg-[var(--accent-soft)]"
                      >
                        {option.label}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </div>
            </Listbox>
            {hasTerminalAppointments ? (
              <div className="flex items-center gap-3 border-l border-[var(--border)] pl-6">
                <button
                  type="button"
                  className="btn btn-compact"
                  onClick={() => setConfirmAction({ type: "clearAll" })}
                >
                  {isGuestMode ? "Clear local" : "Clear all"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {!isGuestMode && statusChangeNotifications.length > 0 ? (
          <div className="mt-5 rounded-[1.25rem] border border-[var(--tone-border-soft)] bg-[var(--surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Recent status updates
            </p>
            <div className="mt-2 space-y-1.5">
              {statusChangeNotifications.slice(0, 4).map((notification) => (
                <p key={notification.ref} className="text-sm text-[var(--foreground)]">
                  <span className="font-semibold">{notification.ref}</span> moved from{" "}
                  <span className="capitalize">{notification.from}</span> to{" "}
                  <span className="capitalize">{notification.to}</span> ({notification.dateLabel} at {notification.time})
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {isGuestMode ? (
          <div className="mt-5 rounded-[1.25rem] border border-[var(--tone-border-soft)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">
              Want synced history and live status updates across devices? Sign in anytime.
            </p>
            <Link
              className="mt-3 inline-flex w-fit items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-5 py-2 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              href="/"
            >
              Sign in
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        {isLoading ? (
          <div className="p-8 text-[var(--muted)]">Loading your appointments...</div>
        ) : error ? (
          <div className="p-8 text-[var(--accent-strong)]">{error}</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="flex flex-col gap-4 p-8">
            <p className="text-[var(--muted)]">
              {appointments.length === 0
                ? isGuestMode
                  ? "You have no locally saved guest appointments yet."
                  : "You do not have any appointments yet for this signed-in account."
                : "No appointments match the selected filters."}
            </p>
            <Link
              className="inline-flex w-fit items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              href="/book"
            >
              Book an appointment
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedAppointments.map((appointment) => {
              const canCancel =
                !isGuestMode &&
                (appointment.status === "pending" || appointment.status === "accepted");
              const canHide = isGuestMode || canHideFromHistory(appointment.status);
              const canBookAgain = canHide;

              return (
                <details
                  key={appointment.ref}
                  className={`group overflow-hidden rounded-2xl border shadow-[0_12px_28px_rgba(53,24,22,0.08)] ${statusCardClassMap[appointment.status]}`}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${statusStripeClassMap[appointment.status]}`} />
                  <summary className="relative cursor-pointer list-none px-4 py-4 pr-[12.75rem] [&::-webkit-details-marker]:hidden">
                    {canHide ? (
                      <button
                        type="button"
                        className={`${summaryIconButtonClassName} absolute right-[13.25rem] top-1/2 -translate-y-1/2`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setConfirmAction({ type: "delete", ref: appointment.ref });
                        }}
                        aria-label="Hide from history"
                        title="Hide from history"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12" />
                          <path d="M18 6L6 18" />
                        </svg>
                      </button>
                    ) : null}
                    <div className="flex flex-wrap items-start gap-4 md:grid md:grid-cols-[180px_1fr_1fr] md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Ref</p>
                        <p className="mt-1 font-mono text-xs text-[var(--muted)]">{appointment.ref}</p>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-[var(--foreground)]">{appointment.service}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{appointment.barber}</p>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-[var(--foreground)]">{appointment.dateLabel}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{appointment.time}</p>
                      </div>

                    </div>

                    <div className={`absolute inset-y-0 right-0 flex w-[11.75rem] items-center justify-between border-l-4 border-l-[var(--border)] px-3.5 py-2 ${statusSlipClassMap[appointment.status]} ${statusSlipEdgeClassMap[appointment.status]}`}>
                      <span className="flex h-full flex-col justify-center gap-1 leading-tight">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Status</span>
                        <span className="text-base font-semibold capitalize">{appointment.status}</span>
                      </span>
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="h-4 w-4 text-[var(--foreground)] opacity-75 transition-transform group-open:rotate-180"
                      >
                        <path
                          d="M6 8l4 5 4-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </summary>

                  <div className="border-t border-[var(--border)] bg-[color:rgba(255,255,255,0.42)] px-4 py-4 backdrop-blur-sm">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.4)] p-4">
                        <h3 className="text-base font-semibold text-[var(--foreground)]">Request details</h3>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-[var(--muted)]">Requested at</p>
                            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                              {new Date(appointment.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--muted)]">Name</p>
                            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{appointment.customerName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--muted)]">Email</p>
                            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{appointment.customerEmail}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--muted)]">Phone</p>
                            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{appointment.customerPhone}</p>
                          </div>
                          {appointment.notes ? (
                            <div className="sm:col-span-2">
                              <p className="text-xs text-[var(--muted)]">Notes</p>
                              <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{appointment.notes}</p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.4)] p-4">
                        <h3 className="text-base font-semibold text-[var(--foreground)]">Actions</h3>
                        <p className="mt-1 text-xs text-[var(--muted)]">Actions unlock as this request progresses.</p>
                        <div className="mt-4 flex items-center">
                          <button
                            type="button"
                            disabled={!canCancel}
                            className={getCustomerActionClass("cancel", !canCancel)}
                            onClick={() => {
                              if (!canCancel) return;
                              setConfirmAction({ type: "cancel", ref: appointment.ref });
                            }}
                          >
                            <span className={getCustomerActionDotClass("cancel", !canCancel)}>1</span>
                            Cancel
                          </button>
                          <div className="mx-2 h-px w-8 bg-[var(--border)]" />
                          {canBookAgain ? (
                            <Link
                              href={`/book?date=${encodeURIComponent(
                                appointment.dateIso,
                              )}&service=${encodeURIComponent(appointment.service)}&barber=${encodeURIComponent(
                                appointment.barber,
                              )}&time=${encodeURIComponent(appointment.time)}`}
                              className={getCustomerActionClass("bookAgain", false)}
                            >
                              <span className={getCustomerActionDotClass("bookAgain", false)}>2</span>
                              Book again
                            </Link>
                          ) : (
                            <span className={getCustomerActionClass("bookAgain", true)}>
                              <span className={getCustomerActionDotClass("bookAgain", true)}>2</span>
                              Book again
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
      </div>

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
                onClick={() => {
                  void runConfirmAction();
                }}
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
