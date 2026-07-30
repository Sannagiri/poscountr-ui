import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { BadgeTone } from '@/components';
import { Badge, Card } from '@/components';

export type KpiTint = 'brand' | 'accent' | 'success' | 'warning' | 'danger';

const TINT_CLASSES: Record<KpiTint, string> = {
  brand: 'bg-brand/10 text-brand',
  accent: 'bg-accent/10 text-accent-dark',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
};

export interface KpiTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Icon-chip color — purely visual grouping, distinct from the delta badge's success/danger, which is judged by `goodDirection` below. */
  tint: KpiTint;
  /** `null` when there's no prior-period figure to compare against yet (still loading, or the denominator was zero). */
  deltaPercent: number | null;
  /**
   * Which direction of change reads as "good" for this metric — 'up' for
   * revenue/orders/AOV/units, 'down' for cancelled orders, 'neutral' for a
   * metric like discounts where more/less isn't inherently good or bad
   * (it's informational, not judged).
   */
  goodDirection: 'up' | 'down' | 'neutral';
  /** Optional small print below the value/delta row — e.g. a CGST/SGST/IGST breakdown. */
  caption?: ReactNode;
}

/** One executive-summary metric, with a period-over-period delta badge — the single highest-leverage addition over a bare number: it tells you whether the business is winning, not just what a figure is. */
export function KpiTile({
  label,
  value,
  icon: Icon,
  tint,
  deltaPercent,
  goodDirection,
  caption,
}: KpiTileProps) {
  const direction = deltaPercent === null || deltaPercent === 0 ? null : deltaPercent > 0 ? 'up' : 'down';
  const tone: BadgeTone =
    direction === null || goodDirection === 'neutral'
      ? 'neutral'
      : direction === goodDirection
        ? 'success'
        : 'danger';

  return (
    <Card className="flex flex-col gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-control ${TINT_CLASSES[tint]}`}>
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
          {deltaPercent !== null ? (
            <Badge tone={tone}>
              {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–'}{' '}
              {Math.abs(deltaPercent).toFixed(1)}%
            </Badge>
          ) : null}
        </div>
        {caption ? <p className="mt-1 text-[11px] text-ink-faint">{caption}</p> : null}
      </div>
    </Card>
  );
}
