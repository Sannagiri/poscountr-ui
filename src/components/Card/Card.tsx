import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Base card surface — every panel/widget on every screen sits inside one of these. */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-card border border-border bg-white p-4 shadow-card', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /**
   * Optional lucide icon rendered inside a small colored chip to the left of
   * the title — purely decorative, opt-in per call site (no existing
   * `CardHeader` usage needs to change). Introduced for the Profile/
   * Settings screens' section headers.
   */
  icon?: LucideIcon;
}

/** Standard card header — title (+ optional subtitle) left, single action link/button right, divider below. */
export function CardHeader({ title, subtitle, action, icon: Icon }: CardHeaderProps) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-border pb-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
            <Icon size={17} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p> : null}
        </div>
      </div>
      {action ? (
        <div className="shrink-0 text-xs font-semibold text-accent hover:text-accent-dark">
          {action}
        </div>
      ) : null}
    </div>
  );
}
