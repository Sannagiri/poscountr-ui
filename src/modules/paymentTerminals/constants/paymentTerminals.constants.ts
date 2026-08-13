import type { CheckoutMethod, PaymentGatewayProvider } from '../types/paymentTerminals.types';

/** Route paths owned by the paymentTerminals module — imported by the router, never hardcoded at call sites. */
export const PAYMENT_TERMINALS_ROUTES = {
  paymentTerminals: '/payment-terminals',
} as const;

/**
 * TanStack Query cache keys for this module. `paymentTerminals` is keyed per
 * location (or `'all'` when unscoped) so switching the location filter on
 * `PaymentTerminalsPage` doesn't serve another location's cached list;
 * `paymentTerminalsRoot` is the shared prefix every location-scoped list key
 * falls under, for invalidating all of them at once after a mutation — same
 * shape `PAYMENT_DETAILS_QUERY_KEYS` already establishes.
 */
export const PAYMENT_TERMINALS_QUERY_KEYS = {
  paymentTerminalsRoot: ['payment-terminals'] as const,
  paymentTerminals: (locationId?: string) => ['payment-terminals', locationId ?? 'all'] as const,
  paymentTerminal: (paymentTerminalId: string) =>
    ['payment-terminals', 'detail', paymentTerminalId] as const,
};

/** Mirrors the backend's `PaymentGatewayProvider.choices`. */
export const PROVIDER_OPTIONS: { value: PaymentGatewayProvider; label: string }[] = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'phonepe', label: 'PhonePe Business' },
  { value: 'paytm', label: 'Paytm EDC' },
];

/** Mirrors the backend's `CheckoutMethod.choices`. */
export const CHECKOUT_METHOD_OPTIONS: { value: CheckoutMethod; label: string }[] = [
  { value: 'qr_code', label: 'QR Code' },
  { value: 'payment_link', label: 'Payment Link' },
];
