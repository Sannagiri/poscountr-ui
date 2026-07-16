import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Store, User } from 'lucide-react';

import { DropdownMenu } from '@/components';

import { authService, useAuthStore } from '@/modules/auth';

export interface TopbarProps {
  /** Opens the mobile nav drawer — only rendered below `lg` (see `AppShell`). */
  onMenuClick?: () => void;
}

/**
 * Topbar: entity/business switcher for the owner app, search, notifications,
 * and the user menu (profile / change password-or-pin / logout). Matches
 * the approved dashboard mockup.
 */
export function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  async function handleLogout() {
    try {
      await authService.logout();
    } finally {
      clearSession();
      navigate('/login');
    }
  }

  const initials = getInitials(user?.fullName ?? '?');

  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-surface hover:text-ink lg:hidden"
        >
          <Menu size={20} />
        </button>
        {user?.role !== 'ultra_admin' && user?.tenantName ? (
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-border-strong"
          >
            <Store size={15} className="shrink-0" />
            <span className="hidden truncate sm:inline">{user.tenantName}</span>
            <ChevronDown size={14} className="shrink-0 text-ink-faint" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface hover:text-ink"
        >
          <Bell size={18} />
        </button>

        <DropdownMenu
          trigger={
            <button type="button" className="flex items-center gap-2 focus:outline-none">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-ink">
                  {user?.fullName ?? 'Account'}
                </span>
                <span className="block text-[11px] text-ink-faint">{roleLabel(user?.role)}</span>
              </span>
            </button>
          }
          items={[
            { label: 'Profile', icon: User, onSelect: () => navigate('/settings') },
            '-',
            { label: 'Log out', icon: LogOut, destructive: true, onSelect: handleLogout },
          ]}
        />
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
