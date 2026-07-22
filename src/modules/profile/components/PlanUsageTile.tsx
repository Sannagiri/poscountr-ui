import type { LucideIcon } from 'lucide-react';

import type { BadgeTone } from '@/components';
import { Badge } from '@/components';
import { cn } from '@/utils/cn';

export interface PlanUsageTileProps {
  icon: LucideIcon;
  label: string;
  used: number;
  limit: number;
}

const WARNING_RATIO = 0.8;

const BAR_TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  danger: 'bg-danger-text',
  accent: 'bg-accent',
  neutral: 'bg-border-strong',
};

const CHIP_TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  accent: 'bg-accent/10 text-accent-dark',
  neutral: 'bg-border text-ink-soft',
};

/**
 * One "My plan & usage" resource tile — icon chip + label + used/limit
 * count above a proportional bar. A modernized, icon-led take on the plain
 * `UsageMeter` list the old combined Settings page used (still the right
 * building block elsewhere, e.g. `BusinessesPage`'s `LicenseUsageCard` —
 * this is Profile's own denser grid layout, not a replacement for it).
 */
export function PlanUsageTile({ icon: Icon, label, used, limit }: PlanUsageTileProps) {
  const hasLimit = limit > 0;
  const ratio = hasLimit ? used / limit : 0;
  const tone: BadgeTone = !hasLimit
    ? 'neutral'
    : ratio >= 1
      ? 'danger'
      : ratio >= WARNING_RATIO
        ? 'warning'
        : 'success';
  const fillPercent = Math.min(ratio, 1) * 100;

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-border bg-surface/60 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-control', CHIP_TONE_CLASSES[tone])}>
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{label}</span>
        <Badge tone={tone}>{hasLimit ? `${used}/${limit}` : '—'}</Badge>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-[width]', BAR_TONE_CLASSES[tone])}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}
