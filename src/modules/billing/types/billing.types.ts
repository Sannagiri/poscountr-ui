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

/** Mirrors `PaymentMethod.choices` (apps/billing/constants.py) — set only at completion. */
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'other';

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
  /** This line's own discount (0-100), set when the line was added — `'0.00'` when none. Already netted into `lineTotal`. */
  discountPercent: string;
  lineTotal: string;
  /** Live from `Product.unit` — not snapshotted, formatting-only (e.g. `'pcs'`, `'kg'`). */
  unit: string;
  /** Live from `Product.hsn_code` — not snapshotted; `''` when the product has none set. */
  hsnCode: string;
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
  /** Set only at completion (see `billingService.complete`) — blank for an open or cancelled order. */
  paymentMethod: PaymentMethod | '';
  /** Whole-order discount (0-100), set at creation — layered on top of each line's own `discountPercent`. `'0.00'` when none. */
  discountPercent: string;
  /** Derived money value of `discountPercent` alone (per-line discounts are already netted into each line's `lineTotal`, never surfaced as a separate amount here). */
  discountAmount: string;
  /** Free-hand per-order choice, set at creation — `false` means every line's `gstRate` is treated as 0 for this order (`taxTotal` is `'0.00'`, `subtotal` == `total`), regardless of the products' own catalog GST rate. Editable up to the same point items are (before prep starts); locked once completed. */
  applyGst: boolean;
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
  /** Proof of transport (e-way bill) — a PDF or a phone photo of the physical copy, optional. `null` until uploaded. Unrelated to the kitchen/order-status flow above; shared with the purchasing module's own `PurchaseOrder.wayBillUrl` (same endpoint shape, same `WayBillUpload` control). */
  wayBillUrl: string | null;
  wayBillUploadedAt: string | null;
  kotFiredAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** One line when opening an order — `quantity` is that line's quantity, not a delta. `discountPercent` (0-100, optional) is this line's own discount. */
export interface OrderLineRequest {
  productId: string;
  quantity: string;
  discountPercent?: string;
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
  /** Whole-order discount (0-100, optional) — layered on top of each line's own discount. */
  discountPercent?: string;
  /** Free-hand per-order choice (default `true`) — `false` charges no GST on this order regardless of the products' own GST rate. */
  applyGst?: boolean;
}

/**
 * `POST /tenant/orders/offline-sync/` body — sync one register-offline cash
 * sale: create + items + complete in one atomic, idempotent call. Unlike
 * `OrderCreateRequest`, `idempotencyKey`/`items`/`paymentMethod` are all
 * required (there's no PENDING window to add them later), and `tableId`
 * isn't supported — offline sales skip the floor-plan/kitchen flow
 * entirely (see `apps/billing/services/order_service.py`'s
 * `create_offline_sale`).
 */
export interface OfflineOrderSyncRequest {
  businessId?: string;
  locationId?: string;
  orderType?: OrderType;
  tableNumber?: string;
  note?: string;
  /** The client's local order id — the only thing that makes a retried sync call safe. */
  idempotencyKey: string;
  items: OrderLineRequest[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerGstin?: string;
  customerState?: string;
  discountPercent?: string;
  applyGst?: boolean;
  paymentMethod: PaymentMethod;
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
  /** This line's own discount (0-100, optional) — defaults to 0 server-side. */
  discountPercent?: string;
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
