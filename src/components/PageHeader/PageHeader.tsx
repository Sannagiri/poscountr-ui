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
 *
 * Sticks to the top of `AppShell`'s `<main data-scroll-root>` (the app's one
 * shared scroll container) as content scrolls past — page actions live here
 * (Save, Preview, …), and on a long page scrolling them out of view meant
 * scrolling all the way back up just to save. `main` itself carries zero
 * vertical padding specifically so this works with no ambiguity (see
 * `AppShell.tsx`'s own doc comment) — `top: 0` here always means flush
 * against `main`'s true edge, not "wherever `main`'s own top padding
 * happens to end," which some browsers resolve inconsistently for a
 * `sticky` child nested a couple of levels below the padded box.
 *
 * `pt-5 pb-4` are this component's own padding, not a margin/gap supplied
 * by a parent — the resting (unscrolled) appearance and the stuck
 * appearance must be pixel-identical, or the header visibly snaps/jumps the
 * instant it engages (the old `AppShell`-supplied top padding disappeared
 * the moment you scrolled even 1px, since only the *stuck* box is what's
 * actually visible past that point — a jarring size change right at the
 * scroll threshold). Baking the padding into the sticky box itself means
 * nothing about its rendered size ever changes with scroll position, so
 * there's nothing to snap. `will-change-transform` hints the browser to
 * composite this box on its own GPU layer, smoothing the sticky
 * repositioning itself (separate from the snap issue above) rather than
 * repainting on every scroll tick.
 */
export function PageHeader({ breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 bg-surface pb-4 pt-5 will-change-transform sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}
