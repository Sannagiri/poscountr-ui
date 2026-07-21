import type { ReactNode } from 'react';

import { Tooltip } from '../Tooltip';

export interface AvatarStackItem {
  id: string;
  /** Full display name — source for both the circle's initials and the tooltip's first line. */
  name: string;
  /** Second tooltip line, e.g. a role/position. */
  subtitle?: string;
}

export interface AvatarStackProps {
  items: AvatarStackItem[];
  /** How many circles to draw before collapsing the rest into a "+N" circle. */
  max?: number;
  /** Shown in place of the circles when `items` is empty. */
  emptyLabel?: ReactNode;
}

const DEFAULT_MAX = 9;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * A row of initials circles for a small set of people (staff on a
 * location, admins on a business, …) — spelling out every name would blow
 * out a table cell, so this shows just enough to scan at a glance (an
 * initial per person, capped at `max` circles with the rest collapsed into
 * a "+N" circle), with the full name + subtitle available in a `Tooltip`
 * on hover/focus for anyone who needs it.
 */
export function AvatarStack({ items, max = DEFAULT_MAX, emptyLabel = '—' }: AvatarStackProps) {
  if (items.length === 0) {
    return <span className="text-sm text-ink-soft">{emptyLabel}</span>;
  }

  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((item) => (
        <Tooltip
          key={item.id}
          content={
            <div className="text-center">
              <div className="font-semibold">{item.name}</div>
              {item.subtitle ? <div className="text-white/70">{item.subtitle}</div> : null}
            </div>
          }
        >
          <button
            type="button"
            aria-label={item.subtitle ? `${item.name} — ${item.subtitle}` : item.name}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {initialsFor(item.name)}
          </button>
        </Tooltip>
      ))}
      {overflow > 0 ? (
        <Tooltip
          content={
            <div className="text-center">
              {overflow} more staff member{overflow === 1 ? '' : 's'}
            </div>
          }
        >
          <button
            type="button"
            aria-label={`${overflow} more staff member${overflow === 1 ? '' : 's'}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            +{overflow}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
