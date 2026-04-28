"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canTransitionAppointmentStatus,
  type AppointmentRecord,
  type AppointmentStatus,
} from "@/lib/appointments/appointment.types";

const statusOptions: AppointmentStatus[] = ["pending", "accepted", "denied", "completed"];
const OWNER_TOKEN_STORAGE_KEY = "cutting_edge_owner_token";

const actionButtonClassName =
  "rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]";

function getStoredOwnerToken() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return sessionStorage.getItem(OWNER_TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function OwnerAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(() => getStoredOwnerToken().trim().length > 0);
  const [error, setError] = useState<string | null>(null);
  const [ownerTokenInput, setOwnerTokenInput] = useState(() => getStoredOwnerToken());
  const [ownerToken, setOwnerToken] = useState(() => getStoredOwnerToken());

  useEffect(() => {
    if (!ownerToken.trim()) {
      return;
    }

    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments?scope=owner", {
          cache: "no-store",
          headers: {
            "x-owner-token": ownerToken.trim(),
          },
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
  }, [ownerToken]);

  function handleSaveOwnerToken() {
    const trimmedToken = ownerTokenInput.trim();

    try {
      if (trimmedToken) {
        sessionStorage.setItem(OWNER_TOKEN_STORAGE_KEY, trimmedToken);
      } else {
        sessionStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
      }
    } catch {
      // no-op
    }

    setOwnerToken(trimmedToken);
    setAppointments([]);
    setError(null);
    setLoading(true);
  }

  function handleClearOwnerToken() {
    try {
      sessionStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
    } catch {
      // no-op
    }

  setOwnerTokenInput("");
    setOwnerToken("");
    setAppointments([]);
    setError(null);
    setLoading(false);
  }

  async function handleStatusChange(ref: string, status: AppointmentStatus) {
    const response = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-owner-token": ownerToken.trim(),
      },
      body: JSON.stringify({ status }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
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

  const groupedCounts = useMemo(() => {
    return statusOptions.reduce(
      (counts, status) => ({
        ...counts,
        [status]: appointments.filter((appointment) => appointment.status === status).length,
      }),
      {} as Record<AppointmentStatus, number>,
    );
  }, [appointments]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.92)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.12)]">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
          Owner review
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          Review incoming appointment requests
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          This table stores customer appointment requests and lets the owner move them through the workflow: pending, accepted, denied, and completed.
        </p>
        <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Owner access
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1">
              <span className="mb-2 block text-sm font-medium text-[var(--accent)]">Owner dashboard token</span>
              <input
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                type="password"
                value={ownerTokenInput}
                onChange={(event) => setOwnerTokenInput(event.target.value)}
                placeholder="Enter owner token"
              />
            </label>
            <div className="flex gap-2">
              <button className={actionButtonClassName} type="button" onClick={handleSaveOwnerToken}>
                Save token
              </button>
              <button className={actionButtonClassName} type="button" onClick={handleClearOwnerToken}>
                Clear token
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {statusOptions.map((status) => (
            <div key={status} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm uppercase tracking-[0.14em] text-[var(--muted)]">{status}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{groupedCounts[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {!ownerToken.trim() ? (
          <div className="p-8 text-[var(--muted)]">
            Enter the owner dashboard token to load and manage appointments.
          </div>
        ) : loading ? (
          <div className="p-8 text-[var(--muted)]">Loading appointments...</div>
        ) : error ? (
          <div className="p-8 text-[var(--accent-strong)]">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-[var(--muted)]">No appointment requests have been submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[var(--surface-soft)] text-left text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-4">Ref</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Appointment</th>
                  <th className="px-4 py-4">Contact</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.ref} className="border-t border-[var(--border)] align-top">
                    <td className="px-4 py-4 font-semibold text-[var(--foreground)]">{appointment.ref}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--foreground)]">{appointment.customerName}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Requested {new Date(appointment.createdAt).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--foreground)]">{appointment.service}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{appointment.barber} on {appointment.dateLabel}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{appointment.time}</p>
                      {appointment.notes ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">Note: {appointment.notes}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      <p>{appointment.customerEmail}</p>
                      <p className="mt-1 text-[var(--muted)]">{appointment.customerPhone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent-strong)]">
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {statusOptions
                          .filter((status) => canTransitionAppointmentStatus(appointment.status, status))
                          .map((status) => (
                            <button
                              key={status}
                              className={actionButtonClassName}
                              type="button"
                              onClick={() => {
                                void handleStatusChange(appointment.ref, status).catch((requestError) => {
                                  setError(
                                    requestError instanceof Error
                                      ? requestError.message
                                      : "Unable to update appointment status.",
                                  );
                                });
                              }}
                            >
                              {status}
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}