"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse } from "date-fns";
import "react-day-picker/dist/style.css";

interface DatePickerPopoverProps {
  value: string;
  onChange: (isoDate: string) => void;
  label?: string;
  disabled?: boolean;
  minDateIso?: string;
  maxDateIso?: string;
}

export function DatePickerPopover({
  value,
  onChange,
  label,
  disabled = false,
  minDateIso,
  maxDateIso,
}: DatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const minDate = minDateIso ? parse(minDateIso, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = maxDateIso ? parse(maxDateIso, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-left text-sm text-[var(--foreground)] outline-none transition hover:border-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 focus:border-[var(--accent-strong)]"
      >
        {displayValue ? format(new Date(`${displayValue}T00:00`), "MMM dd, yyyy") : "Select date"}
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_24px_80px_var(--shadow-elevated)] p-4">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                const isoDate = format(date, "yyyy-MM-dd");
                setDisplayValue(isoDate);
                onChange(isoDate);
                setIsOpen(false);
              }
            }}
            disabled={(date) => {
              const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

              if (dateOnly < today) {
                return true;
              }

              if (minDate && dateOnly < minDate) {
                return true;
              }

              if (maxDate && dateOnly > maxDate) {
                return true;
              }

              return false;
            }}
            classNames={{
              months: "flex flex-col gap-4",
              month: "w-full",
              caption: "flex justify-between items-center mb-4 px-2",
              caption_label: "text-sm font-semibold text-[var(--foreground)]",
              head_row: "grid grid-cols-7 gap-1 mb-2",
              head_cell: "text-xs font-medium uppercase text-[var(--muted)] text-center py-2",
              row: "grid grid-cols-7 gap-1",
              cell: "h-9 w-9",
              day: "h-9 w-9 p-0 rounded-lg text-sm text-[var(--foreground)] hover:bg-[var(--surface-soft)] transition",
              day_selected: "bg-[var(--accent-strong)] text-white font-semibold hover:bg-[var(--accent-strong)]",
              day_today: "border border-[var(--accent-strong)] font-semibold",
              day_disabled: "text-[var(--muted)] opacity-50 cursor-not-allowed",
              nav: "flex justify-between w-full",
              nav_button: "h-8 w-8 rounded-lg bg-[var(--surface-soft)] hover:bg-[var(--surface)] text-[var(--foreground)] transition flex items-center justify-center",
              nav_button_previous: "absolute left-2",
              nav_button_next: "absolute right-2",
            }}
          />
        </div>
      )}
    </div>
  );
}
