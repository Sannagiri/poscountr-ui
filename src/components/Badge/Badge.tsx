import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  accent: 'bg-accent/10 text-accent-dark',
  neutral: 'bg-border text-ink-soft',
};

/**
 * Status pill used everywhere a state needs a colored label — order status,
 * license status, active/inactive, stock level. Tone is the only variable;
 * never hardcode a status's colors at the call site (docs/coding-standards.md §13).
 */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
