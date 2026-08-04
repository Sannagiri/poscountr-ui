/**
 * Types mirror the real Django serializers in `apps/quotations/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). A sell-side pre-order approval step for
 * retail/pharmacy/grocery/other businesses (`isQuotationEligibleEntityType`,
 * `@/modules/businesses`) — never restaurant/cafe, which stay sell-direct
 * with no quote-then-accept step.
 *
 * Decimal fields (`unitPrice`, `quantity`, `subtotal`, …) stay `string`
 * end-to-end — same convention `billing.types.ts`/`purchasing.types.ts`
 * already establish, since DRF's `DecimalField` serializes as a string to
 * avoid float precision loss.
 */

import type { OrderType } from '@/modules/billing';

/**
 * Mirrors `QuotationStatus.choices` (apps/quotations/constants.py).
 * `pending` -> `accepted` (auto-creates a real `billing.Order` with the
 * exact quoted prices frozen in) or `declined`, or lazily `expired` once
 * `validUntil` has passed (no cron — the backend flips it the next time the
 * quotation is read/acted on).
 */
export type QuotationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/** `product` = catalog-backed line; `adhoc` = a typed-in one-time/external
 * line with no `Product` behind it (`productId`/`unit` are `null`). */
export type LineType = 'product' | 'adhoc';

/** One line on a quotation — same shape as a sales `OrderItem`, just quoted rather than billed yet. */
export interface QuotationItem {
  id: string;
  productId: string | null;
  lineType: LineType;
  name: string;
  unitPrice: string;
  gstRate: string;
  quantity: string;
  discountPercent: string;
  lineTotal: string;
  /** Live from `Product.unit` — not snapshotted, formatting-only (e.g. `'pcs'`, `'kg'`). `null` for an ad-hoc line. */
  unit: string | null;
}

/**
 * One line on `POST /tenant/quotations/{id}/items/` — for a catalog line
 * upserts by `productId`, same convention `OrderItemRequest` follows.
 *
 * Either `productId` (a catalog line) or `name` + `unitPrice` (an ad-hoc/
 * external one-time line, no catalog entry) must be set — never both, never
 * neither. `gstRate` only applies to (and is only sent for) an ad-hoc line.
 */
export interface QuotationLineRequest {
  productId?: string;
  name?: string;
  unitPrice?: string;
  gstRate?: string;
  quantity: string;
  discountPercent?: string;
}

/**
 * Full quotation detail — `QuotationOutputSerializer`'s shape. Unlike an
 * `Order`, `customerName`/`customerPhone` are always required (no settings
 * toggle — a quotation has to reach someone to be accepted/declined), and
 * `validUntil`/`orderId` only mean anything once the quotation has moved
 * past `pending`.
 */
export interface Quotation {
  id: string;
  businessId: string;
  locationId: string;
  locationName: string;
  status: QuotationStatus;
  /** Per-business gap-less quotation number; `null` for a quotation created before this field existed. */
  quotationNumber: string | null;
  orderType: OrderType;
  /** Whole-quotation discount (0-100), layered on top of each line's own `discountPercent` — same shape `Order.discountPercent` follows. */
  discountPercent: string;
  discountAmount: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  customerState: string;
  /** Plain `YYYY-MM-DD` date this quotation lazily expires on, past which it reads as `expired` even before anyone acts on it — driven by the business's own `QuotationSettings.expirationDays`. `null` when that business has expiry turned off (`expirationDays === 0`). */
  validUntil: string | null;
  /** Set only when declined with a reason — `''` otherwise. */
  declineReason: string;
  /** The real `billing.Order` created on accept, with the exact quoted prices frozen in (never re-priced from today's catalog) — `null` until accepted. */
  orderId: string | null;
  /** The formal quotation document — client-rendered (A4) and pushed back here for storage, same pattern as `PurchaseOrder.pdfUrl`. `''` until uploaded. */
  pdfUrl: string;
  pdfUploadedAt: string | null;
  note: string;
  items: QuotationItem[];
  acceptedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
}

/** `POST /tenant/quotations/` body — optionally with initial lines. Unlike `OrderCreateRequest`, `customerName`/`customerPhone` are always required — there's no per-business settings toggle for a quotation the way there is for a walk-in order. */
export interface QuotationCreateRequest {
  businessId?: string;
  locationId?: string;
  orderType?: OrderType;
  note?: string;
  idempotencyKey?: string;
  items?: QuotationLineRequest[];
  discountPercent?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerGstin?: string;
  customerState?: string;
}
