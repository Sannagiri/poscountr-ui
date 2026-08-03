import type { PaymentDetailType } from '../types/paymentDetails.types';

/** Route paths owned by the paymentDetails module — imported by the router, never hardcoded at call sites. */
export const PAYMENT_DETAILS_ROUTES = {
  paymentDetails: '/payment-details',
} as const;

/**
 * TanStack Query cache keys for this module. `paymentDetails` is keyed per
 * business (or `'all'` when unscoped) so switching the business filter on
 * `PaymentDetailsPage` doesn't serve another business's cached list;
 * `paymentDetailsRoot` is the shared prefix every business-scoped list key
 * falls under, for invalidating all of them at once after a mutation.
 */
export const PAYMENT_DETAILS_QUERY_KEYS = {
  paymentDetailsRoot: ['payment-details'] as const,
  paymentDetails: (businessId?: string) => ['payment-details', businessId ?? 'all'] as const,
  paymentDetail: (paymentDetailId: string) =>
    ['payment-details', 'detail', paymentDetailId] as const,
};

/** Mirrors the backend's `PaymentDetailType.choices`. */
export const PAYMENT_DETAIL_TYPE_OPTIONS: { value: PaymentDetailType; label: string }[] = [
  { value: 'bank', label: 'Bank account' },
  { value: 'upi', label: 'UPI' },
];
