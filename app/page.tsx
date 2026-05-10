"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FaFacebookF, FaInstagram, FaTiktok } from "react-icons/fa6";
import { FiClock, FiMapPin, FiNavigation, FiPhone } from "react-icons/fi";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments/appointment.types";
import {
  syncAppointmentStatusChangeNotifications,
  type AppointmentStatusChangeNotification,
} from "@/lib/appointments/status-notifications";

type BuildingHoursEntry = {
  weekday: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

let appointmentsRequestCache: Promise<AppointmentRecord[]> | null = null;

const statusColorMap: Record<AppointmentStatus, string> = {
  pending: "text-[var(--panel-highlight)]",
  accepted: "text-[var(--accent-soft)]",
  denied: "text-[var(--panel-text-muted)]",
  cancelled: "text-[var(--panel-text-muted)]",
  completed: "text-[var(--panel-text-muted)]",
  expired: "text-[var(--panel-text-muted)]",
};

const services = [
  {
    title: "Classic cut",
    duration: "30 min",
    description: "Sharp cleanup, neckline finish, hot towel.",
  },
  {
    title: "Fade + beard",
    duration: "45 min",
    description: "Most requested combo for recurring weekday clients.",
  },
  {
    title: "VIP grooming",
    duration: "60 min",
    description: "Precision cut, steam towel, beard finish, and product styling.",
  },
];

type TeamBarberCard = {
  title: string;
  description: string;
  specialties: string[];
  time: string;
};

const defaultBarberCards: TeamBarberCard[] = [
  {
    title: "Luis",
    description: "Skin fades, textured crops, beard shaping",
    specialties: ["Fades", "Textured crops", "Beard shaping"],
    time: "11:30 AM",
  },
  {
    title: "Marcos",
    description: "Classic cuts, razor lineup, kids appointments",
    specialties: ["Classic cuts", "Razor lineup", "Kids cuts"],
    time: "1:00 PM",
  },
  {
    title: "Andrea",
    description: "Scissor work, long tops, premium grooming",
    specialties: ["Scissor work", "Long tops", "Premium grooming"],
    time: "3:45 PM",
  },
];

const testimonials = [
  {
    name: "Marcus Johnson",
    text: "Best haircut experience I've had. Professional, quick, and welcoming.",
    rating: 5,
  },
  {
    name: "David Chen",
    text: "The barbers really know their craft. Always leave feeling fresh.",
    rating: 5,
  },
  {
    name: "James Rivera",
    text: "Online booking is so convenient. No waiting, everything on time.",
    rating: 5,
  },
];

const socialChannels = [
  {
    platform: "Instagram",
    icon: FaInstagram,
    handle: "@cuttingedge.studio",
    metric: "12.4k followers",
  },
  {
    platform: "TikTok",
    icon: FaTiktok,
    handle: "@cuttingedge.cuts",
    metric: "88k likes",
  },
  {
    platform: "Facebook",
    icon: FaFacebookF,
    handle: "Cutting Edge Barber Lounge",
    metric: "4.9 rating",
  },
];

const aboutPanels = {
  community: {
    label: "Community",
    eyebrow: "Community trust",
    heading: "500+",
    subheading: "Happy customers",
    description: "Trusted for great haircuts, dependable scheduling, and a barber team people come back to.",
    highlights: ["Repeat clients every week", "Dependable same-day availability", "Trusted local barber team"],
  },
  info: {
    label: "Salon info",
    eyebrow: "Shop details",
    heading: "Hair Salon Info",
    subheading: "Downtown Barber Shop",
    addressLines: ["123 Main St.", "Springfield, IL 62701"],
    landmark: "Near downtown plaza",
    directionsLabel: "Get directions",
    phone: "(xxx) xxx-xxxx",
  },
  hours: {
    label: "Hours",
    eyebrow: "Open daily",
    heading: "Hair Salon Hours",
    schedule: [
      ["Monday", "6 AM - 8 PM"],
      ["Tuesday", "6 AM - 8 PM"],
      ["Wednesday", "6 AM - 8 PM"],
      ["Thursday", "6 AM - 8 PM"],
      ["Friday", "6 AM - 8 PM"],
      ["Saturday", "8 AM - 6 PM"],
      ["Sunday", "9 AM - 5 PM"],
    ],
  },
} as const;

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const [featuredTestimonial, ...supportingTestimonials] = testimonials;

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

function getAppointmentTimestamp(appointment: AppointmentRecord) {
  const parsedDate = new Date(appointment.dateIso);
  const parsedHour = parseHourFromLabel(appointment.time);

  if (Number.isNaN(parsedDate.getTime()) || parsedHour === null) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    parsedHour,
    0,
    0,
    0,
  ).getTime();
}

function formatHourLabel(hour24: number) {
  const normalizedHour = ((hour24 % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${hour12}:00 ${suffix}`;
}

function formatCompactTimeLabel(timeLabel: string) {
  return timeLabel.replace(":00 ", " ").trim();
}

function toLocalDateIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSlotTimestampForDateIso(dateIso: string, hour24: number) {
  const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);
  const day = Number.parseInt(rawDay, 10);

  return new Date(year, month - 1, day, hour24, 0, 0, 0).getTime();
}

async function fetchSignedInAppointments() {
  if (appointmentsRequestCache) {
    return appointmentsRequestCache;
  }

  const request = (async () => {
    const response = await fetch("/api/appointments", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load appointments.");
    }

    const payload = (await response.json()) as AppointmentRecord[];
    return Array.isArray(payload) ? payload : [];
  })().finally(() => {
    appointmentsRequestCache = null;
  });

  appointmentsRequestCache = request;
  return request;
}

export default function Home() {
  const { data: session } = useSession();
  const [latestAppointment, setLatestAppointment] = useState<AppointmentRecord | null>(null);
  const [statusChangeNotifications, setStatusChangeNotifications] = useState<AppointmentStatusChangeNotification[]>([]);
  const [activeAboutPanel, setActiveAboutPanel] = useState<keyof typeof aboutPanels>("community");
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const [availableBarbersToday, setAvailableBarbersToday] = useState<number | null>(null);
  const [soonestOpeningLabel, setSoonestOpeningLabel] = useState<string | null>(null);
  const [availableTimeLabelsToday, setAvailableTimeLabelsToday] = useState<string[]>([]);
  const [homeHoursSchedule, setHomeHoursSchedule] = useState<Array<[string, string]>>(
    aboutPanels.hours.schedule.map(([day, hours]) => [day, hours]),
  );
  const [teamBarbers, setTeamBarbers] = useState<TeamBarberCard[]>(defaultBarberCards);
  const [bookNowHref, setBookNowHref] = useState("/book");
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const visibleLatestAppointment = sessionEmail ? latestAppointment : null;
  const visibleStatusChangeNotifications = sessionEmail ? statusChangeNotifications : [];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveServiceIndex((i) => (i + 1) % services.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHomeHours() {
      try {
        const response = await fetch("/api/building-hours", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => [])) as BuildingHoursEntry[];
        if (!Array.isArray(payload) || payload.length === 0) {
          return;
        }

        const byWeekday = new Map<number, BuildingHoursEntry>();
        for (const entry of payload) {
          if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) {
            continue;
          }
          byWeekday.set(entry.weekday, entry);
        }

        const nextSchedule: Array<[string, string]> = weekdayNames.map((day, weekday) => {
          const entry = byWeekday.get(weekday);
          if (!entry || !entry.isOpen) {
            return [day, "Closed"];
          }

          return [
            day,
            `${formatCompactTimeLabel(entry.startTime)} - ${formatCompactTimeLabel(entry.endTime)}`,
          ];
        });

        if (!active) {
          return;
        }

        setHomeHoursSchedule(nextSchedule);
      } catch {
        // Keep fallback schedule if the API is unavailable.
      }
    }

    void loadHomeHours();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBookingStats() {
      try {
        const staffResponse = await fetch("/api/staff?activeOnly=true", {
          cache: "no-store",
        });

        if (!staffResponse.ok) {
          throw new Error("Unable to load staff");
        }

        const staffPayload = (await staffResponse.json().catch(() => [])) as unknown;
        const activeStaff = Array.isArray(staffPayload)
          ? staffPayload
              .map((staff) => (staff && typeof staff === "object" ? (staff as { name?: unknown }) : null))
              .filter((staff): staff is { name: string } => typeof staff?.name === "string" && staff.name.trim() !== "")
          : [];

        const baseTeamCards = activeStaff.map((staff) => {
          const matchedDefault = defaultBarberCards.find(
            (barber) => barber.title.toLowerCase() === staff.name.trim().toLowerCase(),
          );

          return {
            title: staff.name.trim(),
            description:
              matchedDefault?.description ??
              "Experienced professional focused on precision grooming and client comfort.",
            specialties:
              matchedDefault?.specialties ?? ["Precision cuts", "Beard shaping", "Styling"],
            time: matchedDefault?.time ?? "No slots today",
          };
        });

        if (!active) {
          return;
        }

        if (activeStaff.length === 0) {
          setAvailableBarbersToday(0);
          setSoonestOpeningLabel(null);
          setAvailableTimeLabelsToday([]);
          setTeamBarbers([]);
          setBookNowHref("/book");
          return;
        }

        const currentMoment = new Date();
        const todayIso = toLocalDateIso(currentMoment);

        const availabilityOptions = await Promise.all(
          activeStaff.map(async (staff) => {
            try {
              const response = await fetch(
                `/api/appointments/availability?date=${todayIso}&barber=${encodeURIComponent(staff.name)}`,
                { cache: "no-store" },
              );

              if (!response.ok) {
                return null;
              }

              const payload = (await response.json().catch(() => null)) as { hours?: unknown } | null;
              const hours = payload?.hours;

              if (!hours || typeof hours !== "object") {
                return null;
              }

              const availableHours = Object.entries(hours)
                .filter(([, value]) => Boolean((value as { available?: unknown })?.available))
                .map(([hour]) => Number.parseInt(hour, 10))
                .filter((hour) => Number.isInteger(hour))
                .filter((hour) => {
                  const slotTimestamp = getSlotTimestampForDateIso(todayIso, hour);
                  return slotTimestamp !== null && slotTimestamp > currentMoment.getTime();
                })
                .sort((first, second) => first - second);

              if (availableHours.length === 0) {
                return null;
              }

              return {
                barber: staff.name,
                hours: availableHours,
              };
            } catch {
              return null;
            }
          }),
        );

        if (!active) {
          return;
        }

        const validOptions = availabilityOptions
          .filter((option): option is { barber: string; hours: number[] } => option !== null)
          .sort((first, second) => first.hours[0] - second.hours[0] || first.barber.localeCompare(second.barber));

        const uniqueAvailableTimeLabels = Array.from(
          new Set(
            validOptions
              .flatMap((option) => option.hours)
              .sort((first, second) => first - second)
              .map((hour) => formatHourLabel(hour)),
          ),
        );

        const nextAvailableByBarber = new Map<string, string>(
          validOptions.map((option) => [option.barber.toLowerCase(), formatHourLabel(option.hours[0])]),
        );

        const hydratedTeamCards = baseTeamCards.map((barber) => ({
          ...barber,
          time: nextAvailableByBarber.get(barber.title.toLowerCase()) ?? "No slots today",
        }));

        setTeamBarbers(hydratedTeamCards);

        setAvailableBarbersToday(validOptions.length);
        setSoonestOpeningLabel(validOptions.length > 0 ? formatHourLabel(validOptions[0].hours[0]) : null);
        setAvailableTimeLabelsToday(uniqueAvailableTimeLabels);

        if (validOptions.length > 0) {
          const earliestOption = validOptions[0];
          const params = new URLSearchParams({
            date: todayIso,
            barber: earliestOption.barber,
            time: formatHourLabel(earliestOption.hours[0]),
          });
          setBookNowHref(`/book?${params.toString()}`);
        } else {
          setBookNowHref("/book");
        }
      } catch {
        if (!active) {
          return;
        }

        setAvailableBarbersToday(null);
        setSoonestOpeningLabel(null);
        setAvailableTimeLabelsToday([]);
        setTeamBarbers(defaultBarberCards);
        setBookNowHref("/book");
      }
    }

    void loadBookingStats();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    let active = true;

    async function loadUpcomingAppointment() {
      try {
        const stored = await fetchSignedInAppointments();
        const unreadStatusChanges = syncAppointmentStatusChangeNotifications(stored);
        const now = Date.now();
        const upcomingActive = stored
          .filter((a) => a.status === "pending" || a.status === "accepted")
          .map((appointment) => ({
            appointment,
            timestamp: getAppointmentTimestamp(appointment),
          }))
          .filter(
            (
              candidate,
            ): candidate is { appointment: AppointmentRecord; timestamp: number } =>
              candidate.timestamp !== null && candidate.timestamp >= now,
          )
          .sort((first, second) => first.timestamp - second.timestamp);

        if (active) {
          setLatestAppointment(upcomingActive[0]?.appointment ?? null);
          setStatusChangeNotifications(unreadStatusChanges);
        }
      } catch {
        if (active) {
          setLatestAppointment(null);
          setStatusChangeNotifications([]);
        }
      }
    }

    void loadUpcomingAppointment();

    return () => {
      active = false;
    };
  }, [sessionEmail]);

  return (
    <main className="home-page w-full">
      <section className="home-band home-band--canvas pt-6">
        <div className="site-shell flex flex-col gap-12">
          <section id="salon-info" className="flex flex-col gap-5 py-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Salon location
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                Downtown Barber Shop
              </h2>
              <p id="hours" className="mt-1 text-sm text-[var(--muted)]">
                Open daily from 6:00 AM to 8:00 PM for appointments and walk-ins.
              </p>
              </div>
            </div>
          </section>

          {/* Status Change Notifications */}
          {visibleStatusChangeNotifications.length > 0 ? (
            <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card-bg-soft)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Appointment updates
                  </p>
                  <p className="mt-1 text-sm text-[var(--accent-strong)]">
                    {visibleStatusChangeNotifications.length} appointment status change{visibleStatusChangeNotifications.length === 1 ? "" : "s"} detected.
                  </p>
                </div>
                <Link
                  href="/appointments"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)]"
                >
                  Review updates
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {visibleStatusChangeNotifications.slice(0, 3).map((notification) => (
                  <p key={notification.ref} className="text-sm text-[var(--accent-strong)]">
                    <span className="font-semibold">{notification.ref}</span> changed from <span className="font-semibold capitalize">{notification.from}</span> to <span className="font-semibold capitalize">{notification.to}</span> ({notification.dateLabel} at {notification.time})
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {/* Hero Section - Great Clips Style */}
          <section id="book-now" className="section-card rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--panel-soft),var(--panel))] shadow-lg">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col justify-center gap-6">
                <div>
                  <h1 className="hero-heading font-bold text-[var(--surface)]">
                    Great cuts. <br /> Done right.
                  </h1>
                  <p className="mt-4 text-lg leading-8 text-[var(--panel-text-muted)]">
                    Experienced barbers who care about your style. Book your appointment in seconds—no phone calls, no waiting.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/book"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-8 py-3 text-base font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                  >
                    Book an appointment
                  </Link>
                  <a
                    href="#services"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(248,237,220,0.28)] bg-[var(--panel-card)] px-8 py-3 text-base font-semibold text-[var(--surface)] transition hover:bg-[var(--panel-card-strong)]"
                  >
                    View services
                  </a>
                </div>
              </div>

            {/* Appointment Card or Empty State */}
            {visibleLatestAppointment ? (
              <div className="flex flex-col justify-center rounded-[1.75rem] border border-[rgba(248,237,220,0.22)] bg-[var(--panel-card)] p-6 backdrop-blur">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
                  Your next visit
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-[var(--surface)]">
                  {visibleLatestAppointment.service}
                </h3>
                <p className="mt-2 text-sm text-[var(--panel-text-muted)]">
                  {visibleLatestAppointment.barber} • {visibleLatestAppointment.dateLabel}
                </p>
                
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-[rgba(248,237,220,0.1)] px-4 py-2">
                    <span className="text-xs text-[rgba(248,237,220,0.72)]">Time</span>
                    <span className="font-semibold text-[var(--panel-highlight)]">{visibleLatestAppointment.time}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgba(248,237,220,0.1)] px-4 py-2">
                    <span className="text-xs text-[rgba(248,237,220,0.72)]">Status</span>
                    <span className={`font-semibold capitalize ${statusColorMap[visibleLatestAppointment.status]}`}>
                      {visibleLatestAppointment.status}
                    </span>
                  </div>
                </div>

                <Link
                  href="/appointments"
                  className="mt-4 rounded-lg border border-[rgba(248,237,220,0.22)] bg-[var(--panel-card-strong)] px-4 py-2 text-center text-sm font-semibold text-[var(--surface)] transition hover:bg-[rgba(248,237,220,0.24)]"
                >
                  View all appointments
                </Link>
              </div>
            ) : (
              <div className="flex flex-col justify-center rounded-[1.75rem] border border-[rgba(248,237,220,0.22)] bg-[var(--panel-card)] p-6 backdrop-blur">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
                  Ready to book?
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-[var(--surface)]">
                  No appointment yet
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--panel-text-muted)]">
                  Get started in seconds. Pick your service, choose a barber, and lock in your time.
                </p>

                <div className="mt-6 overflow-hidden rounded-xl border border-[rgba(248,237,220,0.12)]">
                  <div className="flex items-center justify-between bg-[rgba(248,237,220,0.06)] px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(248,237,220,0.45)]">Barbers available</span>
                    <span className="text-sm font-bold text-white">
                      {availableBarbersToday === null
                        ? "—"
                        : availableBarbersToday === 0
                        ? "None today"
                        : `${availableBarbersToday} ${availableBarbersToday === 1 ? "pro" : "pros"}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[rgba(248,237,220,0.08)] bg-[rgba(248,237,220,0.04)] px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(248,237,220,0.45)]">Soonest opening</span>
                    <span className="text-sm font-bold text-[var(--panel-highlight)]">{soonestOpeningLabel ?? "—"}</span>
                  </div>
                  <div className="border-t border-[rgba(248,237,220,0.08)] bg-[rgba(248,237,220,0.03)] px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(248,237,220,0.45)]">Available times</span>
                    {availableTimeLabelsToday.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                        {availableTimeLabelsToday.slice(0, 6).map((label) => (
                          <span key={label} className="text-sm font-semibold tabular-nums text-white">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-[rgba(248,237,220,0.5)]">No openings today</p>
                    )}
                  </div>
                </div>

                <Link
                  href={bookNowHref}
                  className="mt-4 rounded-lg bg-[var(--button-primary)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                >
                  Book now
                </Link>
              </div>
            )}
            </div>
          </section>
        </div>
      </section>

      <section className="home-band home-band--ivory">
        <div className="site-shell">
          {/* About Section */}
          <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              About us
            </p>
            <h2 className="section-heading mt-2 font-bold text-[var(--foreground)]">
              Haircuts made simple
            </h2>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
              At our salon, we believe every customer deserves a great haircut. Our talented team of barbers brings years of expertise to every cut, ensuring you leave feeling confident and looking sharp.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3">
                <svg className="mt-1 h-5 w-5 flex-shrink-0 text-[var(--accent-strong)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[var(--foreground)]">Experienced and friendly barbers</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-1 h-5 w-5 flex-shrink-0 text-[var(--accent-strong)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[var(--foreground)]">Online booking—no phone calls needed</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-1 h-5 w-5 flex-shrink-0 text-[var(--accent-strong)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[var(--foreground)]">Fast, reliable, and affordable</span>
              </li>
            </ul>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--card-bg-soft)] p-6 shadow-[0_18px_40px_rgba(33,28,22,0.16)] backdrop-blur-sm md:p-8">
            <div className="flex flex-wrap items-center gap-1 rounded-full bg-[rgba(100,19,32,0.92)] p-1.5 text-[var(--surface)] shadow-[0_10px_24px_rgba(66,24,22,0.12)] sm:w-fit">
              {(Object.entries(aboutPanels) as Array<[keyof typeof aboutPanels, (typeof aboutPanels)[keyof typeof aboutPanels]]>).map(([key, panel]) => {
                const isActive = activeAboutPanel === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveAboutPanel(key)}
                    aria-pressed={isActive}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-[var(--surface)] text-[var(--accent-strong)]"
                        : "bg-transparent text-[var(--surface)] hover:bg-[rgba(248,237,220,0.12)]"
                    }`}
                  >
                    {panel.label}
                  </button>
                );
              })}
            </div>

            {activeAboutPanel === "community" ? (
              <div className="mt-8 text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {aboutPanels.community.eyebrow}
                </p>
                <p className="mt-4 text-[clamp(2.8rem,5vw,4.5rem)] font-bold leading-none text-[var(--accent-strong)]">
                  {aboutPanels.community.heading}
                </p>
                <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                  {aboutPanels.community.subheading}
                </p>
                <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
                  {aboutPanels.community.description}
                </p>
                <div className="mt-6 space-y-3">
                  {aboutPanels.community.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-3 text-left">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(100,19,32,0.08)] text-[var(--accent-strong)]">
                        <FiClock className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-[var(--foreground)]">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeAboutPanel === "info" ? (
              <div className="mt-8 rounded-[1.5rem] bg-[var(--surface)] px-6 py-7 shadow-[0_10px_24px_rgba(99,58,25,0.05)]">
                <h3 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  {aboutPanels.info.heading}
                </h3>
                <div className="mt-8 flex items-start gap-4 border-b border-[rgba(100,19,32,0.14)] pb-5">
                  <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(100,19,32,0.08)] text-[var(--accent-strong)]">
                    <FiMapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[1.05rem] font-medium text-[var(--foreground)]">{aboutPanels.info.addressLines[0]}</p>
                    <p className="text-[1.05rem] font-medium text-[var(--foreground)]">{aboutPanels.info.addressLines[1]}</p>
                    <p className="mt-3 text-sm text-[var(--muted)]">{aboutPanels.info.landmark}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 border-b border-[rgba(100,19,32,0.14)] py-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(100,19,32,0.08)] text-[var(--accent-strong)]">
                    <FiNavigation className="h-5 w-5" />
                  </span>
                  <a href="#" className="text-[1.05rem] font-semibold text-[var(--accent)] transition hover:underline">
                    {aboutPanels.info.directionsLabel}
                  </a>
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(100,19,32,0.08)] text-[var(--accent-strong)]">
                    <FiPhone className="h-5 w-5" />
                  </span>
                  <a href="tel:+1xxxxxxxxxx" className="text-[1.05rem] font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]">
                    {aboutPanels.info.phone}
                  </a>
                </div>
              </div>
            ) : null}

            {activeAboutPanel === "hours" ? (() => {
              const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
              return (
                <div className="mt-8 rounded-[1.5rem] bg-[var(--surface)] px-6 py-7 shadow-[0_10px_24px_rgba(99,58,25,0.05)]">
                  <h3 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {aboutPanels.hours.heading}
                  </h3>
                  <div className="mt-6 flex flex-col gap-1">
                    {homeHoursSchedule.map(([day, hours]) => {
                      const isToday = day === today;
                      return (
                        <div
                          key={day}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: isToday ? "rgba(100,19,32,0.07)" : "transparent",
                            borderLeft: isToday ? "3px solid var(--accent)" : "3px solid transparent",
                          }}
                        >
                          <span
                            className="flex items-center gap-2 font-medium"
                            style={{ color: isToday ? "var(--accent)" : "var(--foreground)" }}
                          >
                            {day}
                            {isToday && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[var(--surface)]" style={{ background: "var(--accent)" }}>
                                Today
                              </span>
                            )}
                          </span>
                          <span className="font-semibold" style={{ color: isToday ? "var(--accent-strong)" : "var(--muted)" }}>
                            {hours}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : null}
          </div>
          </section>
        </div>
      </section>

      <section className="home-band home-band--canvas">
        <div className="site-shell">
          {/* Services Section - Auto Carousel */}
          <section id="services" className="py-2">
            <div className="flex flex-col gap-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  Our services
                </p>
                <h2 className="section-heading mt-2 font-bold text-[var(--foreground)]">
                  Choose your service
                </h2>
              </div>

              <div className="border-y border-[var(--border)] bg-[var(--surface)]">
                <ul role="list" className="divide-y divide-[var(--border)]">
                  {services.map((service) => (
                    <li key={`${service.title}-menu`} className="px-4 py-4 sm:px-6">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">{service.title}</h3>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{service.duration}</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{service.description}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Slideshow */}
              <div className="relative overflow-hidden rounded-[2rem]" style={{ aspectRatio: "16/7" }}>
                {services.map((service, index) => (
                  <div
                    key={service.title}
                    className="absolute inset-0 transition-opacity duration-700"
                    style={{ opacity: index === activeServiceIndex ? 1 : 0 }}
                  >
                    {/* Placeholder image */}
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))]">
                      <div className="flex flex-col items-center gap-3 text-[var(--muted)]">
                        <svg className="h-14 w-14 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium opacity-40">Photo coming soon</span>
                      </div>
                    </div>
                    {/* Service label overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[linear-gradient(to_top,rgba(36,20,23,0.72),transparent)] px-8 py-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-highlight)]">{service.duration}</p>
                      <h3 className="mt-1 text-2xl font-bold text-[var(--surface)]">{service.title}</h3>
                      <p className="mt-1 text-sm text-[var(--panel-text-muted)]">{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-2">
                {services.map((service, index) => (
                  <button
                    key={service.title}
                    type="button"
                    aria-label={`Go to ${service.title}`}
                    onClick={() => setActiveServiceIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === activeServiceIndex
                        ? "w-6 bg-[var(--accent-strong)]"
                        : "w-2 bg-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="home-band home-band--ivory">
        <div className="site-shell">
          {/* Staff Directory Section */}
          <section>
          <div className="mb-10">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Meet the team
            </p>
            <h2 className="section-heading mt-2 font-bold text-[var(--foreground)]">
              Our expert barbers
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
              Experienced professionals dedicated to giving you the perfect cut.
            </p>
          </div>

          {teamBarbers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
              No active team members are currently available.
            </div>
          ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {teamBarbers.map((barber) => (
              <div key={barber.title} className="overflow-hidden rounded-[1.5rem] border border-[var(--card-border-soft)] bg-[var(--card-bg)] transition hover:shadow-lg">
                {/* Avatar */}
                <div className="flex h-48 items-center justify-center bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-strong)] text-3xl font-bold text-[var(--surface)]">
                    {barber.title.charAt(0)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">{barber.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{barber.description}</p>
                  
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      Specialties
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {barber.specialties.map((specialty) => (
                        <span key={specialty} className="inline-block rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center">
                    <p className="text-xs text-[var(--muted)]">Next available</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--accent-strong)]">{barber.time}</p>
                  </div>

                  <Link
                    href="/book"
                    className="mt-4 block w-full rounded-lg bg-[var(--button-primary)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                  >
                    Book with {barber.title}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          )}
          </section>
        </div>
      </section>

      <section className="home-band home-band--canvas">
        <div className="site-shell">
          {/* Testimonials Section - Quote Led */}
          <section className="py-2">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  What customers say
                </p>
                <h2 className="section-heading mt-2 font-bold text-[var(--foreground)]">
                  Loved by everyone
                </h2>
                <div className="mt-8 rounded-[2rem] border border-[rgba(100,19,32,0.14)] bg-[var(--card-bg-soft)] p-8 shadow-[0_20px_40px_rgba(99,58,25,0.08)] backdrop-blur-sm">
                  <div className="flex gap-1">
                    {Array.from({ length: featuredTestimonial.rating }).map((_, i) => (
                      <svg key={i} className="h-5 w-5 text-[var(--panel-highlight)]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="mt-6 text-[clamp(1.5rem,2.4vw,2.4rem)] font-semibold leading-[1.2] text-[var(--foreground)]">
                    &ldquo;{featuredTestimonial.text}&rdquo;
                  </p>
                  <p className="mt-6 text-base font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                    {featuredTestimonial.name}
                  </p>
                </div>
              </div>

              <div className="space-y-5 border-l-0 border-[rgba(100,19,32,0.14)] lg:border-l lg:pl-8">
                {supportingTestimonials.map((testimonial) => (
                  <div key={testimonial.name} className="border-b border-[rgba(100,19,32,0.14)] pb-5 last:border-b-0 last:pb-0">
                    <div className="flex gap-1">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <svg key={i} className="h-4 w-4 text-[var(--panel-highlight)]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="mt-3 text-base leading-7 text-[var(--foreground)]">&ldquo;{testimonial.text}&rdquo;</p>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                      {testimonial.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="home-band home-band--ivory">
        <div className="site-shell">
          <section className="flex flex-col gap-5 border-t border-[rgba(100,19,32,0.14)] py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                Follow along
              </p>
              <p className="mt-2 text-sm text-[var(--muted)] lg:text-base">
                Shop updates, fresh cuts, and booking drops across our socials.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              {socialChannels.map((channel) => {
                const Icon = channel.icon;

                return (
                  <a
                    key={channel.platform}
                    href="#"
                    className="inline-flex items-center gap-3 rounded-full border border-[rgba(100,19,32,0.16)] bg-[rgba(248,237,220,0.62)] px-4 py-2.5 text-[var(--foreground)] transition hover:bg-[rgba(248,237,220,0.84)]"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(100,19,32,0.08)] text-[var(--accent-strong)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                        {channel.platform}
                      </span>
                      <span className="block truncate text-sm font-semibold">
                        {channel.handle}
                      </span>
                    </span>
                    <span className="hidden text-xs font-semibold text-[var(--muted)] sm:block">
                      {channel.metric}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
