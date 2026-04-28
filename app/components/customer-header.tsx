"use client";

import Link from "next/link";

export function CustomerHeader() {

  return (
    <div className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto w-full max-w-7xl px-6 pt-3 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-5 rounded-[1.5rem] border border-[var(--border)] bg-[color:rgba(248,237,220,0.9)] px-5 py-4 shadow-[0_16px_40px_rgba(66,24,22,0.1)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex min-h-14 items-center rounded-[1.1rem] border border-[var(--accent-strong)] bg-[var(--surface)] px-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--accent)]"
            >
              Cutting Edge
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Customer booking
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Reserve appointments, review upcoming visits, and compare services.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-[var(--accent-strong)]">
            <Link
              className="rounded-full bg-[var(--button-secondary)] px-4 py-2 transition hover:bg-[var(--button-secondary-hover)]"
              href="/book"
            >
              Book
            </Link>
            <Link
              className="rounded-full bg-[var(--button-secondary)] px-4 py-2 transition hover:bg-[var(--button-secondary-hover)]"
              href="/appointments"
            >
              My appointments
            </Link>
          </nav>
        </header>
      </div>
    </div>
  );
}