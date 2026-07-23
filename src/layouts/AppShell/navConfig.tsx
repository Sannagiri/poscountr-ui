import type { ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  ChefHat,
  History,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Ticket,
  UserCircle,
  UserCog,
  Users,
} from 'lucide-react';

import type { UserRole } from '@/modules/auth';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: UserRole[];
  /**
   * Nested sub-items — when present, `Sidebar` renders this item as a
   * collapsible accordion group instead of a direct link (`path` is then
   * only used to decide the group's own active/expanded state, it isn't
   * navigated to directly). Keep one level deep; that's all the "Settings ->
   * Invoices, (more later)" structure needs.
   */
  children?: NavItem[];
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
        label: 'Businesses',
        path: '/businesses',
        icon: <Store size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Locations',
        path: '/locations',
        icon: <MapPin size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Inventory',
        path: '/inventory',
        icon: <Boxes size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
      {
        label: 'Orders',
        path: '/orders',
        icon: <Receipt size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
      {
        label: 'Kitchen',
        path: '/kitchen',
        icon: <ChefHat size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Admins',
        path: '/team/admins',
        icon: <Users size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Staff',
        path: '/team/staff',
        icon: <UserCog size={ICON_SIZE} />,
        roles: ['tenant_admin'],
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
    ],
  },
  {
    label: 'Account',
    items: [
      {
        label: 'My Profile',
        path: '/profile',
        icon: <UserCircle size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        label: 'Settings',
        // The group itself has no screen of its own — `Sidebar` only uses
        // this to decide whether the accordion should start expanded
        // (any child path active). Navigating here directly isn't wired up;
        // `/settings` redirects to the first child instead (see
        // `routes/router.tsx`), same "old combined URL" pattern as `/team`.
        path: '/settings',
        icon: <Settings size={ICON_SIZE} />,
        roles: ['tenant_admin'],
        children: [
          {
            label: 'Invoices',
            path: '/settings/invoices',
            icon: <Receipt size={ICON_SIZE} />,
            roles: ['tenant_admin'],
          },
          {
            label: 'Orders',
            path: '/settings/orders',
            icon: <ListOrdered size={ICON_SIZE} />,
            roles: ['tenant_admin'],
          },
          // More sections (e.g. Tax, Notifications, Integrations) land here
          // over time — each just another entry in this array, no other
          // wiring needed (`Sidebar` renders however many children exist).
        ],
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

function filterItems(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) => (item.children ? { ...item, children: filterItems(item.children, role) } : item));
}

export function navGroupsForRole(role: UserRole): NavGroup[] {
  const groups = role === 'ultra_admin' ? PLATFORM_NAV_GROUPS : OWNER_NAV_GROUPS;
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items, role) }))
    .filter((group) => group.items.length > 0);
}
