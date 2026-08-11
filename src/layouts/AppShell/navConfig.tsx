import type { ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  ChefHat,
  CreditCard,
  FileClock,
  GitCompare,
  History,
  Landmark,
  LayoutDashboard,
  LayoutTemplate,
  ListOrdered,
  MapPin,
  Percent,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Ticket,
  TrendingUp,
  Truck,
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
  /**
   * Only reachable for a retail/pharmacy/grocery business (the purchasing
   * domain — Suppliers/Purchase orders) — never restaurant/cafe, which stay
   * sell-only. `Sidebar` applies this on top of the plain role filter via
   * `filterByPurchasingGate`, since it depends on the acting tenant_admin's
   * own businesses (`isPurchasingEntityType`, `@/modules/businesses`) rather
   * than the role alone. This is the first nav gate keyed off anything but
   * role — every other entry (including `Tables`/`Kitchen`) still shows
   * regardless of business type, unchanged.
   */
  requiresPurchasingBusiness?: boolean;
  /**
   * Only reachable for a quotation-eligible business — every entity type
   * except restaurant/cafe (`isQuotationEligibleEntityType`,
   * `@/modules/businesses`). `Sidebar` applies this on top of the plain
   * role filter via `filterByQuotationGate`, same mechanism
   * `requiresPurchasingBusiness`/`filterByPurchasingGate` already establish
   * — just the opposite (deny-list) direction of business-type check.
   */
  requiresQuotationBusiness?: boolean;
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
        label: 'Suppliers',
        path: '/suppliers',
        icon: <Truck size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
        requiresPurchasingBusiness: true,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Orders',
        path: '/orders',
        icon: <Receipt size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
      },
      {
        label: 'Purchase orders',
        path: '/purchase-orders',
        icon: <ShoppingCart size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
        requiresPurchasingBusiness: true,
      },
      {
        label: 'Quotations',
        path: '/quotations',
        icon: <FileClock size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
        requiresQuotationBusiness: true,
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
      {
        // Tenant-wide, no entity-type gate — every business type can
        // receive payments, unlike Suppliers/Quotations (both restricted to
        // a subset of entity types via
        // `requiresPurchasingBusiness`/`requiresQuotationBusiness`).
        label: 'Payment Details',
        path: '/payment-details',
        icon: <Landmark size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        // Location-scoped (each machine has its own MID), unlike Payment
        // Details above (business-wide bank accounts/UPI IDs) — same
        // tenant_admin-only administration surface either way.
        label: 'Payment Terminals',
        path: '/payment-terminals',
        icon: <CreditCard size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
      {
        // "Can only be created by tenant admins and can be used by anyone"
        // — same tenant_admin-only administration surface as
        // Admins/Staff/Payment Details above, not a `Settings` sub-item
        // (this configures how documents *look*, tenant-wide, not one
        // business's own numbering/branding settings).
        label: 'Print Layouts',
        path: '/layouts',
        icon: <LayoutTemplate size={ICON_SIZE} />,
        roles: ['tenant_admin'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Reports',
        // The group itself has no screen of its own — `Sidebar` only uses
        // this to decide whether the accordion should start expanded (any
        // child path active). Navigating here directly isn't wired up;
        // `/reports` redirects to the first child instead (see
        // `routes/router.tsx`), same "old combined URL" pattern as
        // `/team`/`/settings`. Split into one sub-item per report (rather
        // than tabs on one shared page) so each — Sales, Purchase, GST — can
        // later be suppressed independently by license/add-on, without
        // restructuring the nav again.
        path: '/reports',
        icon: <BarChart3 size={ICON_SIZE} />,
        roles: ['tenant_admin', 'manager'],
        children: [
          {
            label: 'Sales Reports',
            path: '/reports/sales',
            icon: <TrendingUp size={ICON_SIZE} />,
            roles: ['tenant_admin', 'manager'],
          },
          {
            label: 'Purchase Reports',
            path: '/reports/purchases',
            icon: <ShoppingCart size={ICON_SIZE} />,
            roles: ['tenant_admin', 'manager'],
            requiresPurchasingBusiness: true,
          },
          {
            label: 'GST Reports',
            path: '/reports/gst',
            icon: <Percent size={ICON_SIZE} />,
            roles: ['tenant_admin', 'manager'],
          },
          {
            label: 'Compare Reports',
            path: '/reports/compare',
            icon: <GitCompare size={ICON_SIZE} />,
            roles: ['tenant_admin', 'manager'],
            requiresPurchasingBusiness: true,
          },
        ],
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
          {
            label: 'Purchase orders',
            path: '/settings/purchasing',
            icon: <ShoppingCart size={ICON_SIZE} />,
            roles: ['tenant_admin'],
            requiresPurchasingBusiness: true,
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
    .map((item) =>
      item.children ? { ...item, children: filterItems(item.children, role) } : item,
    );
}

export function navGroupsForRole(role: UserRole): NavGroup[] {
  const groups = role === 'ultra_admin' ? PLATFORM_NAV_GROUPS : OWNER_NAV_GROUPS;
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items, role) }))
    .filter((group) => group.items.length > 0);
}

function filterByPurchasingGateItems(items: NavItem[], hasPurchasingBusiness: boolean): NavItem[] {
  return items
    .filter((item) => !item.requiresPurchasingBusiness || hasPurchasingBusiness)
    .map((item) =>
      item.children
        ? { ...item, children: filterByPurchasingGateItems(item.children, hasPurchasingBusiness) }
        : item,
    );
}

/**
 * Applied on top of `navGroupsForRole`'s own role filter — drops every
 * `requiresPurchasingBusiness` entry (Suppliers, Purchase orders) unless the
 * caller says at least one of the acting tenant_admin's businesses is
 * retail/pharmacy/grocery. `Sidebar` resolves `hasPurchasingBusiness` itself
 * (via `useBusinesses`/`isPurchasingEntityType`) since that's a data
 * dependency this pure function has no business making — a manager, who
 * can't call `/tenant/businesses/` at all, has no way to resolve this
 * client-side, so `Sidebar` passes `true` for them (same lenient fallback
 * `NewOrderPage` already accepts for a manager's unresolvable business
 * context elsewhere).
 */
export function filterByPurchasingGate(
  groups: NavGroup[],
  hasPurchasingBusiness: boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterByPurchasingGateItems(group.items, hasPurchasingBusiness),
    }))
    .filter((group) => group.items.length > 0);
}

function filterByQuotationGateItems(items: NavItem[], hasQuotationBusiness: boolean): NavItem[] {
  return items
    .filter((item) => !item.requiresQuotationBusiness || hasQuotationBusiness)
    .map((item) =>
      item.children
        ? { ...item, children: filterByQuotationGateItems(item.children, hasQuotationBusiness) }
        : item,
    );
}

/**
 * Applied on top of `navGroupsForRole`'s own role filter — drops the
 * `requiresQuotationBusiness` entry (Quotations) unless the caller says at
 * least one of the acting tenant_admin's businesses is quotation-eligible
 * (`isQuotationEligibleEntityType` — every entity type except restaurant/
 * cafe). Same shape as `filterByPurchasingGate` — `Sidebar` resolves
 * `hasQuotationBusiness` itself, and a manager (who can't call
 * `/tenant/businesses/` at all) gets the same lenient `true` fallback.
 */
export function filterByQuotationGate(
  groups: NavGroup[],
  hasQuotationBusiness: boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterByQuotationGateItems(group.items, hasQuotationBusiness),
    }))
    .filter((group) => group.items.length > 0);
}
