"use client";

import Link from "next/link";
import { useState } from "react";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments/appointment.types";

const STORAGE_KEY = "cutting_edge_appointments";

const statusColorMap: Record<AppointmentStatus, string> = {
  pending: "text-[var(--panel-highlight)]",
  accepted: "text-[#7fe09a]",
  denied: "text-[var(--panel-text-muted)]",
  cancelled: "text-[var(--panel-text-muted)]",
  completed: "text-[var(--panel-text-muted)]",
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

const barbers = [
  {
    title: "Luis",
    description: "Skin fades, textured crops, beard shaping",
    time: "11:30 AM",
  },
  {
    title: "Marcos",
    description: "Classic cuts, razor lineup, kids appointments",
    time: "1:00 PM",
  },
  {
    title: "Andrea",
    description: "Scissor work, long tops, premium grooming",
    time: "3:45 PM",
  },
];

const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]";

const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-6 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)] hover:border-[var(--accent-strong)]";

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

function getLatestUpcomingAppointment() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored: AppointmentRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
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

    return upcomingActive[0]?.appointment ?? null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [latestAppointment] = useState<AppointmentRecord | null>(() => getLatestUpcomingAppointment());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 sm:px-8 lg:px-12">
      <section id="book" className="grid gap-6 rounded-[2rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.9)] p-8 shadow-[0_24px_80px_rgba(66,24,22,0.14)] backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-1 text-sm font-medium text-[var(--accent-strong)]">
            Customer booking experience
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
              Book your next cut without calling the shop.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Browse services, pick a barber, and reserve the time that fits your week. Everything here is structured around the customer journey.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className={primaryButtonClassName}
              href="/book"
            >
              Start booking
            </Link>
            <a
              className={secondaryButtonClassName}
              href="#services"
            >
              Compare services
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Average booking time</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">45 sec</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Barbers available today</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">3 pros</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm text-[var(--muted)]">Soonest opening</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">11:30 AM</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[1.75rem] bg-[radial-gradient(circle_at_top,_rgba(240,196,108,0.2),_rgba(255,255,255,0)_56%),linear-gradient(135deg,var(--panel),#3d0d16)] p-6 text-[var(--surface)] shadow-inner">
          {latestAppointment ? (
            <>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
                  Your upcoming visit
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--surface)]">
                  {latestAppointment.service}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--panel-text-muted)]">
                  {latestAppointment.barber} &middot; {latestAppointment.dateLabel}
                </p>
              </div>
              <div className="mt-8 space-y-3 rounded-[1.5rem] border border-[color:rgba(244,228,195,0.14)] bg-[var(--panel-card)] p-4 backdrop-blur">
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Time</span>
                  <span className="text-sm font-semibold text-[var(--panel-highlight)]">{latestAppointment.time}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Barber</span>
                  <span className="text-sm font-medium text-[var(--surface)]">{latestAppointment.barber}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Status</span>
                  <span className={`text-sm font-semibold capitalize ${statusColorMap[latestAppointment.status]}`}>
                    {latestAppointment.status}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Ref</span>
                  <span className="font-mono text-xs text-[var(--panel-text-muted)]">{latestAppointment.ref}</span>
                </div>
              </div>
              <Link
                href="/appointments"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[color:rgba(244,228,195,0.3)] bg-[var(--panel-card-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--surface)] transition hover:bg-[color:rgba(248,237,220,0.15)]"
              >
                View all appointments
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--panel-highlight)]">
                  No upcoming appointment
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--surface)]">Nothing is booked yet</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--panel-text-muted)]">
                  Choose a service, pick your barber, and lock in a time that works for you. Once you submit, your next visit will appear here.
                </p>
              </div>
              <div className="mt-8 space-y-3 rounded-[1.5rem] border border-[color:rgba(244,228,195,0.14)] bg-[var(--panel-card)] p-4 backdrop-blur">
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Open hours</span>
                  <span className="text-sm font-medium text-[var(--panel-highlight)]">6:00 AM - 8:00 PM</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Barbers available</span>
                  <span className="text-sm font-medium text-[var(--surface)]">3 pros today</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--panel-card-strong)] px-4 py-3">
                  <span className="text-sm text-[var(--panel-text-muted)]">Tip</span>
                  <span className="text-sm font-medium text-[var(--surface)]">Book early for prime slots</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/book"
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:rgba(244,228,195,0.3)] bg-[var(--panel-card-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--surface)] transition hover:bg-[color:rgba(248,237,220,0.15)]"
                >
                  Book now
                </Link>
                <Link
                  href="/appointments"
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:rgba(244,228,195,0.3)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--surface)] transition hover:bg-[color:rgba(248,237,220,0.1)]"
                >
                  View history
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section id="appointments" className="grid gap-5 xl:grid-cols-[0.95fr_2.05fr]">
        <article id="services" className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="text-sm font-medium text-[var(--accent)]">Service mix</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Choose your service</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Start with the appointment type you want, then match it to the barber and time that work best for you.
          </p>
          <div className="mt-6 space-y-3">
            {services.map((service) => (
              <div key={service.title} className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[var(--foreground)]">{service.title}</span>
                  <span className="shrink-0 text-sm text-[var(--muted)]">{service.duration}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{service.description}</p>
              </div>
            ))}
          </div>
        </article>

        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Upcoming availability
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Pick the barber and time you want
              </h3>
            </div>
            <div className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent-strong)]">
              6 appointment times in the next 4 hours
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {barbers.map((barber) => (
              <HeroCard
                key={barber.title}
                title={barber.title}
                description={barber.description}
                time={barber.time}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

type HeroCardProps = {
  title: string;
  description: string;
  time: string;
};

function HeroCard({title, description, time}: HeroCardProps) {
  return (
    <article className="flex h-full min-h-[272px] flex-col rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,250,242,0.98),rgba(247,239,225,0.96))] p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Next opening
        </p>
        <h4 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h4>
        <p className="text-sm leading-7 text-[var(--muted)]">{description}</p>
      </div>
      <div className="flex flex-1 flex-col justify-end py-5">
        <div className="rounded-[1.25rem] border border-dashed border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
          <span className="block text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            Earliest bookable time
          </span>
          <span className="mt-1 block text-2xl font-semibold">{time}</span>
        </div>
      </div>
      <div className="pt-1">
        <button
          className={`${primaryButtonClassName} w-full px-4`}
          type="button"
        >
          Reserve slot
        </button>
      </div>
    </article>
  );
}
