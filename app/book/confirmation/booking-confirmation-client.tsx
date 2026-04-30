"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentRecord } from "@/lib/appointments/appointment.types";
import { normalizeCustomerEmail, setStoredCustomerEmail } from "@/lib/appointments/customer-session";

const CONFIRMATION_DRAFT_PREFIX = "cutting_edge_confirmation_draft";

function getDayKey(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
}

function normalizeTimeLabel(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

const primaryButtonClassName =
  "btn btn-primary btn-lg";

const secondaryButtonClassName =
  "btn btn-secondary btn-secondary-accent btn-lg";

type Appointment = {
  service: string;
  barber: string;
  time: string;
  date: string;
  dateIso: string;
};

type BookingConfirmationClientProps = {
  appointment: Appointment;
  isPastSelection: boolean;
};

function getConfirmationDraftKey(appointment: Appointment) {
  return `${CONFIRMATION_DRAFT_PREFIX}:${appointment.dateIso}:${appointment.time}:${appointment.service}:${appointment.barber}`;
}

function getConfirmationDraft(appointment: Appointment) {
  if (typeof window === "undefined") {
    return {
      fullName: "",
      email: "",
      phone: "",
      notes: "",
    };
  }

  try {
    const rawDraft = localStorage.getItem(getConfirmationDraftKey(appointment));
    if (!rawDraft) {
      return {
        fullName: "",
        email: "",
        phone: "",
        notes: "",
      };
    }

    const parsedDraft = JSON.parse(rawDraft) as {
      fullName?: string;
      email?: string;
      phone?: string;
      notes?: string;
    };

    return {
      fullName: parsedDraft.fullName ?? "",
      email: parsedDraft.email ?? "",
      phone: parsedDraft.phone ?? "",
      notes: parsedDraft.notes ?? "",
    };
  } catch {
    return {
      fullName: "",
      email: "",
      phone: "",
      notes: "",
    };
  }
}

export function BookingConfirmationClient({ appointment, isPastSelection }: BookingConfirmationClientProps) {
  const router = useRouter();
  const confirmationDraftKey = getConfirmationDraftKey(appointment);
  const initialDraft = getConfirmationDraft(appointment);
  const [appointmentRef, setAppointmentRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState(initialDraft.fullName);
  const [email, setEmail] = useState(initialDraft.email);
  const [phone, setPhone] = useState(initialDraft.phone);
  const [notes, setNotes] = useState(initialDraft.notes);
  const [existingAppointment, setExistingAppointment] = useState<AppointmentRecord | null>(null);
  const shouldOverwriteExisting = false;
  const [isExactDateTimeConflict, setIsExactDateTimeConflict] = useState(false);
  const [conflictChoice, setConflictChoice] = useState<"pending" | "resolved" | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        confirmationDraftKey,
        JSON.stringify({
          fullName,
          email,
          phone,
          notes,
        }),
      );
    } catch {
      // no-op
    }
  }, [confirmationDraftKey, fullName, email, phone, notes]);

  async function getActiveSameDayAppointment() {
    const normalizedEmail = normalizeCustomerEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    const response = await fetch(`/api/appointments?email=${encodeURIComponent(normalizedEmail)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load existing appointments.");
    }

    const stored = (await response.json()) as AppointmentRecord[];
    const requestedDayKey = getDayKey(appointment.dateIso);

    return (
      stored.find(
        (a) =>
          a.status === "pending" &&
          ((requestedDayKey && getDayKey(a.dateIso) === requestedDayKey) ||
            a.dateLabel === appointment.date),
      ) ?? null
    );
  }

  async function handleOverwriteExistingAppointment() {
    if (!existingAppointment || !canSubmit || isSubmitting) {
      return;
    }

    const normalizedEmail = normalizeCustomerEmail(email);

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(existingAppointment.ref)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overwrite: true,
          service: appointment.service,
          barber: appointment.barber,
          dateIso: appointment.dateIso,
          dateLabel: appointment.date,
          time: appointment.time,
          customerName: fullName.trim(),
          customerEmail: normalizedEmail,
          customerPhone: phone.trim(),
          notes: notes.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to replace appointment.",
        );
      }

      const overwrittenAppointment = payload as AppointmentRecord;
      setStoredCustomerEmail(normalizedEmail);
      setAppointmentRef(overwrittenAppointment.ref);
      setSubmitSuccess(true);
      setConflictChoice("resolved");
      setIsConflictModalOpen(false);
      localStorage.removeItem(confirmationDraftKey);
      router.push("/appointments");
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error ? requestError.message : "Unable to replace appointment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLeaveConflictModal() {
    setIsConflictModalOpen(false);
  }

  function handleBookNewAppointment() {
    setIsConflictModalOpen(false);
    router.push("/book");
  }

  const canSubmit =
    fullName.trim() !== "" &&
    email.trim() !== "" &&
    phone.trim() !== "" &&
    !isPastSelection;

  async function handleRequestAppointment() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    const normalizedEmail = normalizeCustomerEmail(email);

    if (!shouldOverwriteExisting) {
      const activeSameDay = await getActiveSameDayAppointment();
      if (activeSameDay) {
        setExistingAppointment(activeSameDay);
        setIsExactDateTimeConflict(
          normalizeTimeLabel(activeSameDay.time) === normalizeTimeLabel(appointment.time),
        );
        setConflictChoice("pending");
        setIsConflictModalOpen(true);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: appointment.service,
          barber: appointment.barber,
          dateIso: appointment.dateIso,
          dateLabel: appointment.date,
          time: appointment.time,
          customerName: fullName.trim(),
          customerEmail: normalizedEmail,
          customerPhone: phone.trim(),
          notes: notes.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save appointment.",
        );
      }

      const createdAppointment = payload as AppointmentRecord;
      setStoredCustomerEmail(normalizedEmail);
      setAppointmentRef(createdAppointment.ref);
      setSubmitSuccess(true);
      localStorage.removeItem(confirmationDraftKey);
      router.push("/appointments");
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error ? requestError.message : "Unable to save appointment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full">
      {/* Conflict modal */}
      {conflictChoice === "pending" && existingAppointment && isConflictModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay-backdrop-soft)] p-6"
          onClick={handleLeaveConflictModal}
        >
          <div
            className="w-full max-w-3xl rounded-[2rem] border border-[var(--accent-strong)] bg-[color:var(--surface-elevated-strong)] p-8 shadow-[0_24px_80px_var(--shadow-elevated-strong)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Existing appointment found
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {isExactDateTimeConflict
                ? "You already have this exact appointment slot"
                : "You already have an appointment on this day"}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Existing appointment: <span className="font-semibold text-[var(--foreground)]">{existingAppointment.service}</span> with{" "}
              <span className="font-semibold text-[var(--foreground)]">{existingAppointment.barber}</span> at{" "}
              <span className="font-semibold text-[var(--accent-strong)]">{existingAppointment.time}</span> on{" "}
              <span className="font-semibold text-[var(--foreground)]">{existingAppointment.dateLabel}</span>.
            </p>
            <p className="mt-2 text-base leading-7 text-[var(--muted)]">
              {isExactDateTimeConflict
                ? "This matches your existing pending slot. You can replace it with the details from this form."
                : "You already have a pending appointment on this day. You can replace it with the details from this form."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  void handleOverwriteExistingAppointment();
                }}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Replacing..." : "Replace existing appointment"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={handleBookNewAppointment}
              >
                Book new appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="home-band home-band--canvas">
        <div className="site-shell">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
            Confirm booking
          </p>
          <h1 className="mt-2 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-tight tracking-tight text-[var(--foreground)]">
            Review your appointment
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Confirm the selected details and add your contact information.
          </p>
        </div>
      </div>

      <div className="home-band home-band--sand">
        <div className="site-shell">
          <section className="grid gap-8 md:grid-cols-[1.05fr_0.95fr] md:items-start">

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--card-bg-soft)] p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Contact details
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Tell us how to reach you
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Fields marked with * are required.</p>
            {isPastSelection ? (
              <p className="mt-2 text-sm font-medium text-[var(--accent-strong)]">
                This selected appointment time has already passed. Please go back and choose a future slot.
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--accent)]">Full name *</span>
                <input
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Jordan Carter"
                  required
                  aria-required="true"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--accent)]">Email *</span>
                <input
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jordan@example.com"
                  required
                  aria-required="true"
                />
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-[var(--accent)]">Phone number *</span>
                <input
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  aria-required="true"
                />
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-[var(--accent)]">Notes for the barber</span>
                <textarea
                  className="min-h-28 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional: lineup request, beard trim preference, or other details."
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className={`${primaryButtonClassName} ${canSubmit && !isSubmitting ? "" : "cursor-not-allowed opacity-60"}`}
              type="button"
              onClick={() => {
                handleRequestAppointment();
              }}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Sending request..." : "Request appointment"}
            </button>
            <Link className={secondaryButtonClassName} href="/book">
              Go back to edit
            </Link>
          </div>
          {submitError ? (
            <p className="text-sm font-medium text-[var(--accent-strong)]">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="text-sm font-medium text-[var(--accent-strong)]">
              Appointment saved. You can stay here or open My appointments when you are ready.
            </p>
          ) : null}
          {!canSubmit ? (
            <p className="text-sm font-medium text-[var(--accent-strong)]">
              {isPastSelection
                ? "You cannot request a past appointment. Please go back and choose a future date and time."
                : "Full name, email, and phone number are required before sending your request."}
            </p>
          ) : null}
        </div>

        <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">
            Request summary
          </p>
          <div className="mt-5 space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">Appointment</span>
              <span className="text-sm font-medium text-[var(--foreground)]">{appointment.service}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">Assigned barber</span>
              <span className="text-sm font-medium text-[var(--foreground)]">{appointment.barber}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">Requested slot</span>
              <span className="text-sm font-medium text-[var(--accent)]">{appointment.time}</span>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-sm text-[var(--muted)]">Contact</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {fullName || "Waiting for your contact details"}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{email || "No email added yet"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{phone || "No phone number added yet"}</p>
            </div>
            {notes ? (
              <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-sm text-[var(--muted)]">Notes</p>
                <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{notes}</p>
              </div>
            ) : null}
            <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-sm text-[var(--muted)]">Reference</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {appointmentRef ?? "Will be generated when the request is sent"}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-4">
              <p className="text-sm text-[var(--muted)]">Status</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {isPastSelection ? "Past time selected" : "Waiting for your confirmation"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {isPastSelection
                  ? "This slot is no longer valid. Return to the booking page and choose a future day and time."
                  : "Confirm the details on the left, add your contact info, and submit the request when you are ready."}
              </p>
            </div>
          </div>
        </aside>
      </section>
        </div>
      </div>
    </main>
  );
}