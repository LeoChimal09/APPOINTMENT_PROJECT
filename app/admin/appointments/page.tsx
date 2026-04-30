"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  canTransitionAppointmentStatus,
  type AppointmentRecord,
  type AppointmentStatus,
} from "@/lib/appointments/appointment.types";

const statusPillClassMap: Record<AppointmentStatus, string> = {
  pending: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-[var(--border)]",
  accepted: "bg-[var(--status-accepted-bg)] text-[var(--status-accepted-text)] border border-[var(--status-accepted-border)]",
  denied: "bg-[var(--status-denied-bg)] text-[var(--status-denied-text)] border border-[var(--status-denied-border)]",
  cancelled: "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border border-[var(--status-cancelled-border)]",
  completed: "bg-[var(--surface-soft)] text-[var(--muted)] border border-[var(--border)]",
};

const statusCardClassMap: Record<AppointmentStatus, string> = {
  pending: "border-[var(--status-pending-card-border)] bg-[linear-gradient(145deg,var(--status-pending-card-from)_0%,var(--status-pending-card-to)_100%)]",
  accepted: "border-[var(--status-accepted-card-border)] bg-[linear-gradient(145deg,var(--status-accepted-card-from)_0%,var(--status-accepted-card-to)_100%)]",
  denied: "border-[var(--status-denied-card-border)] bg-[linear-gradient(145deg,var(--status-denied-card-from)_0%,var(--status-denied-card-to)_100%)]",
  cancelled: "border-[var(--status-cancelled-card-border)] bg-[linear-gradient(145deg,var(--status-cancelled-card-from)_0%,var(--status-cancelled-card-to)_100%)]",
  completed: "border-[var(--status-completed-card-border)] bg-[linear-gradient(145deg,var(--status-completed-card-from)_0%,var(--status-completed-card-to)_100%)]",
};

const statusStripeClassMap: Record<AppointmentStatus, string> = {
  pending: "from-[var(--status-pending-stripe-from)] to-[var(--status-pending-stripe-to)]",
  accepted: "from-[var(--status-accepted-stripe-from)] to-[var(--status-accepted-stripe-to)]",
  denied: "from-[var(--status-denied-stripe-from)] to-[var(--status-denied-stripe-to)]",
  cancelled: "from-[var(--status-cancelled-stripe-from)] to-[var(--status-cancelled-stripe-to)]",
  completed: "from-[var(--status-completed-stripe-from)] to-[var(--status-completed-stripe-to)]",
};

const statusOrder: AppointmentStatus[] = ["pending", "accepted", "denied", "cancelled", "completed"];
const workflowActionOrder: AppointmentStatus[] = ["accepted", "cancelled", "completed"];
const summaryIconButtonClassName =
  "btn-icon";

type ConfirmAction =
  | { type: "hide"; ref: string }
  | { type: "clearAll" }
  | null;

function canHideFromDashboard(status: AppointmentStatus) {
  return status === "completed" || status === "denied" || status === "cancelled";
}

function formatStatusAction(status: AppointmentStatus) {
  switch (status) {
    case "accepted":
      return "Accept";
    case "completed":
      return "Complete";
    case "cancelled":
      return "Cancel";
    default:
      return status;
  }
}

function getWorkflowButtonClass(status: AppointmentStatus, disabled: boolean) {
  const baseClassName = "btn btn-compact";

  if (disabled) {
    return `${baseClassName} cursor-not-allowed border-[var(--tone-border-mid)] bg-[var(--tone-surface-soft)] text-[var(--muted)]`;
  }

  if (status === "accepted") {
    return `${baseClassName} border-[var(--panel-highlight)] text-[var(--panel-highlight)] hover:bg-[var(--tone-surface-soft)]`;
  }

  if (status === "cancelled") {
    return `${baseClassName} border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--tone-surface-soft)]`;
  }

  return `${baseClassName} border-[var(--accent-soft)] text-[var(--accent-soft)] hover:bg-[var(--tone-surface-soft)]`;
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [cancelNoteTargetRef, setCancelNoteTargetRef] = useState<string | null>(null);
  const [cancelNoteInput, setCancelNoteInput] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments?scope=owner", {
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
          setError(requestError instanceof Error ? requestError.message : "Unable to load appointments.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAppointments();

    return () => {
      active = false;
    };
  }, []);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((first, second) => {
      const firstRank = statusOrder.indexOf(first.status);
      const secondRank = statusOrder.indexOf(second.status);

      if (firstRank !== secondRank) {
        return firstRank - secondRank;
      }

      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [appointments]);

  async function handleStatusChange(ref: string, status: AppointmentStatus, cancellationNote?: string) {
    const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        ...(cancellationNote && cancellationNote.trim() ? { cancellationNote: cancellationNote.trim() } : {}),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Unable to update appointment status.",
      );
    }

    setError(null);
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.ref === ref ? (payload as AppointmentRecord) : appointment,
      ),
    );
  }

  async function handleHideFromOwner(ref: string) {
    const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: "DELETE",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Unable to hide appointment from dashboard.",
      );
    }

    setError(null);
    setAppointments((currentAppointments) =>
      currentAppointments.filter((appointment) => appointment.ref !== ref),
    );
  }

  async function handleClearAll() {
    const refsToHide = appointments
      .filter((appointment) => canHideFromDashboard(appointment.status))
      .map((appointment) => appointment.ref);

    await Promise.all(refsToHide.map((ref) => handleHideFromOwner(ref)));
  }

  async function runConfirmAction() {
    if (!confirmAction) {
      return;
    }

    try {
      if (confirmAction.type === "hide") {
        await handleHideFromOwner(confirmAction.ref);
      }

      if (confirmAction.type === "clearAll") {
        await handleClearAll();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to hide appointment from dashboard.",
      );
    } finally {
      setConfirmAction(null);
    }
  }

  async function runAdminCancelWithOptionalNote() {
    if (!cancelNoteTargetRef) {
      return;
    }

    try {
      await handleStatusChange(cancelNoteTargetRef, "cancelled", cancelNoteInput);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update appointment status.",
      );
    } finally {
      setCancelNoteTargetRef(null);
      setCancelNoteInput("");
    }
  }

  const confirmationContent =
    confirmAction?.type === "hide"
      ? {
          title: "Hide this request?",
          description: "This request will be removed from the admin dashboard only.",
          confirmLabel: "Yes, hide",
        }
      : confirmAction?.type === "clearAll"
      ? {
          title: "Clear admin history?",
          description: "Completed, cancelled, and denied requests will be removed from this dashboard.",
          confirmLabel: "Yes, clear",
        }
      : null;

  const hasTerminalAppointments = appointments.some((appointment) =>
    canHideFromDashboard(appointment.status),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="px-1 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
              Admin appointments
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Appointment requests
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              Open a request to move it through the workflow and review all details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasTerminalAppointments ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmAction({ type: "clearAll" })}
              >
                Clear all
              </button>
            ) : null}
            <Link
              href="/admin"
              className="rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        {loading ? (
          <div className="p-8 text-[var(--muted)]">Loading appointments...</div>
        ) : error ? (
          <div className="p-8 text-[var(--accent-strong)]">{error}</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="p-8 text-[var(--muted)]">No appointment requests have been submitted yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedAppointments.map((appointment) => {
              const nextStatuses = workflowActionOrder.filter(
                (status) =>
                  status !== appointment.status &&
                  canTransitionAppointmentStatus(appointment.status, status),
              );

              return (
                <details
                  key={appointment.ref}
                  className={`group overflow-hidden rounded-2xl border shadow-[0_12px_28px_var(--card-section-shadow)] ${statusCardClassMap[appointment.status]}`}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${statusStripeClassMap[appointment.status]}`} />
                  <summary className="relative cursor-pointer list-none px-4 py-4 pr-14 [&::-webkit-details-marker]:hidden">
                    {canHideFromDashboard(appointment.status) ? (
                      <button
                        type="button"
                        className={`${summaryIconButtonClassName} absolute right-3 top-2`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setConfirmAction({ type: "hide", ref: appointment.ref });
                        }}
                        aria-label="Hide from dashboard"
                        title="Hide from dashboard"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12" />
                          <path d="M18 6L6 18" />
                        </svg>
                      </button>
                    ) : null}
                    <div className="flex flex-wrap items-start gap-4 md:grid md:grid-cols-[180px_1fr_1fr_120px] md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Ref</p>
                        <p className="mt-1 font-mono text-xs text-[var(--muted)]">{appointment.ref}</p>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-[var(--foreground)]">{appointment.customerName}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{appointment.customerEmail}</p>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-[var(--foreground)]">{appointment.service}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{appointment.barber} / {appointment.dateLabel} / {appointment.time}</p>
                      </div>

                      <div className="flex items-center justify-end gap-2 md:justify-self-end">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusPillClassMap[appointment.status]}`}>
                          {appointment.status}
                        </span>
                        <span className="text-xs text-[var(--muted)] transition group-open:rotate-180">▾</span>
                      </div>
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
                            <p className="text-xs text-[var(--muted)]">Customer</p>
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
                        <h3 className="text-base font-semibold text-[var(--foreground)]">Update status</h3>
                        <p className="mt-1 text-xs text-[var(--muted)]">Requests move forward through workflow, and complete unlocks only after accept.</p>
                        {nextStatuses.length > 0 ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {nextStatuses.map((status) => (
                              <button
                                key={`${appointment.ref}-${status}`}
                                type="button"
                                className={getWorkflowButtonClass(status, false)}
                                onClick={() => {
                                  if (status === "cancelled") {
                                    setCancelNoteTargetRef(appointment.ref);
                                    setCancelNoteInput("");
                                    return;
                                  }

                                  void handleStatusChange(appointment.ref, status).catch((requestError) => {
                                    setError(
                                      requestError instanceof Error
                                        ? requestError.message
                                        : "Unable to update appointment status.",
                                    );
                                  });
                                }}
                              >
                                {formatStatusAction(status)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--muted)]">No status actions available for this request.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
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

      {cancelNoteTargetRef ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(26,12,12,0.52)] p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_rgba(26,12,12,0.35)]">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Optional note
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              Add a cancellation note?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Add an optional reason for why this appointment is being cancelled.
            </p>
            <textarea
              className="mt-4 min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
              value={cancelNoteInput}
              onChange={(event) => setCancelNoteInput(event.target.value)}
              placeholder="Optional note"
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
                onClick={() => {
                  setCancelNoteTargetRef(null);
                  setCancelNoteInput("");
                }}
              >
                Keep request
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                onClick={() => {
                  void runAdminCancelWithOptionalNote();
                }}
              >
                Cancel request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
