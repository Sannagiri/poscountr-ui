import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as Popover from '@radix-ui/react-popover';

export interface DatePickerProps {
  label?: string;
  errorMessage?: string;
  hint?: string;
  /** ISO `yyyy-MM-dd`, or `''`/`undefined` for no date selected. */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseIsoDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Every visible cell in a 6-week month grid, including the leading/trailing days from adjacent months. */
function buildCalendarWeeks(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const cursor = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * The one date field every screen uses instead of a native
 * `<input type="date">` — the browser's own date picker looks and behaves
 * differently per OS/browser and (in most of them) only opens from the
 * small calendar glyph rather than the field itself. Built on
 * `@radix-ui/react-popover` (new dependency, same "Radix for behavior, our
 * own markup for every visual piece" pattern as `Select`/`Tooltip`/`Tabs`) —
 * clicking anywhere on the field opens the calendar, not just an icon.
 * Controlled (`value`/`onChange`, ISO date strings) rather than a native
 * form element, so React Hook Form usages wire it up via `Controller`
 * (same pattern as `Select`).
 */
export function DatePicker({
  label,
  errorMessage,
  hint,
  value,
  onChange,
  onBlur,
  placeholder = 'Select a date',
  name,
  id,
  disabled,
  className,
}: DatePickerProps) {
  const inputId = id ?? name;
  const hasError = Boolean(errorMessage);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const today = new Date();

  function handleOpenChange(next: boolean) {
    if (next) {
      setVisibleMonth(selectedDate ?? new Date());
    } else {
      onBlur?.();
    }
    setOpen(next);
  }

  function selectDay(day: Date) {
    onChange?.(toIsoDate(day));
    setOpen(false);
    onBlur?.();
  }

  function clearDate() {
    onChange?.('');
    setOpen(false);
    onBlur?.();
  }

  const days = useMemo(() => buildCalendarWeeks(visibleMonth), [visibleMonth]);

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      ) : null}
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-white px-3 text-left text-sm text-ink transition-colors',
              'hover:border-border-strong',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              'disabled:cursor-not-allowed disabled:opacity-50',
              hasError ? 'border-danger' : 'border-border',
              className,
            )}
          >
            <span className={cn('truncate', !selectedDate && 'text-ink-faint')}>
              {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
            </span>
            <CalendarIcon size={15} className="shrink-0 text-ink-faint" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-64 rounded-control border border-border bg-white p-3 shadow-dropdown"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="text-xs font-bold text-ink">
                {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-ink-faint">
              {WEEKDAY_LABELS.map((weekday) => (
                <span key={weekday} className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day) => {
                const inMonth = day.getMonth() === visibleMonth.getMonth();
                const isSelected = Boolean(selectedDate) && isSameDay(day, selectedDate as Date);
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs',
                      !inMonth && 'text-ink-faint/50 hover:bg-surface',
                      inMonth && !isSelected && 'text-ink hover:bg-surface',
                      isSelected && 'bg-brand font-semibold text-white hover:bg-brand',
                      !isSelected && isToday && inMonth && 'font-semibold text-brand',
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            {value ? (
              <button
                type="button"
                onClick={clearDate}
                className="mt-2 w-full rounded-control py-1.5 text-center text-xs font-semibold text-accent hover:bg-surface hover:text-accent-dark"
              >
                Clear date
              </button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {hasError ? (
        <p className="text-xs text-danger">{errorMessage}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
