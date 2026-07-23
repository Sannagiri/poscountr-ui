import type { OrderResetPeriod, ResourceKey } from '../types/settings.types';

/** Route paths owned by the settings module — imported by the router, never hardcoded at call sites. */
export const SETTINGS_ROUTES = {
  invoices: '/settings/invoices',
  orders: '/settings/orders',
} as const;

/** TanStack Query cache keys for this module. */
export const SETTINGS_QUERY_KEYS = {
  licensePlan: ['settings', 'license-plan'] as const,
  invoiceSettings: (businessId: string) => ['settings', 'invoice-settings', businessId] as const,
  orderSettings: (businessId: string) => ['settings', 'order-settings', businessId] as const,
};

/** Mirrors `OrderResetPeriod.choices` (apps/billing/constants.py) — display order + label. */
export const ORDER_RESET_PERIOD_OPTIONS: { value: OrderResetPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'continuous', label: 'Never resets' },
];

/** Mirrors `ResourceKey.choices` (apps/platform/constants.py) — display order + label for the "My plan & usage" meters. */
export const RESOURCE_KEY_OPTIONS: { key: ResourceKey; label: string }[] = [
  { key: 'tenant_admins', label: 'Tenant admins' },
  { key: 'managers', label: 'Managers' },
  { key: 'kitchen_staff', label: 'Kitchen staff' },
  { key: 'business_entities', label: 'Business entities' },
  { key: 'locations', label: 'Locations' },
  { key: 'products', label: 'Products' },
  { key: 'monthly_transactions', label: 'Monthly transactions' },
];
