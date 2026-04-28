"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const primaryButtonClassName =
  "inline-flex select-none items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]";

const secondaryButtonClassName =
  "inline-flex select-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-6 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)] hover:border-[var(--accent-strong)]";

const services = ["Classic cut", "Fade + beard", "VIP grooming"];
const barbers = ["Luis", "Marcos", "Andrea"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const openingHours = Array.from({length: 15}, (_, index) => {
  const hour = index + 6;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return {
    hour,
    label: `${displayHour}:00 ${suffix}`,
  };
});

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getSlotDateTime(date: Date, hour: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    0,
    0,
    0,
  );
}

function getAvailableTimes(date: Date, currentMoment: Date) {
  return openingHours.filter((slot) => getSlotDateTime(date, slot.hour) > currentMoment);
}

function hasAvailableTimes(date: Date, currentMoment: Date) {
  return getAvailableTimes(date, currentMoment).length > 0;
}

function getInitialBookingDate(currentMoment: Date) {
  for (let offset = 0; offset < 31; offset += 1) {
    const candidate = addDays(currentMoment, offset);

    if (hasAvailableTimes(candidate, currentMoment)) {
      return candidate;
    }
  }

  return currentMoment;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getInitialBookingSelection(currentMoment: Date) {
  if (typeof window === "undefined") {
    return {
      date: null as Date | null,
      services: [] as string[],
      barber: "",
      time: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const requestedServices = (params.get("service") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => services.includes(value));
  const requestedBarber = params.get("barber") ?? "";
  const requestedDate = params.get("date");
  const requestedTime = params.get("time") ?? "";

  let selectedDate: Date | null = null;
  let selectedTime = "";

  if (requestedDate) {
    const parsedDate = new Date(requestedDate);
    if (!Number.isNaN(parsedDate.getTime()) && hasAvailableTimes(parsedDate, currentMoment)) {
      selectedDate = parsedDate;

      if (requestedTime) {
        const isValidTime = getAvailableTimes(parsedDate, currentMoment).some(
          (slot) => slot.label === requestedTime,
        );
        if (isValidTime) {
          selectedTime = requestedTime;
        }
      }
    }
  }

  return {
    date: selectedDate,
    services: Array.from(new Set(requestedServices)),
    barber: barbers.includes(requestedBarber) ? requestedBarber : "",
    time: selectedTime,
  };
}

export default function BookPage() {
  const [currentMoment] = useState(() => new Date());
  const [initialSelection] = useState(() => getInitialBookingSelection(currentMoment));
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(initialSelection.date ?? getInitialBookingDate(currentMoment)),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialSelection.date);
  const [selectedServices, setSelectedServices] = useState<string[]>(initialSelection.services);
  const [selectedBarber, setSelectedBarber] = useState(initialSelection.barber);
  const [selectedTime, setSelectedTime] = useState(initialSelection.time);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const leadingEmptyDays = monthStart.getDay();

    return Array.from({length: leadingEmptyDays + daysInMonth}, (_, index) => {
      if (index < leadingEmptyDays) {
        return null;
      }

      return new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - leadingEmptyDays + 1);
    });
  }, [visibleMonth]);

  const availableTimes = useMemo(
    () => (selectedDate ? getAvailableTimes(selectedDate, currentMoment) : []),
    [selectedDate, currentMoment],
  );

  const monthLabel = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Not selected";

  const canViewPreviousMonth = startOfMonth(visibleMonth) > startOfMonth(currentMoment);
  const canContinue =
    selectedDate !== null &&
    selectedServices.length > 0 &&
    selectedBarber !== "" &&
    selectedTime !== "";

  const confirmationHref = `/book/confirmation?date=${encodeURIComponent(
    selectedDate?.toISOString() ?? "",
  )}&service=${encodeURIComponent(selectedServices.join(", "))}&barber=${encodeURIComponent(
    selectedBarber,
  )}&time=${encodeURIComponent(selectedTime)}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="grid gap-6 rounded-[2rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.92)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.12)] md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-1 text-sm font-medium text-[var(--accent-strong)]">
            Customer booking calendar
          </span>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
              Select a day, then lock in your time.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Admin scheduling is not set up yet, so every day is currently open. Customers can choose any date and book between 6:00 AM and 8:00 PM.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Selected date</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{selectedDateLabel}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Open hours</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">6:00 AM - 8:00 PM</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Booking status</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {canContinue ? "Ready to continue" : "Select date, service, barber, and time"}
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.75rem] bg-[radial-gradient(circle_at_top,_rgba(240,196,108,0.2),_rgba(255,255,255,0)_56%),linear-gradient(135deg,var(--panel),#3d0d16)] p-6 text-[var(--surface)] shadow-inner">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
            Current selection
          </p>
          <div className="mt-5 space-y-3 rounded-[1.5rem] border border-[color:rgba(244,228,195,0.14)] bg-[var(--panel-card)] p-4">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Service</span>
              <span className="text-sm font-medium text-[var(--surface)]">
                {selectedServices.length > 0 ? selectedServices.join(", ") : "Not selected"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Barber</span>
              <span className="text-sm font-medium text-[var(--surface)]">{selectedBarber}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
              <span className="text-sm text-[var(--panel-text-muted)]">Time</span>
              <span className="text-sm font-medium text-[var(--panel-highlight)]">{selectedTime}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Booking calendar
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{monthLabel}</h2>
            </div>
            <div className="flex gap-2">
              <button
                className={`${secondaryButtonClassName} ${canViewPreviousMonth ? "" : "cursor-not-allowed opacity-60"}`}
                type="button"
                disabled={!canViewPreviousMonth}
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
              >
                Previous
              </button>
              <button
                className={secondaryButtonClassName}
                type="button"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-2">
                {weekday}
              </span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square rounded-2xl" />;
              }

              const unavailable = !hasAvailableTimes(day, currentMoment);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;

              return (
                <button
                  key={day.toISOString()}
                  className={`aspect-square rounded-2xl border text-sm font-medium transition ${
                    unavailable
                      ? "cursor-not-allowed border-[var(--border)] bg-[color:rgba(239,223,198,0.45)] text-[var(--muted)] opacity-50"
                      : selected
                      ? "border-[var(--accent-strong)] bg-[var(--button-primary)] text-[var(--surface)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--button-secondary)]"
                  }`}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    setSelectedDate(day);

                    if (!getAvailableTimes(day, currentMoment).some((slot) => slot.label === selectedTime)) {
                      setSelectedTime("");
                    }
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Booking details
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Choose a service</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {services.map((service) => (
                  <button
                    key={service}
                    className={selectedServices.includes(service) ? primaryButtonClassName : secondaryButtonClassName}
                    type="button"
                    onClick={() => {
                      setSelectedServices((currentServices) =>
                        currentServices.includes(service)
                          ? currentServices.filter((item) => item !== service)
                          : [...currentServices, service],
                      );
                    }}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Choose a barber</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {barbers.map((barber) => (
                  <button
                    key={barber}
                    className={barber === selectedBarber ? primaryButtonClassName : secondaryButtonClassName}
                    type="button"
                    onClick={() => setSelectedBarber(barber)}
                  >
                    {barber}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Available times</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Open every day from 6:00 AM to 8:00 PM. Past times are automatically removed.
              </p>
              {!selectedDate ? (
                <p className="mt-3 text-sm font-medium text-[var(--accent-strong)]">
                  Select a date first to view available times.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableTimes.map((time) => (
                  <button
                    key={time.label}
                    className={time.label === selectedTime ? primaryButtonClassName : secondaryButtonClassName}
                    type="button"
                    onClick={() => setSelectedTime(time.label)}
                  >
                    {time.label}
                  </button>
                ))}
              </div>
              {selectedDate && availableTimes.length === 0 ? (
                <p className="mt-3 text-sm font-medium text-[var(--accent-strong)]">
                  There are no remaining bookable times for this day. Please choose another date.
                </p>
              ) : null}
            </div>

            {canContinue ? (
              <Link className={`${primaryButtonClassName} w-full`} href={confirmationHref}>
                Continue to confirmation
              </Link>
            ) : (
              <span className={`${primaryButtonClassName} w-full cursor-not-allowed opacity-60`}>
                Continue to confirmation
              </span>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}