"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Listbox } from "@headlessui/react";

type StaffMember = {
  id: number;
  name: string;
  isActive: boolean;
};

type WeeklyScheduleEntry = {
  weekday: number;
  label: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

type BuildingHoursEntry = {
  weekday: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

type StaffViewMode = "add" | "schedule" | "staff" | "building";
type DropdownOption<T extends string | number> = {
  value: T;
  label: string;
};

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeOptions = Array.from({ length: 15 }, (_, index) => {
  const hour = index + 6;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${displayHour}:00 ${suffix}`;
});

const timeDropdownOptions: DropdownOption<string>[] = timeOptions.map((time) => ({
  value: time,
  label: time,
}));

const timeToMinutesMap = new Map<string, number>(
  timeOptions.map((time, index) => [time, (index + 6) * 60]),
);

function parseTimeLabelToMinutes(value: string) {
  return timeToMinutesMap.get(value) ?? null;
}

function minutesToTimeLabel(minutes: number) {
  const fromPreset = timeOptions.find((time) => timeToMinutesMap.get(time) === minutes);
  if (fromPreset) {
    return fromPreset;
  }

  const normalizedHour = Math.floor(minutes / 60);
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour}:00 ${suffix}`;
}

function normalizeBuildingHoursEntries(entries: BuildingHoursEntry[]): BuildingHoursEntry[] {
  return entries.map((entry) => {
    const startMinutes = parseTimeLabelToMinutes(entry.startTime);
    const endMinutes = parseTimeLabelToMinutes(entry.endTime);

    if (startMinutes === null || endMinutes === null || startMinutes < endMinutes) {
      return entry;
    }

    const clampedEnd = Math.min(startMinutes + 60, 20 * 60);
    return {
      ...entry,
      endTime: minutesToTimeLabel(clampedEnd),
    };
  });
}

function clampWeeklyScheduleToBuildingHours(
  schedule: WeeklyScheduleEntry[],
  buildingHours: BuildingHoursEntry[],
): WeeklyScheduleEntry[] {
  if (buildingHours.length === 0) {
    return schedule;
  }

  return schedule.map((entry) => {
    if (!entry.isWorking) {
      return entry;
    }

    const dayHours = buildingHours.find((hourEntry) => hourEntry.weekday === entry.weekday);
    if (!dayHours || !dayHours.isOpen) {
      return { ...entry, isWorking: false };
    }

    const startMinutes = parseTimeLabelToMinutes(dayHours.startTime);
    const endMinutes = parseTimeLabelToMinutes(dayHours.endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return { ...entry, isWorking: false };
    }

    const currentStart = parseTimeLabelToMinutes(entry.startTime) ?? startMinutes;
    const currentEnd = parseTimeLabelToMinutes(entry.endTime) ?? endMinutes;
    const clampedStart = Math.max(startMinutes, Math.min(currentStart, endMinutes - 60));
    const clampedEnd = Math.min(endMinutes, Math.max(currentEnd, clampedStart + 60));

    return {
      ...entry,
      startTime: minutesToTimeLabel(clampedStart),
      endTime: minutesToTimeLabel(clampedEnd),
    };
  });
}

type HeadlessSelectProps<T extends string | number> = {
  value: T;
  onChange: (nextValue: T) => void;
  options: DropdownOption<T>[];
  disabled?: boolean;
  className?: string;
};

function HeadlessSelect<T extends string | number>({
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}: HeadlessSelectProps<T>) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  if (!selectedOption) {
    return null;
  }

  return (
    <Listbox value={selectedOption} onChange={(option: DropdownOption<T>) => onChange(option.value)} disabled={disabled}>
      <div className={`relative ${className}`.trim()}>
        <Listbox.Button className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 pr-10 text-left text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50">
          {selectedOption.label}
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--muted)]">v</span>
        </Listbox.Button>
        <Listbox.Options className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg outline-none">
          {options.map((option) => (
            <Listbox.Option
              key={`${option.value}`}
              value={option}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--foreground)] data-[focus]:bg-[var(--accent-soft)]"
            >
              {option.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
}

function createDefaultSchedule(): WeeklyScheduleEntry[] {
  return weekdayLabels.map((label, weekday) => ({
    weekday,
    label,
    isWorking: weekday >= 1 && weekday <= 5,
    startTime: "9:00 AM",
    endTime: "5:00 PM",
  }));
}

export default function StaffManagementPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as StaffViewMode | null;
  
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [activeView, setActiveView] = useState<StaffViewMode>(tabParam || "schedule");
  const [scheduleStaffId, setScheduleStaffId] = useState(0);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleEntry[]>(createDefaultSchedule());
  const [buildingHours, setBuildingHours] = useState<BuildingHoursEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isBuildingLoading, setIsBuildingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function updateBuildingHours(updater: (current: BuildingHoursEntry[]) => BuildingHoursEntry[]) {
    setBuildingHours((current) => {
      const next = normalizeBuildingHoursEntries(updater(current));
      setWeeklySchedule((previousSchedule) => clampWeeklyScheduleToBuildingHours(previousSchedule, next));
      return next;
    });
  }

  function getBuildingHoursForWeekday(weekday: number) {
    return buildingHours.find((entry) => entry.weekday === weekday) ?? null;
  }

  function getDayTimeBounds(weekday: number) {
    const dayHours = getBuildingHoursForWeekday(weekday);
    if (!dayHours || !dayHours.isOpen) {
      return null;
    }

    const startMinutes = parseTimeLabelToMinutes(dayHours.startTime);
    const endMinutes = parseTimeLabelToMinutes(dayHours.endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return null;
    }

    return { startMinutes, endMinutes };
  }

  function getStartTimeOptions(entry: WeeklyScheduleEntry): DropdownOption<string>[] {
    const bounds = getDayTimeBounds(entry.weekday);
    if (!bounds) {
      return timeDropdownOptions;
    }

    const currentEndMinutes = parseTimeLabelToMinutes(entry.endTime) ?? bounds.endMinutes;
    const upperBound = Math.min(currentEndMinutes, bounds.endMinutes);

    const filtered = timeDropdownOptions.filter((option) => {
      const minutes = parseTimeLabelToMinutes(option.value);
      return minutes !== null && minutes >= bounds.startMinutes && minutes < upperBound;
    });

    return filtered.length > 0 ? filtered : timeDropdownOptions;
  }

  function getEndTimeOptions(entry: WeeklyScheduleEntry): DropdownOption<string>[] {
    const bounds = getDayTimeBounds(entry.weekday);
    if (!bounds) {
      return timeDropdownOptions;
    }

    const currentStartMinutes = parseTimeLabelToMinutes(entry.startTime) ?? bounds.startMinutes;
    const lowerBound = Math.max(currentStartMinutes, bounds.startMinutes);

    const filtered = timeDropdownOptions.filter((option) => {
      const minutes = parseTimeLabelToMinutes(option.value);
      return minutes !== null && minutes > lowerBound && minutes <= bounds.endMinutes;
    });

    return filtered.length > 0 ? filtered : timeDropdownOptions;
  }

  function getBuildingStartTimeOptions(entry: BuildingHoursEntry): DropdownOption<string>[] {
    const currentEndMinutes = parseTimeLabelToMinutes(entry.endTime);
    if (currentEndMinutes === null) {
      return timeDropdownOptions;
    }

    const filtered = timeDropdownOptions.filter((option) => {
      const minutes = parseTimeLabelToMinutes(option.value);
      return minutes !== null && minutes < currentEndMinutes;
    });

    return filtered.length > 0 ? filtered : timeDropdownOptions;
  }

  function getBuildingEndTimeOptions(entry: BuildingHoursEntry): DropdownOption<string>[] {
    const currentStartMinutes = parseTimeLabelToMinutes(entry.startTime);
    if (currentStartMinutes === null) {
      return timeDropdownOptions;
    }

    const filtered = timeDropdownOptions.filter((option) => {
      const minutes = parseTimeLabelToMinutes(option.value);
      return minutes !== null && minutes > currentStartMinutes;
    });

    return filtered.length > 0 ? filtered : timeDropdownOptions;
  }
  const staffDropdownOptions: DropdownOption<number>[] = [
    { value: 0, label: "Select staff member..." },
    ...staff.map((member) => ({ value: member.id, label: member.name })),
  ];

  useEffect(() => {
    void loadStaff();
  }, []);

  useEffect(() => {
    async function load() {
      function normalizeBuildingHoursLocal(
        rawHours: BuildingHoursEntry[],
      ): BuildingHoursEntry[] {
        const weekdayMap = new Map<number, BuildingHoursEntry>();
        const validRows = rawHours.filter(
          (entry) =>
            typeof entry.weekday === "number" &&
            entry.weekday >= 0 &&
            entry.weekday <= 6,
        );

        for (const entry of validRows) {
          weekdayMap.set(entry.weekday, entry);
        }

        const result: BuildingHoursEntry[] = [];
        for (let i = 0; i < 7; i++) {
          const existing = weekdayMap.get(i);
          if (existing) {
            result.push(existing);
          } else {
            result.push({
              weekday: i,
              isOpen: i >= 1 && i <= 5,
              startTime: "9:00 AM",
              endTime: "5:00 PM",
            });
          }
        }

        return result;
      }

      if (activeView === "building" || activeView === "schedule") {
        try {
          setIsBuildingLoading(true);
          setError(null);
          const response = await fetch("/api/admin/building-hours", { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Failed to load building hours");
          }
          const hours = (await response.json()) as BuildingHoursEntry[];
          const normalizedHours = normalizeBuildingHoursLocal(hours);
          updateBuildingHours(() => normalizedHours);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load building hours");
        } finally {
          setIsBuildingLoading(false);
        }
      }
    }
    void load();
  }, [activeView]);

  async function loadStaff() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/staff", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load staff");
      }
      const data = (await response.json()) as StaffMember[];
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  const loadWeeklySchedule = useCallback(async (staffId: number) => {
    try {
      setIsScheduleLoading(true);
      setError(null);
      const response = await fetch(`/api/staff/schedule?staffId=${staffId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load staff schedule");
      }

      const entries = (await response.json()) as Array<{
        weekday: number;
        startTime: string;
        endTime: string;
        isWorking: boolean;
      }>;

      if (!Array.isArray(entries) || entries.length === 0) {
        setWeeklySchedule(createDefaultSchedule());
        return;
      }

      const merged = createDefaultSchedule().map((defaultEntry) => {
        const matchedEntry = entries.find((entry) => entry.weekday === defaultEntry.weekday);
        return matchedEntry
          ? {
              ...defaultEntry,
              isWorking: matchedEntry.isWorking,
              startTime: matchedEntry.startTime,
              endTime: matchedEntry.endTime,
            }
          : defaultEntry;
      });

      setWeeklySchedule(clampWeeklyScheduleToBuildingHours(merged, buildingHours));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff schedule");
    } finally {
      setIsScheduleLoading(false);
    }
  }, [buildingHours]);

  async function handleAddStaff() {
    if (!newStaffName.trim()) {
      setError("Please enter a staff member name");
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStaffName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to add staff member");
      }

      setNewStaffName("");
      setSuccessMessage("Staff member added successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff member");
    }
  }

  async function handleSaveWeeklySchedule() {
    if (scheduleStaffId === 0) {
      setError("Please select a staff member to configure");
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/staff/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: scheduleStaffId,
          entries: weeklySchedule.map((entry) => ({
            weekday: entry.weekday,
            isWorking: entry.isWorking,
            startTime: entry.startTime,
            endTime: entry.endTime,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to save weekly schedule");
      }

      setSuccessMessage("Weekly schedule saved");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadWeeklySchedule(scheduleStaffId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save weekly schedule");
    }
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    try {
      setError(null);
      const response = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update staff member");
      }

      setSuccessMessage(isActive ? "Staff member deactivated" : "Staff member activated");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff member");
    }
  }

  async function handleDeleteStaff() {
    if (!staffToDelete) return;

    try {
      setIsDeleting(true);
      setError(null);
      const response = await fetch(`/api/staff/${staffToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to delete staff member");
      }

      setShowDeleteConfirm(false);
      setStaffToDelete(null);
      setSuccessMessage("Staff member deleted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete staff member");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveBuildingHours() {
    try {
      setError(null);
      const response = await fetch("/api/admin/building-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildingHours),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to save building hours");
      }

      setSuccessMessage("Building hours saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save building hours");
    }
  }



  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[color:var(--surface-elevated)] p-8 shadow-[0_24px_80px_var(--shadow-elevated)]">
        <h1 className="text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          Staff Management
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          Set each team member&apos;s recurring weekly schedule, manage active status, and control building hours.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[var(--status-error-banner-border)] bg-[var(--status-error-banner-bg)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-[var(--status-success-banner-border)] bg-[var(--status-success-banner-bg)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Staff tools
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Switch between setup, schedules, roster management, and building hours.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: "add", label: "Add staff" },
              { id: "schedule", label: "Weekly schedule" },
              { id: "staff", label: "Staff members" },
              { id: "building", label: "Building hours" },
            ].map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id as StaffViewMode)}
                aria-pressed={activeView === view.id}
                className={activeView === view.id
                  ? "inline-flex w-full items-center justify-center rounded-lg border border-[var(--accent-strong)] bg-[var(--button-primary)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--surface)] transition hover:bg-[var(--button-primary-hover)]"
                  : "inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--button-secondary-hover)]"
                }
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeView === "add" ? (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          Add Staff Member
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Name
            </label>
            <input
              type="text"
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleAddStaff();
                }
              }}
              placeholder="Enter staff member name"
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
            />
          </div>
          <button onClick={() => void handleAddStaff()} className="btn btn-primary">
            Add staff member
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "schedule" ? (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              Weekly Schedule
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Choose which days this staff member normally works and the hours they should be bookable.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Staff Member
            </label>
            <HeadlessSelect
              value={scheduleStaffId}
              onChange={(nextValue) => {
                setScheduleStaffId(nextValue);

                if (nextValue > 0) {
                  void loadWeeklySchedule(nextValue);
                } else {
                  setWeeklySchedule(createDefaultSchedule());
                }
              }}
              options={staffDropdownOptions}
              className="mt-2"
            />
          </div>
        </div>

        {scheduleStaffId > 0 ? (
        <div className="mt-5 space-y-3">
          {weeklySchedule.map((entry, index) => (
            
            <div
              key={entry.weekday}
              className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-[1.2fr_0.8fr_1fr_1fr] md:items-center"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{entry.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {entry.isWorking ? "Available for bookings" : "Not bookable"}
                  </p>
                </div>
                <button
                  type="button"
                  className={entry.isWorking ? "btn btn-primary btn-compact" : "btn btn-secondary btn-compact"}
                  onClick={() =>
                    setWeeklySchedule((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isWorking: !item.isWorking } : item,
                      ),
                    )
                  }
                >
                  {entry.isWorking ? "Working" : "Off"}
                </button>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  Start Time
                </label>
                <HeadlessSelect
                  value={entry.startTime}
                  disabled={!entry.isWorking}
                  onChange={(nextValue) =>
                    setWeeklySchedule((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, startTime: nextValue } : item,
                      ),
                    )
                  }
                  options={getStartTimeOptions(entry)}
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  End Time
                </label>
                <HeadlessSelect
                  value={entry.endTime}
                  disabled={!entry.isWorking}
                  onChange={(nextValue) =>
                    setWeeklySchedule((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, endTime: nextValue } : item,
                      ),
                    )
                  }
                  options={getEndTimeOptions(entry)}
                  className="mt-2"
                />
              </div>

              <div className="flex justify-start md:justify-end">
                <span className="rounded-full bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {entry.isWorking ? `${entry.startTime} to ${entry.endTime}` : "Unavailable all day"}
                </span>
              </div>
            </div>
          ))}
        </div>
        ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-5 py-6 text-sm text-[var(--muted)]">
          Select a staff member to configure their weekly schedule.
        </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            {scheduleStaffId === 0
              ? "Choose a staff member first, then their working days and hours will appear here."
              : isScheduleLoading
              ? "Loading saved schedule…"
              : "Once saved, bookings only go through during the selected working days and hours."}
          </p>
          <button
            onClick={() => void handleSaveWeeklySchedule()}
            disabled={scheduleStaffId === 0}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save weekly schedule
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "staff" ? (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          Staff Members
        </h2>
        {isLoading ? (
          <p className="mt-4 text-[var(--muted)]">Loading staff…</p>
        ) : staff.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">No staff members yet. Add one to get started.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{member.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {member.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleToggleActive(member.id, member.isActive)}
                    className="btn btn-secondary btn-compact"
                  >
                    {member.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      setStaffToDelete(member);
                      setShowDeleteConfirm(true);
                    }}
                    className="btn btn-error btn-compact"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {activeView === "building" ? (
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          Building Hours
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Set the days and hours when your business is open. Customers can only book during these times.
        </p>

        {isBuildingLoading ? (
          <p className="mt-4 text-[var(--muted)]">Loading building hours…</p>
        ) : (
          <>
          <div className="mt-5 space-y-3">
            {buildingHours.map((entry, index) => (
              <div
                key={entry.weekday}
                className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-[1.2fr_0.8fr_1fr_1fr] md:items-center"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{weekdayLabels[entry.weekday]}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {entry.isOpen ? "Building is open" : "Building is closed"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={entry.isOpen ? "btn btn-primary btn-compact" : "btn btn-secondary btn-compact"}
                    onClick={() =>
                      updateBuildingHours((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isOpen: !item.isOpen } : item,
                        ),
                      )
                    }
                  >
                    {entry.isOpen ? "Open" : "Closed"}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Open Time
                  </label>
                  <HeadlessSelect
                    value={entry.startTime}
                    disabled={!entry.isOpen}
                    onChange={(nextValue) =>
                      updateBuildingHours((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, startTime: nextValue } : item,
                        ),
                      )
                    }
                    options={getBuildingStartTimeOptions(entry)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Close Time
                  </label>
                  <HeadlessSelect
                    value={entry.endTime}
                    disabled={!entry.isOpen}
                    onChange={(nextValue) =>
                      updateBuildingHours((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, endTime: nextValue } : item,
                        ),
                      )
                    }
                    options={getBuildingEndTimeOptions(entry)}
                    className="mt-2"
                  />
                </div>

                <div className="flex justify-start md:justify-end">
                  <span className="rounded-full bg-[var(--surface)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {entry.isOpen ? `${entry.startTime} to ${entry.endTime}` : "Closed all day"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {isBuildingLoading ? "Loading…" : "Set your building's regular operating hours. Bookings are restricted to these times."}
            </p>
            <button
              onClick={() => void handleSaveBuildingHours()}
              className="btn btn-primary"
            >
              Save building hours
            </button>
          </div>
          </>
        )}
      </section>
      ) : null}

      {showDeleteConfirm && staffToDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onClick={() => {
            if (isDeleting) return;
            setShowDeleteConfirm(false);
            setStaffToDelete(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              Delete Staff Member
            </h3>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Are you sure you want to delete <span className="font-semibold text-[var(--foreground)]">{staffToDelete.name}</span>? This action cannot be undone and will remove all their schedules.
            </p>
            {error ? (
              <p className="mt-3 rounded-xl border border-red-300/60 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setStaffToDelete(null);
                }}
                disabled={isDeleting}
                className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteStaff()}
                disabled={isDeleting}
                className="btn btn-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
