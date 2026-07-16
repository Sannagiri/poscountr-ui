import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Standard "nothing here yet" panel — used for every empty list/table in the
 * app instead of a blank area (docs/coding-standards.md §17).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon ? (
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-faint">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-ink">{title}</p>
      {description ? <p className="max-w-xs text-xs text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
