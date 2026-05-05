import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";
import { expireStalePendingAppointments } from "@/server/repositories/appointments-repository";

export async function POST(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const expired = await expireStalePendingAppointments();
    return NextResponse.json({ expired });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to expire appointments." },
      { status: 500 },
    );
  }
}
