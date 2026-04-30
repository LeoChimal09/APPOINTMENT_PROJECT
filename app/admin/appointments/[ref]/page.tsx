"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  canTransitionAppointmentStatus,
  type AppointmentRecord,
  type AppointmentStatus,
} from "@/lib/appointments/appointment.types";

const workflowActionOrder: AppointmentStatus[] = ["accepted", "cancelled", "completed"];

const statusPillClassMap: Record<AppointmentStatus, string> = {
  pending: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border border-[var(--border)]",
  accepted: "bg-[var(--status-accepted-bg)] text-[var(--status-accepted-text)] border border-[var(--status-accepted-border)]",
  denied: "bg-[var(--status-denied-bg)] text-[var(--status-denied-text)] border border-[var(--status-denied-border)]",
  cancelled: "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border border-[var(--status-cancelled-border)]",
  completed: "bg-[var(--surface-soft)] text-[var(--muted)] border border-[var(--border)]",
};

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

function canHideFromDashboard(status: AppointmentStatus) {
  return status === "completed" || status === "denied" || status === "cancelled";
}

export default function AdminAppointmentDetailPage() {
  const params = useParams<{ ref: string }>();
  const ref = typeof params?.ref === "string" ? params.ref : "";
  const missingRefError = ref ? null : "Appointment reference is missing.";

  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [loading, setLoading] = useState(() => ref.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [isCancelNoteModalOpen, setIsCancelNoteModalOpen] = useState(false);
  const [cancelNoteInput, setCancelNoteInput] = useState("");

  useEffect(() => {
    if (!ref) {
      return;
    }

    let active = true;

    async function loadAppointment() {
      try {
        const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || typeof payload !== "object") {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Unable to load appointment.",
          );
        }

        if (active) {
          setAppointment(payload as AppointmentRecord);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load appointment.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAppointment();

    return () => {
      active = false;
    };
  }, [ref]);

  const workflowActions = useMemo(() => {
    if (!appointment) {
      return [] as AppointmentStatus[];
    }

    return workflowActionOrder.filter(
      (status) =>
        status !== appointment.status &&
        canTransitionAppointmentStatus(appointment.status, status),
    );
  }, [appointment]);

  async function handleStatusChange(status: AppointmentStatus, cancellationNote?: string) {
    if (!appointment) {
      return;
    }

    const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.ref)}`, {
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

    setAppointment(payload as AppointmentRecord);
    setError(null);
  }

  async function runAdminCancelWithOptionalNote() {
    try {
      await handleStatusChange("cancelled", cancelNoteInput);
      setError(null);
      setIsCancelNoteModalOpen(false);
      setCancelNoteInput("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update appointment status.",
      );
    }
  }

  async function handleHide() {
    if (!appointment) {
      return;
    }

    const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.ref)}`, {
      method: "DELETE",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Unable to hide appointment.",
      );
    }

    window.location.href = "/admin/appointments";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--section-warm-bg)] p-8 shadow-[0_24px_80px_var(--section-warm-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
              Appointment request
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {appointment ? appointment.customerName : "Loading..."}
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              Review appointment details and update workflow status.
            </p>
          </div>
          <Link
            href="/admin/appointments"
            className="rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
          >
            Back to requests
          </Link>
        </div>
      </section>

      {missingRefError || error ? (
        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--accent-strong)]">
          {missingRefError ?? error}
        </section>
      ) : loading ? (
        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--muted)]">
          Loading appointment...
        </section>
      ) : appointment ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Request details</h2>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusPillClassMap[appointment.status]}`}>
                {appointment.status}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Reference</p>
                <p className="mt-1 font-mono text-xs text-[var(--foreground)]">{appointment.ref}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Requested at</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {new Date(appointment.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Service</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.service}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Barber</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.barber}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Date</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.dateLabel}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Time</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.time}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Customer email</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.customerEmail}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Customer phone</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{appointment.customerPhone}</p>
              </div>
              {appointment.notes ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 sm:col-span-2">
                  <p className="text-xs text-[var(--muted)]">Notes</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{appointment.notes}</p>
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Update status</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Requests move forward through workflow, and complete unlocks only after accept.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {workflowActions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={getWorkflowButtonClass(status, false)}
                  onClick={() => {
                    if (!appointment) {
                      return;
                    }

                    if (status === "cancelled") {
                      setIsCancelNoteModalOpen(true);
                      setCancelNoteInput("");
                      return;
                    }

                    void handleStatusChange(status).catch((requestError) => {
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

              {workflowActions.length === 0 ? (
                <p className="col-span-full text-xs text-[var(--muted)]">No status actions available for this request.</p>
              ) : null}

              {canHideFromDashboard(appointment.status) ? (
                <button
                  type="button"
                  className="rounded-full border border-[var(--overlay-section)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--overlay-section-text)] transition hover:bg-[var(--overlay-section-hover)]"
                  onClick={() => {
                    void handleHide().catch((requestError) => {
                      setError(
                        requestError instanceof Error
                          ? requestError.message
                          : "Unable to hide appointment.",
                      );
                    });
                  }}
                >
                  Hide from dashboard
                </button>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {isCancelNoteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_var(--shadow-pop)]">
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
                  setIsCancelNoteModalOpen(false);
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
