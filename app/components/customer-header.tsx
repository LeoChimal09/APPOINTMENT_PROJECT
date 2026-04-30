"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getStoredCustomerEmail } from "@/lib/appointments/customer-session";
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

        {step === "form" ? (
          <div className="mt-5 flex flex-col gap-4">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
              onClick={() => {
                onClose();
                void signIn("google", { callbackUrl: "/" });
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="var(--google-blue)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="var(--google-green)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="var(--google-yellow)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="var(--google-red)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">or sign in with email</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

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
                Cancel
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
    "px-4 py-3 text-base font-semibold text-[var(--accent-strong)] transition-colors hover:text-[var(--accent)] hover:bg-[var(--tone-surface-soft)] rounded-lg";
  const accountButtonClass =
    "flex h-11 items-center gap-2 px-2.5 pr-3 text-[var(--foreground)] transition-colors hover:bg-[var(--tone-surface-soft)] rounded-lg";
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const displayName = session?.user?.name ?? session?.user?.email ?? "Account";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  useEffect(() => {
    const customerEmail = getStoredCustomerEmail();
    if (!customerEmail) {
      setUnreadStatusChangeCount(0);
      return;
    }

    let active = true;

    async function refreshStatusNotifications() {
      try {
        const response = await fetch(`/api/appointments?email=${encodeURIComponent(customerEmail)}`, {
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

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);


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
              <div className="hidden h-6 w-px bg-[var(--panel-border-faint)] lg:block" />
              <Link
                className={`relative ${secondaryNavButtonClass}`}
                href="/appointments"
              >
                My appointments
                {unreadStatusChangeCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold leading-none text-[var(--surface)]">
                    {unreadStatusChangeCount > 9 ? "9+" : unreadStatusChangeCount}
                  </span>
                ) : null}
              </Link>
              {session?.user && isAdmin ? (
                <>
                  <div className="hidden h-6 w-px bg-[var(--panel-border-faint)] lg:block" />
                  <Link
                    className={secondaryNavButtonClass}
                    href="/admin"
                  >
                    Admin
                  </Link>
                </>
              ) : null}
              
              <div className="hidden h-6 w-px bg-[var(--panel-border-faint)] lg:block" />

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