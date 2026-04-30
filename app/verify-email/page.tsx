"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { setStoredCustomerEmail } from "@/lib/appointments/customer-session";

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [message, setMessage] = useState("Verifying your sign-in link…");

  useEffect(() => {
    let cancelled = false;

    async function runVerification() {
      const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
      const token = searchParams.get("token")?.trim() ?? "";

      if (!email || !token) {
        if (!cancelled) {
          setStatus("error");
          setMessage("This link is invalid or incomplete.");
        }
        return;
      }

      const result = await signIn("credentials", {
        email,
        verificationToken: token,
        redirect: false,
      });

      if (cancelled) return;

      if (result?.ok) {
        setStoredCustomerEmail(email);
        setStatus("success");
        setMessage("You're signed in! Redirecting…");
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
        return;
      }

      setStatus("error");

      const errorCode = result?.error ?? "";
      if (errorCode.includes("RATE_LIMITED")) {
        setMessage("Too many attempts. Please wait a moment and try again.");
      } else if (errorCode === "INVALID_OR_EXPIRED_LINK") {
        setMessage("This link has expired or already been used. Request a new one.");
      } else {
        setMessage("Something went wrong. Please try signing in again.");
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center gap-8 px-6 py-16 sm:px-8 lg:px-12">
      <section className="w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_80px_var(--shadow-elevated)]">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
          Signing in
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Verify your email
        </h1>

        <div className="mt-6">
          {status === "loading" && (
            <div className="flex items-center gap-3 text-[var(--muted)]">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <span>{message}</span>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-2xl border border-[var(--status-success-banner-border)] bg-[var(--status-success-banner-bg)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
              {message}
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-[var(--status-error-banner-border)] bg-[var(--status-error-banner-bg)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
              {message}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--button-secondary-hover)]"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
