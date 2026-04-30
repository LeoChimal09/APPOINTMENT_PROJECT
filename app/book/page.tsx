"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const primaryButtonClassName =
  "btn btn-primary btn-lg select-none";

const secondaryButtonClassName =
  "btn btn-secondary btn-secondary-accent btn-lg select-none";

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

function getBookingSelectionFromParams(params: URLSearchParams, currentMoment: Date) {
  const requestedServices = params.getAll("service").reduce<string[]>((accumulator, rawValue) => {
    for (const parsedValue of rawValue.split(",")) {
      const trimmedValue = parsedValue.trim();
      if (services.includes(trimmedValue)) {
        accumulator.push(trimmedValue);
      }
    }

    return accumulator;
  }, []);
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
    services: Array.from(new Set<string>(requestedServices)),
    barber: barbers.includes(requestedBarber) ? requestedBarber : "",
    time: selectedTime,
  };
}

export default function BookPage() {
  const [currentMoment] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(getInitialBookingDate(currentMoment)),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const hasAppliedQueryPrefill = useRef(false);

  useEffect(() => {
    if (hasAppliedQueryPrefill.current) {
      return;
    }

    const selection = getBookingSelectionFromParams(new URLSearchParams(window.location.search), currentMoment);
    setSelectedServices(selection.services);
    setSelectedBarber(selection.barber);
    setSelectedDate(selection.date);
    setSelectedTime(selection.time);
    setVisibleMonth(startOfMonth(selection.date ?? getInitialBookingDate(currentMoment)));
    hasAppliedQueryPrefill.current = true;
  }, [currentMoment]);

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
    <main className="w-full">
      <div className="home-band home-band--canvas">
        <div className="site-shell flex flex-col gap-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Customer booking
            </p>
            <h1 className="mt-2 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-tight tracking-tight text-[var(--foreground)]">
              Book your appointment
            </h1>
            <p className="mt-2 text-lg text-[var(--muted)]">
              Pick a date, choose your service and barber, then lock in a time.
            </p>
          </div>
        </div>
      </div>

      <div className="home-band home-band--sand">
        <div className="site-shell">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--card-bg-soft)] p-6 shadow-sm">
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
                      ? "cursor-not-allowed border-[var(--border)] bg-[var(--disabled-section-bg)] text-[var(--muted)] opacity-50"
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

        <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--card-bg-soft)] p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
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
              {!selectedDate ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Select a date first to see available times.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {availableTimes.map((time) => (
                  <button
                    key={time.label}
                    type="button"
                    onClick={() => setSelectedTime(time.label)}
                    className={`rounded-xl border py-2 text-center text-sm font-semibold transition ${
                      time.label === selectedTime
                        ? "border-[var(--accent-strong)] bg-[var(--button-primary)] text-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--button-secondary)]"
                    }`}
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
        </div>
      </div>
    </main>
  );
}