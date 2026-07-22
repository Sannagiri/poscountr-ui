import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ShieldCheck } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { UserRole } from '@/modules/auth';

import type { NavItem } from './navConfig';
import { navGroupsForRole } from './navConfig';

export interface SidebarProps {
  role: UserRole;
  /**
   * `desktop` (default) hides below `lg` — the Topbar's hamburger button
   * opens a `mobile` instance of this same component inside a slide-over
   * drawer instead (see `AppShell`). Keeps one nav definition for both.
   */
  variant?: 'desktop' | 'mobile';
}

const LEAF_LINK_CLASSES =
  'flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink';
const LEAF_LINK_ACTIVE_CLASSES =
  'bg-brand/10 font-semibold text-brand hover:bg-brand/10 hover:text-brand';

/**
 * Light sidebar with role-filtered navigation — restyled to match the
 * Metronic (KeenThemes) Tailwind reference this pass is based on, which uses
 * a light/white sidebar rather than the earlier dark-navy one. POSCountr's
 * own brand colors carry the active/accent states (brand orange), not
 * Metronic's palette — see POSCountr-UI-Planning/progress/10_metronic_redesign.md.
 * `ultra_admin` gets a visually distinct "Platform Console" badge instead of
 * the tenant nav (POSCountr-authentication-system.md — the platform "cannot
 * act inside a tenant" and the UI must never blur that line).
 */
export function Sidebar({ role, variant = 'desktop' }: SidebarProps) {
  const groups = navGroupsForRole(role);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'h-full w-64 shrink-0 flex-col border-r border-border bg-white px-4 py-6',
        variant === 'desktop' ? 'hidden lg:flex' : 'flex',
      )}
    >
      <Logo />
      {role === 'ultra_admin' ? (
        <div className="mx-1.5 mb-5 flex items-center gap-2 rounded-control bg-brand/10 px-3 py-2.5 text-[11px] font-bold text-brand-dark">
          <ShieldCheck size={14} />
          Platform console
        </div>
      ) : null}
      <nav className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) =>
                item.children && item.children.length > 0 ? (
                  <NavAccordionItem key={item.path} item={item} pathname={location.pathname} />
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(LEAF_LINK_CLASSES, isActive && LEAF_LINK_ACTIVE_CLASSES)
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

interface NavAccordionItemProps {
  item: NavItem;
  pathname: string;
}

/**
 * Collapsible sidebar group — e.g. "Settings" expanding to reveal "Invoices"
 * (and whatever sections join it later). Starts expanded whenever the
 * current route is already inside the group, so landing on `/settings/
 * invoices` directly (a bookmark, a refresh) never hides the active item
 * inside a collapsed accordion.
 */
function NavAccordionItem({ item, pathname }: NavAccordionItemProps) {
  const children = item.children ?? [];
  const hasActiveChild = children.some((child) => pathname.startsWith(child.path));
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors',
          'hover:bg-surface hover:text-ink',
          hasActiveChild && 'font-semibold text-ink',
        )}
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-ink-faint transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen ? (
        <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                cn(LEAF_LINK_CLASSES, 'py-2', isActive && LEAF_LINK_ACTIVE_CLASSES)
              }
            >
              {child.icon}
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Logo() {
  return (
    <div className="mb-5 flex items-center justify-center gap-3 border-b border-border px-1.5 pb-6">
      <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#070B16" />
        <path
          d="M66 22 L30 22 Q18 22 18 34 L18 68 Q18 76 28 76"
          stroke="#5DA0FF"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="31" y="36" width="34" height="7" rx="3.5" fill="white" opacity="0.88" />
        <circle cx="70" cy="76" r="13" fill="#FF6B2B" />
        <circle cx="70" cy="76" r="6" fill="white" />
      </svg>
      <span className="font-display text-base font-black tracking-tight">
        <span className="text-ink">POS</span>
        <span className="text-brand">C</span>
        <span className="text-ink-faint">ountr</span>
      </span>
    </div>
  );
}
