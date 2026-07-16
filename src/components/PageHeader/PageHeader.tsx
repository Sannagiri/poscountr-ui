import type { ReactNode } from 'react';

import type { BreadcrumbItem } from '@/components/Breadcrumb';
import { Breadcrumb } from '@/components/Breadcrumb';

export interface PageHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Standard page header — breadcrumb, title, subtitle, right-aligned actions.
 * Every module page (list/detail) starts with this so header spacing and
 * hierarchy never drift between screens (docs/coding-standards.md §13).
 */
export function PageHeader({ breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}
