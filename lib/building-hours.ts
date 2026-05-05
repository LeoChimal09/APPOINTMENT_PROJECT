/**
 * Helper functions for building hours - all times derived from database schema
 * No hardcoded time slots; everything queries businessWeeklyHoursTable
 */

export interface TimeSlot {
  hour: number;
  label: string;
}

/**
 * Parse time label "HH:MM AM/PM" to total minutes since midnight
 */
export function parseTimeLabelToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, rawHour, rawMinutes, rawPeriod] = match;
  const period = rawPeriod.toUpperCase();
  let hour = Number.parseInt(rawHour, 10) % 12;
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hour) || Number.isNaN(minutes)) {
    return null;
  }

  if (period === "PM") {
    hour += 12;
  }

  return (hour * 60) + minutes;
}

/**
 * Convert 24-hour format to display label "HH:00 AM/PM"
 */
export function formatHourToLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${suffix}`;
}

/**
 * Generate hourly time slots between start and end times
 * @param startTimeLabel e.g., "9:00 AM"
 * @param endTimeLabel e.g., "5:00 PM"
 * @returns Array of hourly slots from start to end (not including end hour)
 */
export function generateTimeSlots(
  startTimeLabel: string,
  endTimeLabel: string,
): TimeSlot[] {
  const startMinutes = parseTimeLabelToMinutes(startTimeLabel);
  const endMinutes = parseTimeLabelToMinutes(endTimeLabel);

  if (startMinutes === null || endMinutes === null) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const startHour = Math.floor(startMinutes / 60);
  const endHour = Math.floor(endMinutes / 60);

  for (let hour = startHour; hour < endHour; hour++) {
    slots.push({
      hour,
      label: formatHourToLabel(hour),
    });
  }

  return slots;
}

/**
 * Get all hourly slots from building hours (from database)
 * Used by booking page to display available time slots
 */
export function getSlotsFromBuildingHours(
  buildingHoursArray: { startTime: string; endTime: string; isOpen: boolean }[],
): TimeSlot[] {
  if (!buildingHoursArray || buildingHoursArray.length === 0) {
    return [];
  }

  // Find min and max hours across all days to determine full range
  let minHour = 24;
  let maxHour = 0;

  for (const hours of buildingHoursArray) {
    if (!hours.isOpen) continue;

    const startMinutes = parseTimeLabelToMinutes(hours.startTime);
    const endMinutes = parseTimeLabelToMinutes(hours.endTime);

    if (startMinutes !== null) {
      minHour = Math.min(minHour, Math.floor(startMinutes / 60));
    }
    if (endMinutes !== null) {
      maxHour = Math.max(maxHour, Math.floor(endMinutes / 60));
    }
  }

  if (minHour >= maxHour) {
    return [];
  }

  const slots: TimeSlot[] = [];
  for (let hour = minHour; hour < maxHour; hour++) {
    slots.push({
      hour,
      label: formatHourToLabel(hour),
    });
  }

  return slots;
}

/**
 * Get hours for a specific weekday (0=Sun, 1=Mon, etc.)
 * Returns array of hourly slots or empty array if closed
 */
export function getHoursForWeekday(
  weekday: number,
  buildingHoursByWeekday: Map<
    number,
    { weekday: number; isOpen: boolean; startTime: string; endTime: string }
  >,
): TimeSlot[] {
  const entry = buildingHoursByWeekday.get(weekday);
  if (!entry || !entry.isOpen) {
    return [];
  }

  return generateTimeSlots(entry.startTime, entry.endTime);
}
