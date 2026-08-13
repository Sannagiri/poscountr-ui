/**
 * Types mirror the real Django serializers in `apps/payment_gateways/` —
 * field names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). A `PaymentTerminal` is one physical EDC/UPI
 * machine, scoped to exactly one `Location` (its own MID lives here, unlike
 * `PaymentDetail` which is business-wide) — see
 * `apps/payment_gateways/models/payment_terminal.py`.
 */

/** Mirrors the backend's `PaymentGatewayProvider.choices`. Only `razorpay` has a real adapter today — the other two exist so a terminal record can be created ahead of its adapter being built. */
export type PaymentGatewayProvider = 'razorpay' | 'phonepe' | 'paytm';

/**
 * Mirrors the backend's `CheckoutMethod.choices`. Which of a provider's
 * products a terminal pushes a payment through — for Razorpay, `qr_code`
 * uses the QR Code API (a separately-activated product some accounts don't
 * have enabled yet), `payment_link` is the fallback that works without that
 * activation, rendering its own QR from the payment link's URL server-side.
 * Editable at any time (unlike `provider`/`locationId`) — a tenant_admin
 * flips a terminal between the two as their account's activation status
 * changes.
 */
export type CheckoutMethod = 'qr_code' | 'payment_link';

/**
 * One EDC/UPI machine at one location. `apiKey` is the only credential ever
 * read back — `apiSecret`/`webhookSecret` are write-only server-side
 * (`PaymentTerminalOutputSerializer` never includes them), so there is
 * nothing to show or diff against on edit; the form always starts those two
 * fields blank and only sends them if the tenant_admin actually types
 * something new.
 */
export interface PaymentTerminal {
  id: string;
  locationId: string;
  locationName: string;
  provider: PaymentGatewayProvider;
  checkoutMethod: CheckoutMethod;
  label: string;
  mid: string;
  tid: string;
  deviceSerial: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

/** `POST /tenant/payment-terminals/` body. `locationId`/`provider` are both immutable after creation — `PaymentTerminalUpdateRequest` has neither field. `checkoutMethod` defaults server-side to `'qr_code'` when omitted. */
export interface PaymentTerminalCreateRequest {
  locationId: string;
  provider: PaymentGatewayProvider;
  checkoutMethod?: CheckoutMethod;
  label: string;
  mid: string;
  tid?: string;
  deviceSerial?: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret?: string;
}

/**
 * `PATCH /tenant/payment-terminals/{id}/` body — every field optional.
 * `apiSecret`/`webhookSecret` must be omitted entirely (not sent as `''`)
 * when the tenant_admin leaves them blank on edit — the backend only
 * touches fields present in the request body, so omitting one leaves the
 * stored secret untouched; sending `''` would blank out a working one.
 */
export interface PaymentTerminalUpdateRequest {
  checkoutMethod?: CheckoutMethod;
  label?: string;
  mid?: string;
  tid?: string;
  deviceSerial?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
}

/** Mirrors the backend's `PaymentIntentStatus.choices` (apps/payment_gateways/constants.py). */
export type PaymentIntentStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'expired';

/**
 * One payment attempt on an order, returned by `POST /tenant/orders/{id}/initiate-payment/`.
 * `displayPayload` is whatever the gateway adapter returned to show on
 * screen — for Razorpay today, `upiQrImageUrl` is the one field the checkout
 * UI actually renders; the rest are kept for debugging/future providers.
 */
export interface PaymentIntent {
  id: string;
  orderId: string;
  terminalId: string;
  provider: PaymentGatewayProvider;
  status: PaymentIntentStatus;
  amount: string;
  createdAt: string;
  displayPayload: {
    razorpayOrderId?: string;
    upiQrId?: string;
    upiQrImageUrl?: string;
    paymentLinkId?: string;
    paymentLinkUrl?: string;
  };
}
