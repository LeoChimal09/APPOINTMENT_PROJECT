"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const primaryButtonClassName =
  "btn btn-primary btn-lg select-none";

const secondaryButtonClassName =
  "btn btn-secondary btn-secondary-accent btn-lg select-none";

const services = (process.env.NEXT_PUBLIC_SERVICES || "Classic cut,Fade + beard,VIP grooming").split(",").map(s => s.trim());
const fallbackBarbers = (process.env.NEXT_PUBLIC_BARBERS || "Luis,Marcos,Andrea").split(",").map(b => b.trim());
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type StaffMember = {
  id: number;
  name: string;
  isActive: boolean;
};

type TimeSlot = {
  hour: number;
  label: string;
};

type BuildingHoursEntry = {
  weekday: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

function parseTimeLabelToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, rawHour, rawMinutes, rawPeriod] = match;
  const period = rawPeriod.toUpperCase();
  let hour = Number.parseInt(rawHour, 10) % 12;
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hour) || Number.isNaN(minutes)) {
    return null;
  }

  if (period === "PM") {
    hour += 12;
  }

  return (hour * 60) + minutes;
}

function createBuildingHoursByWeekday(entries: BuildingHoursEntry[]): Record<number, BuildingHoursEntry> {
  const result: Record<number, BuildingHoursEntry> = {};

  for (const entry of entries) {
    result[entry.weekday] = entry;
  }

  return result;
}

function getSlotsForBuildingEntry(entry: BuildingHoursEntry | undefined): TimeSlot[] {
  if (!entry || !entry.isOpen) {
    return [];
  }

  const startMinutes = parseTimeLabelToMinutes(entry.startTime);
  const endMinutes = parseTimeLabelToMinutes(entry.endTime);
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return [];
  }

  const startHour = Math.floor(startMinutes / 60);
  const endHour = Math.ceil(endMinutes / 60);
  const slots: TimeSlot[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    slots.push({
      hour,
      label: `${displayHour}:00 ${suffix}`,
    });
  }

  return slots;
}

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

function toDateIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateIsoAsLocal(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);
  const day = Number.parseInt(rawDay, 10);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function toMonthIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTimeForDisplay(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookPage() {
  // Validate time slot availability against ranking system:
  // 1. Building Hours (highest priority)
  // 2. Staff Hours (medium priority)
  // 3. Customer Accepted Appointments (lowest priority)
  const [currentMoment] = useState(() => new Date());
  const [buildingHoursByWeekday, setBuildingHoursByWeekday] = useState<Record<number, BuildingHoursEntry>>({});
  const [hasLoadedBuildingHours, setHasLoadedBuildingHours] = useState(false);
  
  // Helper functions that depend on building hours from schema
  const getTimeSlotsForDate = useCallback((date: Date): TimeSlot[] => {
    const weekday = date.getDay();
    return getSlotsForBuildingEntry(buildingHoursByWeekday[weekday]);
  }, [buildingHoursByWeekday]);

  const getAvailableTimes = useCallback((date: Date, currentMomentParam: Date): TimeSlot[] => {
    return getTimeSlotsForDate(date).filter((slot) => getSlotDateTime(date, slot.hour) > currentMomentParam);
  }, [getTimeSlotsForDate]);

  const hasAvailableTimes = useCallback((date: Date, currentMomentParam: Date): boolean => {
    return getAvailableTimes(date, currentMomentParam).length > 0;
  }, [getAvailableTimes]);

  const getInitialBookingDate = useCallback((currentMomentParam: Date): Date => {
    for (let offset = 0; offset < 31; offset += 1) {
      const candidate = addDays(currentMomentParam, offset);
      if (hasAvailableTimes(candidate, currentMomentParam)) {
        return candidate;
      }
    }
    return currentMomentParam;
  }, [hasAvailableTimes]);

  const getBookingSelectionFromParams = useCallback((
    params: URLSearchParams,
    currentMomentParam: Date,
    barbersParam: string[],
  ): { date: Date | null; services: string[]; barber: string; time: string } => {
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
      const parsedDate = parseDateIsoAsLocal(requestedDate);
      if (parsedDate && hasAvailableTimes(parsedDate, currentMomentParam)) {
        selectedDate = parsedDate;

        if (requestedTime) {
          const isValidTime = getAvailableTimes(parsedDate, currentMomentParam).some(
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
      barber: barbersParam.includes(requestedBarber) ? requestedBarber : "",
      time: selectedTime,
    };
  }, [getAvailableTimes, hasAvailableTimes]);

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(getInitialBookingDate(currentMoment)),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [barbers, setBarbers] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [validatedAvailability, setValidatedAvailability] = useState<Record<number, boolean>>({});
  const [aggregateTimeAvailability, setAggregateTimeAvailability] = useState<Record<number, boolean>>({});
  const [barberTimeAvailability, setBarberTimeAvailability] = useState<Record<string, Record<number, boolean>>>({});
  const [calendarAvailability, setCalendarAvailability] = useState<Record<string, boolean>>({});
  const [barberAvailability, setBarberAvailability] = useState<Record<string, boolean>>({});
  const [hasLoadedBarbers, setHasLoadedBarbers] = useState(false);
  const hasAppliedQueryPrefill = useRef(false);

  type BatchedAvailabilityResponse = {
    hours: Record<string, { available: boolean }>;
  };

  type MonthlyAvailabilityResponse = {
    dates: Record<string, { available: boolean }>;
  };

  const loadDayAvailability = useCallback(async (dateIso: string, barber: string): Promise<BatchedAvailabilityResponse> => {
    const response = await fetch(
      `/api/appointments/availability?date=${dateIso}&barber=${encodeURIComponent(barber)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to load day availability");
    }

    return (await response.json()) as BatchedAvailabilityResponse;
  }, []);

  const loadMonthAvailability = useCallback(async (monthIso: string, barber: string): Promise<MonthlyAvailabilityResponse> => {
    const response = await fetch(
      `/api/appointments/availability?month=${monthIso}&barber=${encodeURIComponent(barber)}`,
    );

    if (!response.ok) {
      throw new Error("Failed to load month availability");
    }

    return (await response.json()) as MonthlyAvailabilityResponse;
  }, []);

  // Load building hours from database (source of truth for slot generation)
  useEffect(() => {
    let cancelled = false;

    async function loadBuildingHours() {
      try {
        const response = await fetch("/api/building-hours", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load building hours");
        }

        const data = (await response.json()) as BuildingHoursEntry[];
        if (!cancelled) {
          setBuildingHoursByWeekday(createBuildingHoursByWeekday(data));
        }
      } catch (error) {
        console.error("Failed to load building hours:", error);
        if (!cancelled) {
          setBuildingHoursByWeekday({});
        }
      } finally {
        if (!cancelled) {
          setHasLoadedBuildingHours(true);
        }
      }
    }

    void loadBuildingHours();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBarbers() {
      try {
        const response = await fetch("/api/staff?activeOnly=true", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load staff");
        }

        const data = (await response.json()) as StaffMember[];
        const nextBarbers = data
          .filter((member) => member.isActive)
          .map((member) => member.name.trim())
          .filter(Boolean);

        if (!cancelled) {
          setBarbers(nextBarbers.length > 0 ? nextBarbers : fallbackBarbers);
        }
      } catch (error) {
        console.error("Failed to load barbers:", error);
        if (!cancelled) {
          setBarbers(fallbackBarbers);
        }
      } finally {
        if (!cancelled) {
          setHasLoadedBarbers(true);
        }
      }
    }

    void loadBarbers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBarberAvailability() {
      if (!hasLoadedBuildingHours) {
        return;
      }

      if (!selectedDate || barbers.length === 0) {
        setBarberAvailability({});
        setAggregateTimeAvailability({});
        setBarberTimeAvailability({});
        return;
      }

      const dateIso = toDateIso(selectedDate);
      const daySlots = getAvailableTimes(selectedDate, currentMoment);

      if (daySlots.length === 0) {
        setBarberAvailability(Object.fromEntries(barbers.map((barber) => [barber, false])));
        setAggregateTimeAvailability({});
        setBarberTimeAvailability({});
        return;
      }

      try {
        const results = await Promise.all(
          barbers.map(async (barber) => {
            const data = await loadDayAvailability(dateIso, barber).catch(
              (): BatchedAvailabilityResponse => ({ hours: {} }),
            );
            const isAvailable = daySlots.some(
              (slot) => data.hours?.[String(slot.hour)]?.available === true,
            );

            const availableHours = Object.fromEntries(
              daySlots.map((slot) => [slot.hour, data.hours?.[String(slot.hour)]?.available === true]),
            );

            return [barber, isAvailable, availableHours] as const;
          }),
        );

        if (!cancelled) {
          setBarberAvailability(Object.fromEntries(results.map(([barber, isAvailable]) => [barber, isAvailable])));
          setBarberTimeAvailability(
            Object.fromEntries(
              results.map(([barber, , availableHours]) => [barber, availableHours as Record<number, boolean>]),
            ) as Record<string, Record<number, boolean>>,
          );
          setAggregateTimeAvailability(
            Object.fromEntries(
              daySlots.map((slot) => [
                slot.hour,
                results.some(([, , availableHours]) => (availableHours as Record<string, boolean>)[String(slot.hour)] === true),
              ]),
            ),
          );
        }
      } catch (error) {
        console.error("Failed to load barber availability:", error);
        if (!cancelled) {
          setBarberAvailability(
            Object.fromEntries(barbers.map((barber) => [barber, false])),
          );
          setBarberTimeAvailability({});
          setAggregateTimeAvailability(
            Object.fromEntries(daySlots.map((slot) => [slot.hour, false])),
          );
        }
      }
    }

    void loadBarberAvailability();

    return () => {
      cancelled = true;
    };
  }, [barbers, selectedDate, getAvailableTimes, currentMoment, hasLoadedBuildingHours, loadDayAvailability]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendarAvailability() {
      if (barbers.length === 0) {
        setCalendarAvailability({});
        return;
      }

      try {
        const monthIso = toMonthIso(visibleMonth);

        if (selectedBarber && barbers.includes(selectedBarber)) {
          const data = await loadMonthAvailability(monthIso, selectedBarber);

          if (!cancelled) {
            setCalendarAvailability(
              Object.fromEntries(
                Object.entries(data.dates ?? {}).map(([dateIso, result]) => [dateIso, result.available !== false]),
              ),
            );
          }

          return;
        }

        const results = await Promise.all(
          barbers.map(async (barber) => {
            return loadMonthAvailability(monthIso, barber).catch(() => null);
          }),
        );

        const allDates = new Set(
          results.flatMap((result) => Object.keys(result?.dates ?? {})),
        );

        const aggregatedAvailability = Object.fromEntries(
          Array.from(allDates).map((dateIso) => [
            dateIso,
            results.some((result) => result?.dates?.[dateIso]?.available === true),
          ]),
        );

        if (!cancelled) {
          setCalendarAvailability(aggregatedAvailability);
        }
      } catch (error) {
        console.error("Failed to load calendar availability:", error);
        if (!cancelled) {
          setCalendarAvailability({});
        }
      }
    }

    void loadCalendarAvailability();

    return () => {
      cancelled = true;
    };
  }, [barbers, selectedBarber, visibleMonth, loadMonthAvailability]);

  // When date and barber are selected, validate time slots via API
  useEffect(() => {
    let cancelled = false;

    async function validateSlots() {
      if (!selectedDate || !selectedBarber || !barbers.includes(selectedBarber)) {
        setValidatedAvailability({});
        return;
      }

      const dateIso = toDateIso(selectedDate);

      try {
        const data = await loadDayAvailability(dateIso, selectedBarber);
        const daySlots = getTimeSlotsForDate(selectedDate);

        if (!cancelled) {
          setValidatedAvailability(
            Object.fromEntries(
              daySlots.map((slot) => [slot.hour, data.hours?.[String(slot.hour)]?.available !== false]),
            ),
          );
        }
      } catch (error) {
        console.error("Failed to check availability:", error);
        const daySlots = getTimeSlotsForDate(selectedDate);
        if (!cancelled) {
          setValidatedAvailability(
            Object.fromEntries(daySlots.map((slot) => [slot.hour, false])),
          );
        }
      }
    }

    void validateSlots();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedBarber, barbers, getTimeSlotsForDate, loadDayAvailability]);

  useEffect(() => {
    if (!hasLoadedBarbers) {
      return;
    }

    if (hasAppliedQueryPrefill.current) {
      return;
    }

    const selection = getBookingSelectionFromParams(
      new URLSearchParams(window.location.search),
      currentMoment,
      barbers,
    );
    setSelectedServices(selection.services);
    setSelectedBarber(selection.barber);
    setSelectedDate(selection.date);
    setSelectedTime(selection.time);
    setVisibleMonth(startOfMonth(selection.date ?? getInitialBookingDate(currentMoment)));
    hasAppliedQueryPrefill.current = true;
  }, [barbers, currentMoment, getBookingSelectionFromParams, getInitialBookingDate, hasLoadedBarbers]);

  const effectiveSelectedBarber = useMemo(
    () => (selectedBarber !== "" && barbers.includes(selectedBarber) ? selectedBarber : ""),
    [barbers, selectedBarber],
  );

  const effectiveSelectedDate = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    if (calendarAvailability[toDateIso(selectedDate)] === false) {
      return null;
    }

    return selectedDate;
  }, [calendarAvailability, selectedDate]);

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

  const visibleTimes = useMemo(
    () => {
      if (!effectiveSelectedDate) {
        return [];
      }

      return getAvailableTimes(effectiveSelectedDate, currentMoment);
    },
    [effectiveSelectedDate, currentMoment, getAvailableTimes],
  );

  const selectedTimeHour = useMemo(() => {
    const matchingVisibleSlot = visibleTimes.find((slot) => slot.label === selectedTime);
    return matchingVisibleSlot?.hour ?? null;
  }, [selectedTime, visibleTimes]);

  const prevValidationRef = useRef<{ timeValid: boolean; barberValid: boolean }>({ timeValid: true, barberValid: true });

  useEffect(() => {
    if (!selectedTime) {
      prevValidationRef.current.timeValid = true;
      return;
    }

    const matchingVisibleSlot = visibleTimes.find((slot) => slot.label === selectedTime);
    const isValid = !(matchingVisibleSlot && effectiveSelectedBarber !== "" && validatedAvailability[matchingVisibleSlot.hour] === false);
    
    if (isValid !== prevValidationRef.current.timeValid && !isValid) {
      setSelectedTime("");
    }
    prevValidationRef.current.timeValid = isValid;
  }, [effectiveSelectedBarber, selectedTime, validatedAvailability, visibleTimes]);

  useEffect(() => {
    if (selectedBarber === "" || selectedTimeHour === null) {
      prevValidationRef.current.barberValid = true;
      return;
    }

    const isValid = !(barberTimeAvailability[selectedBarber]?.[selectedTimeHour] === false);
    if (isValid !== prevValidationRef.current.barberValid && !isValid) {
      setSelectedBarber("");
    }
    prevValidationRef.current.barberValid = isValid;
  }, [barberTimeAvailability, selectedBarber, selectedTimeHour]);

  const selectableTimes = useMemo(
    () => {
      if (!effectiveSelectedBarber) {
        return [];
      }

      return visibleTimes.filter((slot) => validatedAvailability[slot.hour] === true);
    },
    [effectiveSelectedBarber, validatedAvailability, visibleTimes],
  );

  const hasValidSelectedTime = selectedTime !== "" && selectableTimes.some((slot) => slot.label === selectedTime);
  const isSelectedDateToday = effectiveSelectedDate !== null && isSameDay(effectiveSelectedDate, currentMoment);
  const hasNoRemainingTimesToday = isSelectedDateToday && visibleTimes.length === 0;

  const monthLabel = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canViewPreviousMonth = startOfMonth(visibleMonth) > startOfMonth(currentMoment);
  const canContinue =
    effectiveSelectedDate !== null &&
    selectedServices.length > 0 &&
    effectiveSelectedBarber !== "" &&
    hasValidSelectedTime;

  const confirmationHref = `/book/confirmation?date=${encodeURIComponent(
    effectiveSelectedDate ? toDateIso(effectiveSelectedDate) : "",
  )}&service=${encodeURIComponent(selectedServices.join(", "))}&barber=${encodeURIComponent(
    effectiveSelectedBarber,
  )}&time=${encodeURIComponent(selectedTime)}`;

  return (
    <main className="w-full min-h-screen bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,#efefef_0%,var(--section-sand)_100%)]">
      <div className="site-shell flex flex-col gap-8 py-[clamp(2.5rem,5vw,4.5rem)]">
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

              const isPastDay = startOfDay(day).getTime() < startOfDay(currentMoment).getTime();
              const hasBuildingSlots = !hasLoadedBuildingHours || getTimeSlotsForDate(day).length > 0;
              const unavailable = isPastDay
                || !hasBuildingSlots
                || calendarAvailability[toDateIso(day)] === false;
              const selected = effectiveSelectedDate ? isSameDay(day, effectiveSelectedDate) : false;

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
                    if (selected) {
                      setSelectedDate(null);
                      setSelectedTime("");
                      return;
                    }

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
                  (() => {
                    const isUnavailableForDate = effectiveSelectedDate !== null && barberAvailability[barber] === false;
                    const isUnavailableForSelectedTime = selectedTimeHour !== null && barberTimeAvailability[barber]?.[selectedTimeHour] === false;
                    const isUnavailable = isUnavailableForDate || isUnavailableForSelectedTime;

                    return (
                  <button
                    key={barber}
                    className={isUnavailable
                      ? `${secondaryButtonClassName} cursor-not-allowed border-[var(--border)] bg-[color:rgba(239,223,198,0.45)] text-[var(--muted)] opacity-50 hover:bg-[color:rgba(239,223,198,0.45)]`
                      : barber === effectiveSelectedBarber
                      ? primaryButtonClassName
                      : secondaryButtonClassName}
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => {
                      setSelectedBarber((currentBarber) => currentBarber === barber ? "" : barber);
                    }}
                    aria-disabled={isUnavailable}
                  >
                    {barber}
                  </button>
                    );
                  })()
                ))}
              </div>
              {effectiveSelectedDate ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Staff without availability on this date are greyed out.
                </p>
              ) : null}
              {hasLoadedBarbers && barbers.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  No active staff are available to book right now.
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Available times</p>
              {effectiveSelectedDate && !hasLoadedBuildingHours ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Loading building hours...
                </p>
              ) : null}
              {!effectiveSelectedDate ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Select a date to see available times.
                </p>
              ) : null}
              {effectiveSelectedDate && !effectiveSelectedBarber ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Available times stay active below. Select a barber to confirm and choose one.
                </p>
              ) : null}
              {hasNoRemainingTimesToday ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  No remaining slots today. Current time is {formatTimeForDisplay(currentMoment)} and today&apos;s configured hours have ended.
                </p>
              ) : null}
              {effectiveSelectedBarber && !effectiveSelectedDate ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Days that {effectiveSelectedBarber} is off are disabled on the calendar.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {visibleTimes.map((time) => {
                  const isAvailable = effectiveSelectedBarber !== ""
                    ? validatedAvailability[time.hour] === true
                    : aggregateTimeAvailability[time.hour] === true;
                  const isSelectable = isAvailable;
                  const isSelected = isAvailable && time.label === selectedTime;

                  return (
                    <button
                      key={time.label}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => {
                        if (!isSelectable) {
                          return;
                        }

                        setSelectedTime((current) => current === time.label ? "" : time.label);
                      }}
                      className={`rounded-xl border py-2 text-center text-sm font-semibold transition ${
                        !isAvailable
                          ? "cursor-not-allowed border-[var(--border)] bg-[color:rgba(239,223,198,0.45)] text-[var(--muted)] opacity-60"
                          : isSelected
                          ? "border-[var(--accent-strong)] bg-[var(--button-primary)] text-[var(--surface)]"
                          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--button-secondary)]"
                      }`}
                    >
                      {time.label}
                    </button>
                  );
                })}
              </div>
              {effectiveSelectedDate && effectiveSelectedBarber && hasLoadedBuildingHours && selectableTimes.length === 0 ? (
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
    </main>
  );
}