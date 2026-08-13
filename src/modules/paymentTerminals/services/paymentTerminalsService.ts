import { apiClient, unwrap } from '@/services/apiClient';

import type {
  CheckoutMethod,
  PaymentGatewayProvider,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentTerminal,
  PaymentTerminalCreateRequest,
  PaymentTerminalUpdateRequest,
} from '../types/paymentTerminals.types';

/**
 * All calls to `/tenant/payment-terminals/` and the payment-initiation
 * endpoint live here — components and hooks never call `apiClient` directly
 * (docs/coding-standards.md §14).
 */

interface PaymentTerminalRaw {
  id: string;
  location_id: string;
  location_name: string;
  provider: PaymentGatewayProvider;
  checkout_method: CheckoutMethod;
  label: string;
  mid: string;
  tid: string;
  device_serial: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

interface PaymentIntentRaw {
  id: string;
  order_id: string;
  terminal_id: string;
  provider: PaymentGatewayProvider;
  status: PaymentIntentStatus;
  amount: string;
  created_at: string;
  display_payload?: {
    razorpay_order_id?: string;
    upi_qr_id?: string;
    upi_qr_image_url?: string;
    payment_link_id?: string;
    payment_link_url?: string;
  };
}

function mapPaymentTerminal(raw: PaymentTerminalRaw): PaymentTerminal {
  return {
    id: raw.id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    provider: raw.provider,
    checkoutMethod: raw.checkout_method,
    label: raw.label,
    mid: raw.mid,
    tid: raw.tid,
    deviceSerial: raw.device_serial,
    apiKey: raw.api_key,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

function mapPaymentIntent(raw: PaymentIntentRaw): PaymentIntent {
  const payload = raw.display_payload ?? {};
  return {
    id: raw.id,
    orderId: raw.order_id,
    terminalId: raw.terminal_id,
    provider: raw.provider,
    status: raw.status,
    amount: raw.amount,
    createdAt: raw.created_at,
    displayPayload: {
      razorpayOrderId: payload.razorpay_order_id,
      upiQrId: payload.upi_qr_id,
      upiQrImageUrl: payload.upi_qr_image_url,
      paymentLinkId: payload.payment_link_id,
      paymentLinkUrl: payload.payment_link_url,
    },
  };
}

function createRequestToBody(request: PaymentTerminalCreateRequest) {
  return {
    location_id: request.locationId,
    provider: request.provider,
    checkout_method: request.checkoutMethod,
    label: request.label,
    mid: request.mid,
    tid: request.tid,
    device_serial: request.deviceSerial,
    api_key: request.apiKey,
    api_secret: request.apiSecret,
    webhook_secret: request.webhookSecret,
  };
}

/** Omits `api_secret`/`webhook_secret` entirely when blank — see the type's own doc comment on why sending `''` there would be destructive. */
function updateRequestToBody(request: PaymentTerminalUpdateRequest) {
  const body: Record<string, string> = {};
  if (request.checkoutMethod !== undefined) body.checkout_method = request.checkoutMethod;
  if (request.label !== undefined) body.label = request.label;
  if (request.mid !== undefined) body.mid = request.mid;
  if (request.tid !== undefined) body.tid = request.tid;
  if (request.deviceSerial !== undefined) body.device_serial = request.deviceSerial;
  if (request.apiKey !== undefined) body.api_key = request.apiKey;
  if (request.apiSecret) body.api_secret = request.apiSecret;
  if (request.webhookSecret) body.webhook_secret = request.webhookSecret;
  return body;
}

export const paymentTerminalsService = {
  /** Omit `locationId` to list every location's terminals in one call (each row's own `locationId`/`locationName` distinguishes them); pass it to scope to one location. */
  async listPaymentTerminals(locationId?: string): Promise<PaymentTerminal[]> {
    const query = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
    const body = await unwrap<PaymentTerminalRaw[]>(
      apiClient.get(`/tenant/payment-terminals/${query}`),
    );
    return body.map(mapPaymentTerminal);
  },

  async getPaymentTerminal(paymentTerminalId: string): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.get(`/tenant/payment-terminals/${paymentTerminalId}/`),
    );
    return mapPaymentTerminal(raw);
  },

  async createPaymentTerminal(request: PaymentTerminalCreateRequest): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.post('/tenant/payment-terminals/', createRequestToBody(request)),
    );
    return mapPaymentTerminal(raw);
  },

  /** `locationId`/`provider` are immutable — never part of `PaymentTerminalUpdateRequest`, so there's nothing to accidentally send here. */
  async updatePaymentTerminal(
    paymentTerminalId: string,
    request: PaymentTerminalUpdateRequest,
  ): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.patch(
        `/tenant/payment-terminals/${paymentTerminalId}/`,
        updateRequestToBody(request),
      ),
    );
    return mapPaymentTerminal(raw);
  },

  async activatePaymentTerminal(paymentTerminalId: string): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.post(`/tenant/payment-terminals/${paymentTerminalId}/activate/`),
    );
    return mapPaymentTerminal(raw);
  },

  /** Soft-delete — a deactivated terminal stops being resolvable at its location, so `initiate-payment` there fails until another one is activated. */
  async deactivatePaymentTerminal(paymentTerminalId: string): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.post(`/tenant/payment-terminals/${paymentTerminalId}/deactivate/`),
    );
    return mapPaymentTerminal(raw);
  },

  /**
   * Makes one live call to the gateway with this terminal's saved
   * credentials. Resolves with the terminal on success; on failure the
   * promise rejects with the usual `ApiError` — the backend's own message
   * (e.g. "Razorpay rejected these credentials: …") is already
   * `describeApiError`-ready, no special handling needed here.
   */
  async verifyPaymentTerminal(paymentTerminalId: string): Promise<PaymentTerminal> {
    const raw = await unwrap<PaymentTerminalRaw>(
      apiClient.post(`/tenant/payment-terminals/${paymentTerminalId}/verify/`),
    );
    return mapPaymentTerminal(raw);
  },

  /**
   * Pushes `orderId`'s total to its location's active terminal. Completion
   * itself happens asynchronously (the gateway's webhook flips the order to
   * `completed` server-side) — the caller is expected to poll the order
   * (see `useOrder`'s `poll` option) rather than treat this call's response
   * as the payment outcome.
   *
   * `checkoutMethod` overrides the terminal's own configured default for
   * this one attempt (e.g. the checkout screen's QR Code/Payment Link
   * picker) — omit it to use whatever the terminal is set to.
   */
  async initiatePayment(orderId: string, checkoutMethod?: CheckoutMethod): Promise<PaymentIntent> {
    const raw = await unwrap<PaymentIntentRaw>(
      apiClient.post(`/tenant/orders/${orderId}/initiate-payment/`, {
        checkout_method: checkoutMethod,
      }),
    );
    return mapPaymentIntent(raw);
  },
};
