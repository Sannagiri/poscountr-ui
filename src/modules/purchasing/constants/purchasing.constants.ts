import type { PurchaseOrderStatus, PurchasePaymentStatus } from '../types/purchasing.types';

/** Route paths owned by the purchasing module — imported by the router, never hardcoded at call sites. */
export const PURCHASING_ROUTES = {
  suppliers: '/suppliers',
  purchaseOrders: '/purchase-orders',
  newPurchaseOrder: '/purchase-orders/new',
  purchaseOrderDetail: (purchaseOrderId: string) => `/purchase-orders/${purchaseOrderId}`,
} as const;

/**
 * TanStack Query cache keys for this module. Suppliers/purchase orders are
 * both keyed by their own filters (mirrors `BILLING_QUERY_KEYS.orders`'s own
 * reasoning) even though the list pages currently apply those filters
 * client-side (same "fetch once, narrow with `DataTable`'s own filters"
 * convention `OrdersPage`/`ProductsPage` use) — keeping the key
 * filter-shaped now means switching either list to a real server-side
 * filter later is just a query-key change, not a cache-invalidation rewrite.
 */
export const PURCHASING_QUERY_KEYS = {
  suppliers: (filters: { businessId?: string; isActive?: string } = {}) =>
    ['purchasing', 'suppliers', filters] as const,
  supplier: (supplierId: string) => ['purchasing', 'suppliers', supplierId] as const,
  purchaseOrders: (filters: { status?: string; locationId?: string; supplierId?: string } = {}) =>
    ['purchasing', 'purchase-orders', filters] as const,
  purchaseOrder: (purchaseOrderId: string) =>
    ['purchasing', 'purchase-orders', purchaseOrderId] as const,
};

/** Mirrors the backend's `PurchaseOrderStatus.choices` (apps/purchasing/constants.py). */
export const PURCHASE_ORDER_STATUS_OPTIONS: { value: PurchaseOrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Mirrors the backend's `PurchasePaymentStatus.choices` (apps/purchasing/constants.py) — the completion step's payment-status picker. */
export const PAYMENT_STATUS_OPTIONS: { value: Exclude<PurchasePaymentStatus, ''>; label: string }[] = [
  { value: 'paid', label: 'Paid in full' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'credit', label: 'On credit' },
];

/**
 * Only two transitions exist for a purchase order — pending → completed or
 * pending → cancelled — no multi-stage kitchen-style flow the way a sales
 * `Order` has (`nextStatusFor`/`canCancel` in `billing.constants.ts`). Both
 * helpers below are the purchasing equivalent, simplified accordingly.
 */
export function canCompletePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === 'pending';
}

export function canCancelPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === 'pending';
}

/** Mirrors the backend's own limits for the way-bill attach endpoint (`apps/purchasing/views/way_bill.py`, or wherever it's enforced) — client-side for instant feedback, not a replacement for the server's own check. Shared by the purchasing module's own way-bill control and billing's (on the existing sales `Order`). */
export const MAX_WAY_BILL_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_WAY_BILL_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
