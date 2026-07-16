import { NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { UserRole } from '@/modules/auth';

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
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors',
                      'hover:bg-surface hover:text-ink',
                      isActive &&
                        'bg-brand/10 font-semibold text-brand hover:bg-brand/10 hover:text-brand',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
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
