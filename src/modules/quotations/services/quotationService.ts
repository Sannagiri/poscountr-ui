import { apiClient, unwrap, unwrapWithMeta } from '@/services/apiClient';

import type { Order, OrderStatus, OrderType, PaymentMethod } from '@/modules/billing';

import type {
  LineType,
  Quotation,
  QuotationCreateRequest,
  QuotationItem,
  QuotationLineRequest,
  QuotationStatus,
} from '../types/quotation.types';

/**
 * All calls to `/tenant/quotations/` and `/tenant/businesses/{id}/quotation-
 * settings/` live here — components and hooks never call `apiClient`
 * directly (docs/coding-standards.md §14). Every endpoint is
 * `IsTenantAdminOrManager`-gated server-side, with manager-vs-tenant_admin
 * location scoping enforced entirely inside the service layer on the
 * backend — same convention `purchasingService`/`billingService` already
 * follow.
 */

interface QuotationItemRaw {
  id: string;
  product_id: string | null;
  line_type: LineType;
  name: string;
  unit_price: string;
  gst_rate: string;
  quantity: string;
  discount_percent: string;
  line_total: string;
  unit: string | null;
}

function mapQuotationItem(raw: QuotationItemRaw): QuotationItem {
  return {
    id: raw.id,
    productId: raw.product_id,
    lineType: raw.line_type,
    name: raw.name,
    unitPrice: raw.unit_price,
    gstRate: raw.gst_rate,
    quantity: raw.quantity,
    discountPercent: raw.discount_percent,
    lineTotal: raw.line_total,
    unit: raw.unit,
  };
}

/** Sends whichever pair the caller set — `product_id` (a catalog line) or
 * `name`+`unit_price`(+`gst_rate`) (an ad-hoc line) — never both, mirroring
 * the backend's "exactly one of" line contract (see `QuotationLineRequest`). */
function quotationLineRequestToBody(line: QuotationLineRequest) {
  return {
    product_id: line.productId,
    name: line.name,
    unit_price: line.unitPrice,
    gst_rate: line.gstRate,
    quantity: line.quantity,
    discount_percent: line.discountPercent,
  };
}

interface QuotationRaw {
  id: string;
  business_id: string;
  location_id: string;
  location_name: string;
  status: QuotationStatus;
  quotation_number: string | null;
  order_type: OrderType;
  discount_percent: string;
  discount_amount: string;
  subtotal: string;
  tax_total: string;
  total: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  customer_state: string;
  valid_until: string | null;
  decline_reason: string;
  order_id: string | null;
  pdf_url: string;
  pdf_uploaded_at: string | null;
  note: string;
  items: QuotationItemRaw[];
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  created_at: string;
}

function mapQuotation(raw: QuotationRaw): Quotation {
  return {
    id: raw.id,
    businessId: raw.business_id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    status: raw.status,
    quotationNumber: raw.quotation_number,
    orderType: raw.order_type,
    discountPercent: raw.discount_percent,
    discountAmount: raw.discount_amount,
    subtotal: raw.subtotal,
    taxTotal: raw.tax_total,
    total: raw.total,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerEmail: raw.customer_email,
    customerGstin: raw.customer_gstin,
    customerState: raw.customer_state,
    validUntil: raw.valid_until,
    declineReason: raw.decline_reason,
    orderId: raw.order_id,
    pdfUrl: raw.pdf_url,
    pdfUploadedAt: raw.pdf_uploaded_at,
    note: raw.note,
    items: raw.items.map(mapQuotationItem),
    acceptedAt: raw.accepted_at,
    declinedAt: raw.declined_at,
    expiredAt: raw.expired_at,
    createdAt: raw.created_at,
  };
}

function quotationCreateRequestToBody(request: QuotationCreateRequest) {
  return {
    business_id: request.businessId,
    location_id: request.locationId,
    order_type: request.orderType,
    note: request.note,
    idempotency_key: request.idempotencyKey,
    items: request.items?.map(quotationLineRequestToBody),
    discount_percent: request.discountPercent,
    customer_name: request.customerName,
    customer_phone: request.customerPhone,
    customer_email: request.customerEmail,
    customer_gstin: request.customerGstin,
    customer_state: request.customerState,
  };
}

/**
 * `meta.order` on `POST /tenant/quotations/{id}/accept/` is the full order
 * object — same shape `OrderOutputSerializer` returns everywhere else in
 * `billing` (`OrderDetailPage` already knows how to render it). Duplicated
 * here rather than imported from `billingService` (that module's own
 * `mapOrder` isn't part of its public barrel — components/hooks never reach
 * into another module's service file, docs/coding-standards.md §14).
 */
interface OrderItemRaw {
  id: string;
  product_id: string | null;
  line_type: LineType;
  name: string;
  unit_price: string;
  gst_rate: string;
  quantity: string;
  discount_percent: string;
  line_total: string;
  unit: string | null;
  hsn_code: string | null;
}

interface OrderRaw {
  id: string;
  business_id: string;
  location_id: string;
  location_name: string;
  status: OrderStatus;
  order_type: OrderType;
  payment_method: string;
  discount_percent: string;
  discount_amount: string;
  apply_gst: boolean;
  order_number: string | null;
  kitchen_enabled: boolean;
  table_id: string | null;
  table_number: string;
  token_number: number | null;
  token_date: string | null;
  subtotal: string;
  tax_total: string;
  total: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  customer_state: string;
  note: string;
  items: OrderItemRaw[];
  way_bill_url: string | null;
  way_bill_uploaded_at: string | null;
  kot_fired_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

function mapOrder(raw: OrderRaw): Order {
  return {
    id: raw.id,
    businessId: raw.business_id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    status: raw.status,
    orderType: raw.order_type,
    paymentMethod: (raw.payment_method as PaymentMethod | '') || '',
    discountPercent: raw.discount_percent,
    discountAmount: raw.discount_amount,
    applyGst: raw.apply_gst,
    orderNumber: raw.order_number,
    kitchenEnabled: raw.kitchen_enabled,
    tableId: raw.table_id,
    tableNumber: raw.table_number,
    tokenNumber: raw.token_number,
    tokenDate: raw.token_date,
    subtotal: raw.subtotal,
    taxTotal: raw.tax_total,
    total: raw.total,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerEmail: raw.customer_email,
    customerGstin: raw.customer_gstin,
    customerState: raw.customer_state,
    note: raw.note,
    items: raw.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      lineType: item.line_type,
      name: item.name,
      unitPrice: item.unit_price,
      gstRate: item.gst_rate,
      quantity: item.quantity,
      discountPercent: item.discount_percent,
      lineTotal: item.line_total,
      unit: item.unit,
      hsnCode: item.hsn_code,
    })),
    wayBillUrl: raw.way_bill_url,
    wayBillUploadedAt: raw.way_bill_uploaded_at,
    kotFiredAt: raw.kot_fired_at,
    preparingAt: raw.preparing_at,
    readyAt: raw.ready_at,
    deliveredAt: raw.delivered_at,
    completedAt: raw.completed_at,
    cancelledAt: raw.cancelled_at,
    createdAt: raw.created_at,
  };
}

export const quotationService = {
  /** `status`/`locationId` map straight onto the backend's own `status`/`location_id` query params. */
  async listQuotations(
    filters: { status?: string; locationId?: string } = {},
  ): Promise<Quotation[]> {
    const body = await unwrap<QuotationRaw[]>(
      apiClient.get('/tenant/quotations/', {
        params: { status: filters.status, location_id: filters.locationId },
      }),
    );
    return body.map(mapQuotation);
  },

  async getQuotation(quotationId: string): Promise<Quotation> {
    const raw = await unwrap<QuotationRaw>(apiClient.get(`/tenant/quotations/${quotationId}/`));
    return mapQuotation(raw);
  },

  async createQuotation(request: QuotationCreateRequest): Promise<Quotation> {
    const raw = await unwrap<QuotationRaw>(
      apiClient.post('/tenant/quotations/', quotationCreateRequestToBody(request)),
    );
    return mapQuotation(raw);
  },

  /** For a catalog line (`productId` set), adds/increases that line; for an ad-hoc line (`name`+`unitPrice` set instead), always appends a new line. Only accepted while the quotation is still `pending`. */
  async addItem(quotationId: string, line: QuotationLineRequest): Promise<Quotation> {
    const raw = await unwrap<QuotationRaw>(
      apiClient.post(`/tenant/quotations/${quotationId}/items/`, quotationLineRequestToBody(line)),
    );
    return mapQuotation(raw);
  },

  /** Removes one line by its own id (not `productId` — an ad-hoc line has no product, and a quotation may hold more than one). */
  async removeItem(quotationId: string, itemId: string): Promise<Quotation> {
    const raw = await unwrap<QuotationRaw>(
      apiClient.delete(`/tenant/quotations/${quotationId}/items/`, {
        data: { item_id: itemId },
      }),
    );
    return mapQuotation(raw);
  },

  /**
   * Accepting auto-creates a real `billing.Order` with the exact quoted
   * prices frozen in (never re-priced from today's catalog) — `meta.order`
   * on the response is that order's full detail, ready to hand straight to
   * `BILLING_ROUTES.orderDetail(order.id)`.
   */
  async acceptQuotation(quotationId: string): Promise<{ quotation: Quotation; order: Order }> {
    const { data, meta } = await unwrapWithMeta<QuotationRaw>(
      apiClient.post(`/tenant/quotations/${quotationId}/accept/`),
    );
    return { quotation: mapQuotation(data), order: mapOrder(meta.order as OrderRaw) };
  },

  async declineQuotation(quotationId: string, reason?: string): Promise<Quotation> {
    const raw = await unwrap<QuotationRaw>(
      apiClient.post(`/tenant/quotations/${quotationId}/decline/`, { reason }),
    );
    return mapQuotation(raw);
  },

  /** Attaches a client-rendered quotation document PDF, storing it in S3 (field name `pdf`) — mirrors `purchasingService.uploadPurchaseOrderPdf` exactly. */
  async uploadQuotationPdf(quotationId: string, file: File): Promise<Quotation> {
    const formData = new FormData();
    formData.append('pdf', file);
    const raw = await unwrap<QuotationRaw>(
      apiClient.post(`/tenant/quotations/${quotationId}/pdf/`, formData),
    );
    return mapQuotation(raw);
  },
};
