import { getDb } from "./client";
import { businessWeeklyHoursTable } from "./schema";

export type BuildingHoursEntry = {
  weekday: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
};

export async function getBuildingHours(): Promise<BuildingHoursEntry[]> {
  const db = getDb();
  const entries = await db
    .select({
      weekday: businessWeeklyHoursTable.weekday,
      startTime: businessWeeklyHoursTable.startTime,
      endTime: businessWeeklyHoursTable.endTime,
      isOpen: businessWeeklyHoursTable.isOpen,
    })
    .from(businessWeeklyHoursTable)
    .orderBy(businessWeeklyHoursTable.weekday);

  return entries;
}

export async function setBuildingHours(entries: BuildingHoursEntry[]): Promise<void> {
  const db = getDb();
  // Delete all existing entries
  await db.delete(businessWeeklyHoursTable);

  // Insert new entries
  if (entries.length > 0) {
    await db.insert(businessWeeklyHoursTable).values(
      entries.map((entry) => ({
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isOpen: entry.isOpen,
        updatedAt: new Date().toISOString(),
      })),
    );
  }
}

export async function initializeDefaultBuildingHours(): Promise<void> {
  const existing = await getBuildingHours();
  if (existing.length > 0) {
    return;
  }

  const defaults: BuildingHoursEntry[] = [
    { weekday: 0, isOpen: false, startTime: "6:00 AM", endTime: "8:00 PM" }, // Sunday
    { weekday: 1, isOpen: true, startTime: "6:00 AM", endTime: "8:00 PM" }, // Monday
    { weekday: 2, isOpen: true, startTime: "6:00 AM", endTime: "8:00 PM" }, // Tuesday
    { weekday: 3, isOpen: true, startTime: "6:00 AM", endTime: "8:00 PM" }, // Wednesday
    { weekday: 4, isOpen: true, startTime: "6:00 AM", endTime: "8:00 PM" }, // Thursday
    { weekday: 5, isOpen: true, startTime: "6:00 AM", endTime: "8:00 PM" }, // Friday
    { weekday: 6, isOpen: false, startTime: "6:00 AM", endTime: "8:00 PM" }, // Saturday
  ];

  await setBuildingHours(defaults);
}
