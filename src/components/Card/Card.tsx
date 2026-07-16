import type { HTMLAttributes, ReactNode } from 'react';

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
}

/** Standard card header — title (+ optional subtitle) left, single action link/button right, divider below. */
export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-border pb-3.5">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-bold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p> : null}
      </div>
      {action ? (
        <div className="shrink-0 text-xs font-semibold text-accent hover:text-accent-dark">
          {action}
        </div>
      ) : null}
    </div>
  );
}
