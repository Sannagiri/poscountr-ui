import type { ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Ticket,
  Users,
} from 'lucide-react';

import type { UserRole } from '@/modules/auth';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ICON_SIZE = 16;

/**
 * Single source of truth for the sidebar. Each item lists which roles can
 * see it — `Sidebar` filters this, it never hardcodes role checks itself
 * (docs/coding-standards.md §12, "do not implement the same concept in
 * different ways across modules").
 */
export const OWNER_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: <LayoutDashboard size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
    ],
  },
  {
    label: 'Business',
    items: [
      {
        label: 'Businesses & Locations',
        path: '/businesses',
        icon: <Store size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Team',
        path: '/team',
        icon: <Users size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Inventory',
        path: '/inventory',
        icon: <Boxes size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
      {
        label: 'Orders & KDS',
        path: '/orders',
        icon: <Receipt size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Reports',
        path: '/reports',
        icon: <BarChart3 size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: <Settings size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
    ],
  },
];

export const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      {
        label: 'Dashboard',
        path: '/platform',
        icon: <LayoutDashboard size={ICON_SIZE} />,
        roles: ['ultra_admin'],
      },
      {
        label: 'License types',
        path: '/platform/license-types',
        icon: <ShieldCheck size={ICON_SIZE} />,
        roles: ['ultra_admin'],
      },
      {
        label: 'Tenants',
        path: '/platform/tenants',
        icon: <Ticket size={ICON_SIZE} />,
        roles: ['ultra_admin'],
      },
      {
        label: 'Platform admins',
        path: '/platform/admins',
        icon: <Users size={ICON_SIZE} />,
        roles: ['ultra_admin'],
      },
      {
        label: 'Audit log',
        path: '/platform/audit-log',
        icon: <History size={ICON_SIZE} />,
        roles: ['ultra_admin'],
      },
    ],
  },
];

export function navGroupsForRole(role: UserRole): NavGroup[] {
  const groups = role === 'ultra_admin' ? PLATFORM_NAV_GROUPS : OWNER_NAV_GROUPS;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}
