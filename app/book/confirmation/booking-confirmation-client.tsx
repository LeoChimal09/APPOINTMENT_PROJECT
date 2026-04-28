"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentRecord } from "@/lib/appointments/appointment.types";

const STORAGE_KEY = "cutting_edge_appointments";
const CONFIRMATION_DRAFT_PREFIX = "cutting_edge_confirmation_draft";

function saveAppointmentLocally(appointment: AppointmentRecord) {
  const existing: AppointmentRecord[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify([appointment, ...existing]));
}

function generateRef() {
  return `APT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

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
  "inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]";

const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-6 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)] hover:border-[var(--accent-strong)]";

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

  function getActiveSameDayAppointment() {
    const stored: AppointmentRecord[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    const requestedDayKey = getDayKey(appointment.dateIso);

    return (
      stored.find(
        (a) =>
          (a.status === "pending" || a.status === "accepted") &&
          ((requestedDayKey && getDayKey(a.dateIso) === requestedDayKey) ||
            a.dateLabel === appointment.date),
      ) ?? null
    );
  }

  function handleCancelExisting() {
    setIsConflictModalOpen(false);
    router.push("/appointments");
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

  function handleRequestAppointment() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    if (!shouldOverwriteExisting) {
      const activeSameDay = getActiveSameDayAppointment();
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
      if (shouldOverwriteExisting && existingAppointment) {
        const updated: AppointmentRecord[] = JSON.parse(
          localStorage.getItem(STORAGE_KEY) ?? "[]",
        ).map((a: AppointmentRecord) =>
          a.ref === existingAppointment.ref
            ? {
                ...a,
                status: "pending" as const,
                service: appointment.service,
                barber: appointment.barber,
                dateIso: appointment.dateIso,
                dateLabel: appointment.date,
                time: appointment.time,
                customerName: fullName.trim(),
                customerEmail: email.trim().toLowerCase(),
                customerPhone: phone.trim(),
                notes: notes.trim() || null,
              }
            : a,
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setAppointmentRef(existingAppointment.ref);
      } else {
        const createdAppointment: AppointmentRecord = {
          ref: generateRef(),
          createdAt: new Date().toISOString(),
          status: "pending",
          service: appointment.service,
          barber: appointment.barber,
          dateIso: appointment.dateIso,
          dateLabel: appointment.date,
          time: appointment.time,
          customerName: fullName.trim(),
          customerEmail: email.trim().toLowerCase(),
          customerPhone: phone.trim(),
          notes: notes.trim() || null,
        };

        saveAppointmentLocally(createdAppointment);
        setAppointmentRef(createdAppointment.ref);
      }
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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      {/* Conflict modal — shown when user already has an active same-day appointment */}
      {conflictChoice === "pending" && existingAppointment && isConflictModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(27,13,12,0.45)] p-6"
          onClick={handleLeaveConflictModal}
        >
          <div
            className="w-full max-w-3xl rounded-[2rem] border border-[var(--accent-strong)] bg-[color:rgba(248,237,220,0.98)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.28)]"
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
                ? "This matches your existing day and time. You can view your current booking, or choose Edit existing and save this request to overwrite it."
                : "You can view your current booking, or choose Edit existing and save this request to overwrite the original appointment."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                onClick={handleCancelExisting}
              >
                Replace existing appointment
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-6 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
                onClick={handleBookNewAppointment}
              >
                Book new appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 rounded-[2rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.92)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.12)] md:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl">
              Review your appointment before you request it.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
              Confirm the selected details and add your contact information.
            </p>
          </div>

          <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Contact details
              </p>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                Tell us how to reach you
              </h2>
              <p className="text-sm text-[var(--muted)]">Fields marked with * are required.</p>
              {isPastSelection ? (
                <p className="text-sm font-medium text-[var(--accent-strong)]">
                  This selected appointment time has already passed. Please go back and choose a future slot.
                </p>
              ) : null}
            </div>

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
          </section>

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

        <aside className="rounded-[1.75rem] bg-[radial-gradient(circle_at_top,_rgba(240,196,108,0.2),_rgba(255,255,255,0)_56%),linear-gradient(135deg,var(--panel),#3d0d16)] p-6 text-[var(--surface)] shadow-inner">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
            Request summary
          </p>
          <div className="mt-5 space-y-3 rounded-[1.5rem] border border-[color:rgba(244,228,195,0.14)] bg-[var(--panel-card)] p-4">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Appointment</span>
              <span className="text-sm font-medium text-[var(--surface)]">{appointment.service}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Assigned barber</span>
              <span className="text-sm font-medium text-[var(--surface)]">{appointment.barber}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Requested slot</span>
              <span className="text-sm font-medium text-[var(--panel-highlight)]">{appointment.time}</span>
            </div>
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-4">
              <p className="text-sm text-[var(--panel-text-muted)]">Contact</p>
              <p className="mt-2 text-lg font-semibold text-[var(--surface)]">
                {fullName || "Waiting for your contact details"}
              </p>
              <p className="mt-2 text-sm text-[var(--panel-text-muted)]">{email || "No email added yet"}</p>
              <p className="mt-1 text-sm text-[var(--panel-text-muted)]">{phone || "No phone number added yet"}</p>
            </div>
            {notes ? (
              <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-4">
                <p className="text-sm text-[var(--panel-text-muted)]">Notes</p>
                <p className="mt-2 text-sm leading-7 text-[var(--surface)]">{notes}</p>
              </div>
            ) : null}
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-4">
              <p className="text-sm text-[var(--panel-text-muted)]">Reference</p>
              <p className="mt-2 text-lg font-semibold text-[var(--surface)]">
                {appointmentRef ?? "Will be generated when the request is sent"}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-card-strong)] px-4 py-4">
              <p className="text-sm text-[var(--panel-text-muted)]">Status</p>
              <p className="mt-2 text-lg font-semibold text-[var(--surface)]">
                {isPastSelection ? "Past time selected" : "Waiting for your confirmation"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--panel-text-muted)]">
                {isPastSelection
                  ? "This slot is no longer valid. Return to the booking page and choose a future day and time."
                  : "Confirm the details on the left, add your contact info, and submit the request when you are ready."}
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}