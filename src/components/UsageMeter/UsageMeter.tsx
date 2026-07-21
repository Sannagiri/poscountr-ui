import type { BadgeTone } from '@/components/Badge';
import { Badge } from '@/components/Badge';
import { cn } from '@/utils/cn';

export interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  className?: string;
}

/** Tone thresholds mirror the backend's own lenient-mode warning point (at/over the cap) — amber once there's no headroom left, red once the cap is actually reached or exceeded. */
const WARNING_RATIO = 0.8;

const BAR_TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  danger: 'bg-danger-text',
  accent: 'bg-accent',
  neutral: 'bg-border-strong',
};

/**
 * A single "N of M used" resource meter — label + status pill above a
 * proportional bar. Generic and domain-agnostic (nothing here knows about
 * licenses or businesses specifically) so any future "usage vs. limit"
 * surface (F7's fuller "My plan & usage" view is the likely next caller) can
 * reuse it instead of a module re-inventing its own bar.
 */
export function UsageMeter({ label, used, limit, className }: UsageMeterProps) {
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
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-soft">{label}</span>
        <Badge tone={tone}>{hasLimit ? `${used} of ${limit} used` : 'No plan assigned'}</Badge>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-[width]', BAR_TONE_CLASSES[tone])}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}
