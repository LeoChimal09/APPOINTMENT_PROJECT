import { NextRequest } from "next/server";
import { getBuildingHours, initializeDefaultBuildingHours, setBuildingHours } from "@/server/db/building-hours-repository";
import { isOwnerAuthorized } from "@/server/auth/owner-auth";

export async function GET(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    await initializeDefaultBuildingHours();
    const hours = await getBuildingHours();
    return Response.json(hours);
  } catch (error) {
    console.error("Failed to get building hours:", error);
    return Response.json(
      { error: "Failed to get building hours" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOwnerAuthorized(request))) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as unknown;

    if (!Array.isArray(body) || body.length === 0) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    // Validate entries
    const entries = body.map((entry: unknown) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("weekday" in entry) ||
        !("startTime" in entry) ||
        !("endTime" in entry) ||
        !("isOpen" in entry)
      ) {
        throw new Error("Invalid entry format");
      }

      const typedEntry = entry as Record<string, unknown>;
      return {
        weekday: Number(typedEntry.weekday),
        startTime: String(typedEntry.startTime),
        endTime: String(typedEntry.endTime),
        isOpen: Boolean(typedEntry.isOpen),
      };
    });

    if (entries.some((e) => e.weekday < 0 || e.weekday > 6)) {
      return Response.json(
        { error: "Invalid weekday" },
        { status: 400 },
      );
    }

    const uniqueWeekdays = new Set(entries.map((entry) => entry.weekday));
    if (uniqueWeekdays.size !== 7 || Array.from({ length: 7 }, (_, weekday) => !uniqueWeekdays.has(weekday)).some(Boolean)) {
      return Response.json(
        { error: "Building hours must include exactly one entry for each weekday (0-6)." },
        { status: 400 },
      );
    }

    await setBuildingHours(entries);

    return Response.json({ success: true, entries });
  } catch (error) {
    console.error("Failed to save building hours:", error);
    return Response.json(
      { error: "Failed to save building hours" },
      { status: 500 },
    );
  }
}
