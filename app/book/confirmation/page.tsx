import { BookingConfirmationClient } from "@/app/book/confirmation/booking-confirmation-client";
import Link from "next/link";

type ConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDateIsoInput(value: string) {
  const trimmed = value.trim();
  const directIsoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (directIsoMatch) {
    return directIsoMatch[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

export default async function BookingConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const rawDate = getSingleValue(resolvedSearchParams.date);
  const requestedService = getSingleValue(resolvedSearchParams.service);
  const requestedBarber = getSingleValue(resolvedSearchParams.barber);
  const requestedTime = getSingleValue(resolvedSearchParams.time);

  if (!rawDate || !requestedService || !requestedBarber || !requestedTime) {
    return (
      <div className="admin-page">
        <section className="admin-section admin-section--primary">
          <div className="site-shell flex min-h-[70vh] items-center justify-center">
            <div className="w-full max-w-4xl rounded-[2rem] border border-[var(--border)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_80px_var(--shadow-elevated)]">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
                Booking confirmation
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Select your booking details first
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Confirmation requires a selected date, service, barber, and time. Please return to booking and choose your options.
              </p>
              <Link
                href="/book"
                className="mt-6 inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              >
                Go to booking
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const normalizedDateIso = normalizeDateIsoInput(rawDate);
  const normalizedHour = parseHourFromLabel(requestedTime);

  if (!normalizedDateIso || normalizedHour === null) {
    return (
      <div className="admin-page">
        <section className="admin-section admin-section--primary">
          <div className="site-shell flex min-h-[70vh] items-center justify-center">
            <div className="w-full max-w-4xl rounded-[2rem] border border-[var(--border)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_80px_var(--shadow-elevated)]">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
                Booking confirmation
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Invalid booking details
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
                The selected booking details are not valid. Please return to booking and select a valid date and time.
              </p>
              <Link
                href="/book"
                className="mt-6 inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
              >
                Go to booking
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const appointmentDateTime = new Date(
    Number.parseInt(normalizedDateIso.slice(0, 4), 10),
    Number.parseInt(normalizedDateIso.slice(5, 7), 10) - 1,
    Number.parseInt(normalizedDateIso.slice(8, 10), 10),
    normalizedHour,
    0,
    0,
    0,
  );
  const displayDate = new Date(`${normalizedDateIso}T12:00:00Z`);
  const formattedDate = displayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const appointment = {
    service: requestedService,
    barber: requestedBarber,
    time: requestedTime,
    date: formattedDate,
    dateIso: normalizedDateIso,
  };

  return (
    <BookingConfirmationClient
      appointment={appointment}
      isPastSelection={appointmentDateTime <= new Date()}
    />
  );
}

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