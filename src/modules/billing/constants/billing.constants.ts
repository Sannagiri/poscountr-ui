import type { UserRole } from '@/modules/auth';

import type { OrderStatus, OrderType } from '../types/billing.types';

/** Route paths owned by the billing module — imported by the router, never hardcoded at call sites. */
export const BILLING_ROUTES = {
  orders: '/orders',
  newOrder: '/orders/new',
  orderDetail: (orderId: string) => `/orders/${orderId}`,
  kitchen: '/kitchen',
} as const;

/**
 * TanStack Query cache keys for this module. The orders list is keyed by
 * its own filters (status/location) since those are server-side query
 * params, not a client-side filter over one fixed list the way
 * `INVENTORY_QUERY_KEYS.products` is — two different filter combinations
 * are genuinely two different server responses worth caching separately.
 */
export const BILLING_QUERY_KEYS = {
  orders: (filters: { status?: string; locationId?: string } = {}) =>
    ['billing', 'orders', filters] as const,
  order: (orderId: string) => ['billing', 'orders', orderId] as const,
  kds: (locationId?: string) => ['billing', 'kds', locationId ?? null] as const,
};

/** Mirrors the backend's `OrderType.choices` (apps/billing/constants.py). */
export const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'delivery', label: 'Delivery' },
];

/** Backend's own doc comment on `KDSListView` says "poll every 3–5s" until the realtime (Channels) upgrade lands — 4s splits the difference. */
export const KDS_POLL_INTERVAL_MS = 4000;

/** Mirrors `KDS_LATE_THRESHOLD_MINUTES` (apps/billing/constants.py) — the backend already returns `isLate` computed, this is just for copy that references the threshold itself (e.g. "late after 15 min"). */
export const KDS_LATE_THRESHOLD_MINUTES = 15;

/** Mirrors `MAX_ITEMS_PER_ORDER` (apps/billing/constants.py) — a sanity cap, not a license limit; used only for a client-side hint, the backend is the real enforcement. */
export const MAX_ITEMS_PER_ORDER = 100;

/**
 * Forward path for each flow — mirrors `_FOOD_TRANSITIONS`/
 * `_NONFOOD_TRANSITIONS` in `apps/billing/constants.py`, inverted (current
 * status → next status) since the UI only ever needs "what's the one next
 * step from here," never the full reachability table the backend keeps.
 */
type NonPendingStatus = Exclude<OrderStatus, 'pending'>;

const FOOD_FORWARD: Partial<Record<OrderStatus, NonPendingStatus>> = {
  pending: 'kot_fired',
  kot_fired: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: 'completed',
};

const NON_FOOD_FORWARD: Partial<Record<OrderStatus, NonPendingStatus>> = {
  pending: 'completed',
};

/** The one forward transition available from `status`, or `null` when the order is terminal (completed/cancelled) or, for the non-food flow, already past pending. Never returns `'pending'` — every entry in both forward-path tables targets a later status. */
export function nextStatusFor(status: OrderStatus, isFoodFlow: boolean): NonPendingStatus | null {
  const table = isFoodFlow ? FOOD_FORWARD : NON_FOOD_FORWARD;
  return table[status] ?? null;
}

/** Cancel is allowed from any pre-completion state in the food flow, but only from `pending` in the non-food flow (mirrors `_FOOD_TRANSITIONS`/`_NONFOOD_TRANSITIONS`'s `CANCELLED` entries). */
export function canCancel(status: OrderStatus, isFoodFlow: boolean): boolean {
  if (isFoodFlow) {
    return (['pending', 'kot_fired', 'preparing', 'ready', 'delivered'] as OrderStatus[]).includes(
      status,
    );
  }
  return status === 'pending';
}

/**
 * Client-side mirror of `TRANSITION_ROLES` (apps/billing/constants.py) —
 * used only to decide which transition buttons to render; the backend is
 * the real enforcement, this just avoids showing a button that would 403.
 */
export const TRANSITION_ROLES: Record<Exclude<OrderStatus, 'pending'>, UserRole[]> = {
  kot_fired: ['tenant_admin', 'manager'],
  preparing: ['tenant_admin', 'manager', 'kitchen_staff'],
  ready: ['tenant_admin', 'manager', 'kitchen_staff'],
  delivered: ['tenant_admin', 'manager'],
  completed: ['tenant_admin', 'manager'],
  cancelled: ['tenant_admin', 'manager'],
};

export function roleMayTransition(
  role: UserRole,
  target: Exclude<OrderStatus, 'pending'>,
): boolean {
  return TRANSITION_ROLES[target].includes(role);
}

/** Button copy for each transition target — "Fire KOT" reads better than the sentence-cased status label a generic `statusLabel('kot_fired')` would produce. */
export const TRANSITION_ACTION_LABELS: Record<Exclude<OrderStatus, 'pending'>, string> = {
  kot_fired: 'Fire KOT',
  preparing: 'Start preparing',
  ready: 'Mark ready',
  delivered: 'Mark delivered',
  completed: 'Complete order',
  cancelled: 'Cancel order',
};
