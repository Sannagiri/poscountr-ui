import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface SectionCardProps {
  title: ReactNode;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
  className?: string;
  /** Optional content rendered right-aligned in the header, next to the title (e.g. a count badge or a small action). */
  headerAction?: ReactNode;
}

/**
 * Colored icon chip + tinted gradient header bar section card — the "modern"
 * alternative to a plain `<Card>` + uppercase-label heading, used across
 * Orders/Quotations/Purchase Orders detail and creation screens so every
 * section reads as its own distinct, color-coded block rather than a wall of
 * identical white cards. Originated on `OrderDetailPage`.
 */
export function SectionCard({
  title,
  icon,
  accent,
  children,
  className,
  headerAction,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-surface-card shadow-sm',
        className,
      )}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${accent}20, transparent)` }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </span>
        <p className="flex-1 text-sm font-bold text-ink">{title}</p>
        {headerAction}
      </div>
      <div className="p-4 pt-3">{children}</div>
    </div>
  );
}
