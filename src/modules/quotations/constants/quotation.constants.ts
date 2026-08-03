import type { OrderType } from '@/modules/billing';

import type { QuotationStatus } from '../types/quotation.types';

/** Route paths owned by the quotations module — imported by the router, never hardcoded at call sites. */
export const QUOTATIONS_ROUTES = {
  quotations: '/quotations',
  newQuotation: '/quotations/new',
  quotationDetail: (quotationId: string) => `/quotations/${quotationId}`,
} as const;

/**
 * TanStack Query cache keys for this module. The list is keyed by its own
 * filters (mirrors `PURCHASING_QUERY_KEYS.purchaseOrders`'s own reasoning)
 * even though `QuotationsPage` currently applies status/location filters
 * client-side over one fetched list — keeping the key filter-shaped means
 * switching to a real server-side filter later is just a query-key change.
 */
export const QUOTATIONS_QUERY_KEYS = {
  quotations: (filters: { status?: string; locationId?: string } = {}) =>
    ['quotations', filters] as const,
  quotation: (quotationId: string) => ['quotations', quotationId] as const,
};

/**
 * Mirrors `billing.constants.ts`'s own `ORDER_TYPE_OPTIONS` — not imported
 * from there directly since it isn't part of that module's public barrel
 * (only the `OrderType` type is). `NewQuotationPage`'s order-type picker.
 */
export const QUOTATION_ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'delivery', label: 'Delivery' },
];

/** Mirrors the backend's `QuotationStatus.choices` (apps/quotations/constants.py). */
export const QUOTATION_STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

/**
 * Binary-terminal, like purchasing's `canCompletePurchaseOrder`/
 * `canCancelPurchaseOrder` — a quotation has no multi-stage progression the
 * way a sales `Order` does (`nextStatusFor` in `billing.constants.ts`), just
 * `pending` -> one of three terminal states (accepted/declined/expired).
 */
export function canEditQuotation(status: QuotationStatus): boolean {
  return status === 'pending';
}

export function canAcceptQuotation(status: QuotationStatus): boolean {
  return status === 'pending';
}

export function canDeclineQuotation(status: QuotationStatus): boolean {
  return status === 'pending';
}
