/**
 * Types mirror the real Django serializers in `apps/billing/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See `apps/billing/serializers/
 * {input,output}.py`, `apps/billing/constants.py` (OrderStatus, OrderType,
 * TRANSITION_ROLES, KDS_LATE_THRESHOLD_MINUTES), `apps/billing/models/
 * {order,order_item}.py`.
 *
 * Decimal fields (`unitPrice`, `quantity`, `subtotal`, …) stay `string`
 * end-to-end — same convention `inventory.types.ts` already established —
 * since DRF's `DecimalField` serializes as a string to avoid float
 * precision loss.
 */

export type OrderStatus =
  'pending' | 'kot_fired' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

/**
 * A priced line on an order. `name`/`unitPrice`/`gstRate` are snapshotted
 * server-side from the product at the moment it was added, so a line stays
 * correct even if the product's own price changes later — never re-derive
 * these from a live product lookup.
 */
export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  unitPrice: string;
  gstRate: string;
  quantity: string;
  lineTotal: string;
}

/**
 * Full order detail — `OrderOutputSerializer`'s shape, what
 * `OrderDetailView`/`OrderListCreateView` return. Only visible to
 * tenant_admin/manager (`IsTenantAdminOrManager`); the kitchen gets the
 * price-free `KdsOrder` projection instead (see below).
 *
 * Which of the six `*_at` timestamps end up populated — and which
 * lifecycle transition applies next — depends on `kitchenEnabled`, the
 * order's business's `OrderSettings.kitchen_enabled` at read time (food
 * flow: kot_fired → preparing → ready → delivered → completed; non-food:
 * pending → completed directly).
 */
export interface Order {
  id: string;
  businessId: string;
  locationId: string;
  locationName: string;
  status: OrderStatus;
  orderType: OrderType;
  /** Per-business gap-less order number; `null` for orders created before this field existed. */
  orderNumber: string | null;
  /** Mirrors the business's `OrderSettings.kitchen_enabled` at read time — drives which transitions are legal next. */
  kitchenEnabled: boolean;
  /** The floor-plan table (`modules/tables`) this order was opened from, if any — `null` for the classic flow or a takeaway/delivery order. */
  tableId: string | null;
  tableNumber: string;
  tokenNumber: number | null;
  tokenDate: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  customerState: string;
  note: string;
  items: OrderItem[];
  kotFiredAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** One line when opening an order — `quantity` is that line's quantity, not a delta. */
export interface OrderLineRequest {
  productId: string;
  quantity: string;
}

/**
 * `POST /tenant/orders/` body. `businessId`/`locationId` are optional — a
 * manager is always forced to their own assigned location server-side
 * regardless of what's sent, and a tenant_admin only needs to supply them
 * when the tenant has more than one active business/location (auto-resolved
 * otherwise). Whether `customerName`/`customerPhone` are actually required
 * depends on the business's `OrderSettings` (`customerNameRequired`/
 * `customerPhoneRequired` — see `modules/settings`); prices are never sent
 * from the client — they're always snapshotted server-side from the
 * current product.
 */
export interface OrderCreateRequest {
  businessId?: string;
  locationId?: string;
  orderType?: OrderType;
  /** A floor-plan table (`modules/tables`) — when given, the backend derives business/location/table_number from it, overriding those fields above. */
  tableId?: string;
  tableNumber?: string;
  note?: string;
  idempotencyKey?: string;
  items?: OrderLineRequest[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerGstin?: string;
  customerState?: string;
}

/**
 * `POST /tenant/orders/{id}/items/` body — sets this product's line to
 * `quantity` (adding the line if it doesn't exist yet); this is the line's
 * new absolute quantity, not an increment. Only accepted while the order
 * is still `pending`.
 */
export interface OrderItemRequest {
  productId: string;
  quantity: string;
}

/** A kitchen line — quantity + name only, never a price (`KDSItemOutputSerializer`). */
export interface KdsItem {
  name: string;
  quantity: string;
}

/**
 * `KDSOrderOutputSerializer`'s shape — the Kitchen Display card.
 * Deliberately price-free and customer-free: only what's needed to cook
 * and time the order. `elapsedMinutes`/`isLate` are computed server-side
 * on every read (from `kotFiredAt ?? createdAt`, 15-minute threshold) —
 * never cached client-side across polls.
 */
export interface KdsOrder {
  id: string;
  status: OrderStatus;
  orderType: OrderType;
  tableNumber: string;
  tokenNumber: number | null;
  items: KdsItem[];
  elapsedMinutes: number;
  isLate: boolean;
  createdAt: string;
}
