"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { syncAppointmentStatusChangeNotifications } from "@/lib/appointments/status-notifications";
import type { AppointmentRecord } from "@/lib/appointments/appointment.types";

function SignInModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSendLink() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, name: name.trim() }),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      signInUrl?: string;
    } | null;

    if (!response.ok && response.status === 403 && payload?.error?.includes("Google")) {
      setLoading(false);
      onClose();
      void signIn("google", { callbackUrl: "/" });
      return;
    }

    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setDevLink(payload.signInUrl ?? null);
    setStep("sent");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay-backdrop)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_var(--shadow-pop)]">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
          Sign in
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          Welcome to Cutting Edge
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Admins sign in with Google. Customers can use an email link or continue as guest.
        </p>

        {step === "form" ? (
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-xs text-[var(--muted)]">
              Enter your email. Admin emails will be redirected to Google sign-in automatically.
            </p>

            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
              type="email"
              placeholder="Email address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSendLink();
              }}
            />
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
              type="text"
              placeholder="Your name (required for new accounts)"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSendLink();
              }}
            />

            {error ? (
              <p className="text-sm text-[var(--accent-strong)]">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Continue as guest
              </button>
              <button
                type="button"
                disabled={loading}
                className="btn btn-primary disabled:opacity-50"
                onClick={() => void handleSendLink()}
              >
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--status-accepted-border)] bg-[var(--status-accepted-bg)] px-4 py-3 text-sm text-[var(--status-accepted-text)]">
              <p className="font-semibold">Check your server console for the sign-in link.</p>
              <p className="mt-1 text-xs opacity-80">
                (In production this would arrive in your inbox at {email}.)
              </p>
            </div>

            {devLink ? (
              <a
                href={devLink}
                className="block truncate rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs text-[var(--accent-strong)] underline"
              >
                {devLink}
              </a>
            ) : null}

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CustomerHeader() {
  const { data: session, status } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadStatusChangeCount, setUnreadStatusChangeCount] = useState(0);
  const secondaryNavButtonClass =
    "inline-flex items-center justify-center rounded-lg bg-[var(--surface-elevated)] px-4 py-2.5 text-base font-bold text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)]";
  const accountButtonClass =
    "inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--surface-elevated)] px-4 text-base font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]";
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const displayName = session?.user?.name ?? session?.user?.email ?? "Account";
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const visibleUnreadStatusChangeCount = sessionEmail ? unreadStatusChangeCount : 0;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    let active = true;

    async function refreshStatusNotifications() {
      try {
        const response = await fetch("/api/appointments", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load appointments.");
        }

        const payload = (await response.json().catch(() => [])) as AppointmentRecord[];
        if (!active) {
          return;
        }

        const unread = syncAppointmentStatusChangeNotifications(Array.isArray(payload) ? payload : []);
        setUnreadStatusChangeCount(unread.length);
      } catch {
        if (active) {
          setUnreadStatusChangeCount(0);
        }
      }
    }

    void refreshStatusNotifications();

    const onFocus = () => {
      void refreshStatusNotifications();
    };

    window.addEventListener("focus", onFocus);

    const pollInterval = setInterval(() => {
      void refreshStatusNotifications();
    }, 15000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(pollInterval);
    };
  }, [sessionEmail]);


  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-border-faint)] bg-[color:var(--surface-elevated)] shadow-[0_10px_24px_var(--shadow-header)] backdrop-blur">
        <header className="site-shell flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4 lg:gap-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Customer booking
                </p>
                <Link
                  href="/"
                  className="mt-1 inline-flex text-[clamp(2rem,2.8vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--accent-strong)] transition hover:text-[var(--accent)]"
                >
                  Cutting Edge
                </Link>
              </div>
              <div className="hidden h-10 w-px bg-[var(--panel-border-faint)] lg:block" />
              <p className="hidden max-w-xl text-sm leading-6 text-[var(--muted)] lg:block">
                Reserve appointments, review upcoming visits, and compare services.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2.5 text-sm font-medium text-[var(--accent-strong)] lg:justify-end">
              <Link
                className={secondaryNavButtonClass}
                href="/book"
              >
                Book
              </Link>
              <div className="h-5 w-px bg-[var(--panel-border-faint)]" />
              <Link
                className={`relative ${secondaryNavButtonClass}`}
                href="/appointments"
              >
                My appointments
                {visibleUnreadStatusChangeCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold leading-none text-[var(--surface)]">
                    {visibleUnreadStatusChangeCount > 9 ? "9+" : visibleUnreadStatusChangeCount}
                  </span>
                ) : null}
              </Link>
              {session?.user && isAdmin ? (
                <>
                  <div className="h-5 w-px bg-[var(--panel-border-faint)]" />
                  <div className="group relative">
                    <Link
                      className={secondaryNavButtonClass}
                      href="/admin"
                    >
                      <span>Admin</span>
                      <span className="ml-2 text-xs text-[var(--muted)] transition group-hover:rotate-180">
                        ▾
                      </span>
                    </Link>

                    <div className="pointer-events-none invisible absolute right-0 top-[calc(100%-1px)] z-20 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] opacity-0 shadow-[0_20px_40px_var(--shadow-menu)] transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                      <Link
                        className="block px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)]"
                        href="/admin/appointments"
                      >
                        Appointments
                      </Link>
                      <Link
                        className="block px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)]"
                        href="/admin/staff"
                      >
                        Staff
                      </Link>
                    </div>
                  </div>
                </>
              ) : null}
              <div className="h-5 w-px bg-[var(--panel-border-faint)]" />

              {status === "loading" ? null : session?.user ? (
                <div className="relative">
                  <button
                    type="button"
                    className={accountButtonClass}
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--button-secondary)] text-xs font-bold tracking-[0.04em] text-[var(--accent-strong)]">
                      {initials}
                    </span>
                    <span className="max-w-[clamp(7rem,12vw,10rem)] truncate text-sm font-semibold">
                      {displayName}
                    </span>
                    <span className={`text-xs text-[var(--muted)] transition ${userMenuOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>

                  {userMenuOpen ? (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_40px_var(--shadow-menu)]">
                        <div className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Signed in as</p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                            {displayName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {session.user.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-soft)]"
                          onClick={() => {
                            setUserMenuOpen(false);
                            void signOut({ callbackUrl: "/" });
                          }}
                        >
                          <span>Sign out</span>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <path d="M16 17l5-5-5-5" />
                            <path d="M21 12H9" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--accent-strong)] bg-[var(--button-primary)] px-4 pr-4 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                  onClick={() => setSignInOpen(true)}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--surface-frost-strong)]">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span>Sign in</span>
                </button>
              )}
            </nav>
        </header>
      </div>

      {signInOpen ? <SignInModal onClose={() => setSignInOpen(false)} /> : null}
    </>
  );
}