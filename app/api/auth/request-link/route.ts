import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, mergeRateLimitHeaders } from "@/lib/rate-limiter";
import { sendSignInLinkEmail, getAppBaseUrl } from "@/lib/mailer";
import { isAdminEmail } from "@/lib/auth";
import {
  createEmailVerificationToken,
  deleteExpiredEmailVerificationTokens,
} from "@/server/repositories/email-verification-repository";

type RequestBody = {
  email?: string;
  name?: string;
};

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const name = (body?.name ?? "").trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (isAdminEmail(email)) {
    return NextResponse.json(
      { error: "Admin accounts must sign in with Google." },
      { status: 403 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const emailKey = `rl:auth:request-link:email:${email}`;
  const ipKey = `rl:auth:request-link:ip:${ip}`;
  const [emailRateLimit, ipRateLimit] = await Promise.all([
    checkRateLimit(emailKey, 3, 60 * 1000),
    checkRateLimit(ipKey, 20, 60 * 1000),
  ]);

  if (emailRateLimit.limited || ipRateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      {
        status: 429,
        headers: mergeRateLimitHeaders([emailRateLimit, ipRateLimit]),
      },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await createEmailVerificationToken({
    email,
    tokenHash,
    expiresAt,
    name: name || null,
  });

  await deleteExpiredEmailVerificationTokens();

  const url = new URL("/verify-email", getAppBaseUrl());
  url.searchParams.set("email", email);
  url.searchParams.set("token", rawToken);

  await sendSignInLinkEmail({ email, signInUrl: url.toString() });

  return NextResponse.json({
    ok: true,
    // Expose the link in development so you can copy it without a real inbox.
    signInUrl: process.env.NODE_ENV === "development" ? url.toString() : undefined,
  });
}
