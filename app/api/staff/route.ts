import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter";
import { getAllStaff, getActiveStaff, createStaffMember } from "@/server/repositories/staff-repository";

export async function GET(request: NextRequest) {
  try {
    const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "true";

    // activeOnly=true is intentionally public: the customer-facing homepage
    // uses this to render the "Meet the Team" section without requiring sign-in.
    // It returns only { id, name, isActive } — no PII is exposed.
    if (!activeOnly && !(await isOwnerAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = activeOnly ? await getActiveStaff() : await getAllStaff();
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimitResult = await checkRateLimit(`rl:staff:create:ip:${ip}`, 10, 60 * 1000);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || name.length === 0 || name.length > 255) {
    return NextResponse.json({ error: "Invalid staff name" }, { status: 400 });
  }

  try {
    const staff = await createStaffMember(name);
    return NextResponse.json(staff, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
  }
}
