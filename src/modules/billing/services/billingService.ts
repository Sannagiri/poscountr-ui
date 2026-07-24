import { apiClient, unwrap, unwrapWithMeta } from '@/services/apiClient';

import type { InvoiceRaw } from '@/modules/reports/services/reportsService';
// Imported from the concrete file, not the `@/modules/reports` barrel — that
// barrel re-exports `ReportsPage`, which imports `@/modules/billing`'s own
// barrel, and going through both here would create a billing <-> reports
// circular import at module-init time.
import { mapInvoice } from '@/modules/reports/services/reportsService';
import type { Invoice } from '@/modules/reports/types/reports.types';

import type {
  KdsItem,
  KdsOrder,
  Order,
  OrderCreateRequest,
  OrderItem,
  OrderItemRequest,
  OrderStatus,
  OrderType,
} from '../types/billing.types';

/**
 * All calls to `/tenant/orders/` and `/tenant/kds/` live here — components
 * and hooks never call `apiClient` directly (docs/coding-standards.md
 * §14). Every endpoint is `IsTenantAdminOrManager`- or (KDS, kitchen
 * transitions) `IsOrderStaff`-gated server-side, with manager-vs-
 * tenant_admin location scoping enforced entirely inside the service layer
 * on the backend (`apps/billing/services/_scope.py`) — there's no separate
 * "my orders" endpoint here, a manager's `listOrders()` is just
 * pre-scoped.
 */

interface OrderItemRaw {
  id: string;
  product_id: string;
  name: string;
  unit_price: string;
  gst_rate: string;
  quantity: string;
  line_total: string;
}

function mapOrderItem(raw: OrderItemRaw): OrderItem {
  return {
    id: raw.id,
    productId: raw.product_id,
    name: raw.name,
    unitPrice: raw.unit_price,
    gstRate: raw.gst_rate,
    quantity: raw.quantity,
    lineTotal: raw.line_total,
  };
}

interface OrderRaw {
  id: string;
  business_id: string;
  location_id: string;
  location_name: string;
  status: OrderStatus;
  order_type: OrderType;
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
    items: raw.items.map(mapOrderItem),
    kotFiredAt: raw.kot_fired_at,
    preparingAt: raw.preparing_at,
    readyAt: raw.ready_at,
    deliveredAt: raw.delivered_at,
    completedAt: raw.completed_at,
    cancelledAt: raw.cancelled_at,
    createdAt: raw.created_at,
  };
}

function orderCreateRequestToBody(request: OrderCreateRequest) {
  return {
    business_id: request.businessId,
    location_id: request.locationId,
    order_type: request.orderType,
    table_id: request.tableId,
    table_number: request.tableNumber,
    note: request.note,
    idempotency_key: request.idempotencyKey,
    items: request.items?.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
    customer_name: request.customerName,
    customer_phone: request.customerPhone,
    customer_email: request.customerEmail,
    customer_gstin: request.customerGstin,
    customer_state: request.customerState,
  };
}

interface KdsItemRaw {
  name: string;
  quantity: string;
}

function mapKdsItem(raw: KdsItemRaw): KdsItem {
  return { name: raw.name, quantity: raw.quantity };
}

interface KdsOrderRaw {
  id: string;
  status: OrderStatus;
  order_type: OrderType;
  table_number: string;
  token_number: number | null;
  items: KdsItemRaw[];
  elapsed_minutes: number;
  is_late: boolean;
  created_at: string;
}

function mapKdsOrder(raw: KdsOrderRaw): KdsOrder {
  return {
    id: raw.id,
    status: raw.status,
    orderType: raw.order_type,
    tableNumber: raw.table_number,
    tokenNumber: raw.token_number,
    items: raw.items.map(mapKdsItem),
    elapsedMinutes: raw.elapsed_minutes,
    isLate: raw.is_late,
    createdAt: raw.created_at,
  };
}

/**
 * A completed transition's response — `warning` only ever comes back
 * non-null from `complete()` (the lenient monthly-transaction-quota check,
 * or a bill-generation failure folded into the same message). `invoice` is
 * also `complete()`-only: the GST invoice `OrderCompleteView` auto-generates
 * for the just-completed order, still with an empty `pdfUrl` until the
 * frontend renders + uploads the actual PDF (see `useOrderBill`).
 */
interface TransitionResult {
  order: Order;
  warning: string | null;
  invoice: Invoice | null;
}

async function transition(orderId: string, path: string): Promise<TransitionResult> {
  const { data, meta } = await unwrapWithMeta<OrderRaw>(
    apiClient.post(`/tenant/orders/${orderId}/${path}/`),
  );
  return {
    order: mapOrder(data),
    warning: (meta?.warning as string) ?? null,
    invoice: meta?.invoice ? mapInvoice(meta.invoice as InvoiceRaw) : null,
  };
}

export const billingService = {
  /** `status`/`locationId` map straight onto the backend's own `status`/`location_id` query params — no client-side filtering needed, the server already scopes + filters. */
  async listOrders(filters: { status?: string; locationId?: string } = {}): Promise<Order[]> {
    const body = await unwrap<OrderRaw[]>(
      apiClient.get('/tenant/orders/', {
        params: { status: filters.status, location_id: filters.locationId },
      }),
    );
    return body.map(mapOrder);
  },

  async getOrder(orderId: string): Promise<Order> {
    const raw = await unwrap<OrderRaw>(apiClient.get(`/tenant/orders/${orderId}/`));
    return mapOrder(raw);
  },

  async createOrder(request: OrderCreateRequest): Promise<Order> {
    const raw = await unwrap<OrderRaw>(
      apiClient.post('/tenant/orders/', orderCreateRequestToBody(request)),
    );
    return mapOrder(raw);
  },

  /** Sets `request.productId`'s line to `request.quantity` (adds the line if it doesn't exist yet) — only accepted while the order is still `pending`. */
  async addItem(orderId: string, request: OrderItemRequest): Promise<Order> {
    const raw = await unwrap<OrderRaw>(
      apiClient.post(`/tenant/orders/${orderId}/items/`, {
        product_id: request.productId,
        quantity: request.quantity,
      }),
    );
    return mapOrder(raw);
  },

  async removeItem(orderId: string, productId: string): Promise<Order> {
    const raw = await unwrap<OrderRaw>(
      apiClient.delete(`/tenant/orders/${orderId}/items/`, { data: { product_id: productId } }),
    );
    return mapOrder(raw);
  },

  fireKot: (orderId: string) => transition(orderId, 'fire-kot'),
  setPreparing: (orderId: string) => transition(orderId, 'preparing'),
  setReady: (orderId: string) => transition(orderId, 'ready'),
  deliver: (orderId: string) => transition(orderId, 'deliver'),
  /** The only transition that can carry a `warning` — a lenient-mode tenant at/over its monthly-transaction cap still completes the order, with a warning to surface rather than block on. */
  complete: (orderId: string) => transition(orderId, 'complete'),
  cancel: (orderId: string) => transition(orderId, 'cancel'),

  /**
   * `manager`/`kitchen_staff` never pass `locationId` — the backend
   * resolves their queue from `user.assigned_location_id` itself.
   * `tenant_admin` must pass one (the backend 400s otherwise, since it has
   * no single implied location).
   */
  async listKds(locationId?: string): Promise<KdsOrder[]> {
    const body = await unwrap<KdsOrderRaw[]>(
      apiClient.get('/tenant/kds/', { params: { location_id: locationId } }),
    );
    return body.map(mapKdsOrder);
  },
};
