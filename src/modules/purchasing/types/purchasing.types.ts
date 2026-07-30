/**
 * Types mirror the real Django serializers in `apps/purchasing/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). Retail/pharmacy/grocery only — a
 * restaurant/cafe business never has suppliers or purchase orders (stays
 * sell-only).
 *
 * Decimal fields (`purchasePrice`, `quantity`, `subtotal`, …) stay `string`
 * end-to-end — same convention `billing.types.ts`/`inventory.types.ts`
 * already established — since DRF's `DecimalField` serializes as a string
 * to avoid float precision loss.
 */

import type { IndianState } from '@/modules/businesses';

/** A buy-side vendor a business orders stock from. */
export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  state: IndianState | '';
  /** Structured address — mirrors `Location`'s shape (free-text line1/line2, plus their own city/pincode fields). */
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
  isActive: boolean;
  createdAt: string;
}

/** `Supplier` minus server-assigned fields — POST full, PATCH partial. `businessId` only matters on create (a manager's is forced server-side regardless of what's sent). */
export interface SupplierRequest {
  businessId?: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  state?: IndianState | '';
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  pincode?: string;
  isActive?: boolean;
}

export type PurchaseOrderStatus = 'pending' | 'completed' | 'cancelled';

/** Set only at completion (see `purchasingService.complete`) — `''` for an open or cancelled purchase order. */
export type PurchasePaymentStatus = '' | 'paid' | 'partial' | 'credit';

/**
 * One line on a purchase order. Unlike a sales `OrderItem`, the same
 * product can appear on more than one line — one per batch, since a single
 * delivery commonly contains several batches of the same product with
 * different expiry dates — so a line is identified (and removed) by its own
 * `id`, never grouped/keyed by `productId`.
 *
 * `purchasePrice` is tax-exclusive — unlike a sales `Order`'s `unitPrice`
 * (already tax-inclusive, MRP-style), GST (`gstRate`) is computed and added
 * on top when the order's `taxTotal` is derived. `lineTotal` is this line's
 * taxable value only (`purchasePrice × quantity × (1 − discountPercent/100)`),
 * not a tax-inclusive total.
 */
export interface PurchaseOrderItem {
  id: string;
  productId: string;
  name: string;
  purchasePrice: string;
  gstRate: string;
  quantity: string;
  discountPercent: string;
  lineTotal: string;
  batchNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  mrp: string | null;
}

/**
 * One line on `POST /tenant/purchase-orders/` (initial lines) or
 * `POST .../items/` (add one line — always a new line, never upserted by
 * `productId`, since one product can span several lines/batches). Batch
 * fields (`batchNumber`/`mfgDate`/`expiryDate`/`mrp`) are required by the
 * backend only when the selected product is batch-tracked
 * (`Product.isBatchTracked`) — same gate `ProductFormModal` already uses for
 * a pharmacy-style product's fields.
 */
export interface PurchaseOrderLineRequest {
  productId: string;
  quantity: string;
  purchasePrice: string;
  discountPercent?: string;
  batchNumber?: string;
  mfgDate?: string;
  expiryDate?: string;
  mrp?: string;
}

/**
 * One recorded payment towards a completed purchase order — an advance
 * today, the balance next week, however many installments it takes.
 * `PurchaseOrder.amountPaid` is the sum of every one of these, never a
 * single value someone can silently overwrite — `recordedByName` keeps the
 * "who" alongside the "how much" and "when".
 */
export interface PurchaseOrderPayment {
  id: string;
  amount: string;
  paidOn: string;
  recordedByName: string;
  note: string;
  createdAt: string;
}

/**
 * Full purchase order detail. `subtotal` sums every line's `lineTotal`
 * (already net of each line's own discount); `taxTotal` is GST computed on
 * top of `subtotal`; `total = subtotal + taxTotal` — the reverse of a sales
 * `Order`, whose `unitPrice` is already tax-inclusive.
 */
export interface PurchaseOrder {
  id: string;
  businessId: string;
  locationId: string;
  locationName: string;
  status: PurchaseOrderStatus;
  /** Per-business gap-less purchase-order number; `null` for an order created before this field existed. */
  purchaseNumber: string | null;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierGstin: string;
  supplierState: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  /** True -> IGST; False -> CGST + SGST split. Mirrors the backend's own business-state-vs-supplier-state comparison — the business is the one claiming input credit here, the reverse direction of a sales `Order`/`Invoice`. */
  isInterstate: boolean;
  /** `cgstAmount + sgstAmount + igstAmount` always equals `taxTotal` — only the interstate/intrastate pair that applies is ever non-zero. */
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  /** The business's own GST-registered state (2-letter code), read-only — drives `isInterstate` server-side. */
  businessState: string;
  paymentStatus: PurchasePaymentStatus;
  /**
   * Optional override of the computed `total` — set at completion only when
   * the supplier's final bill came in different from what the lines add up
   * to. `null` when not set, in which case `total` is the figure that
   * actually matters.
   */
  actualTotal: string | null;
  /** Always the sum of `payments` below — never set directly. */
  amountPaid: string | null;
  /** True once amountPaid has reached what's owed (actualTotal if set, else total) — no more payments can be recorded past that point. Always false before completion. */
  isPaymentLocked: boolean;
  /** The full payment history for this order — empty until the first payment (at completion or later). */
  payments: PurchaseOrderPayment[];
  dueDate: string | null;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string | null;
  /** Proof of transport (e-way bill) — a PDF or a phone photo of the physical copy, optional. `null` until uploaded. */
  wayBillUrl: string | null;
  wayBillUploadedAt: string | null;
  /** The formal PO document — client-rendered (A4, logo top-right, GST breakdown) and pushed back here for storage, same pattern as `Invoice.pdfUrl`. `''` until uploaded. */
  pdfUrl: string;
  pdfUploadedAt: string | null;
  note: string;
  items: PurchaseOrderItem[];
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** `POST /tenant/purchase-orders/` body — optionally with initial lines. */
export interface PurchaseOrderCreateRequest {
  businessId?: string;
  locationId?: string;
  supplierId: string;
  note?: string;
  idempotencyKey?: string;
  items?: PurchaseOrderLineRequest[];
}

/**
 * `POST /tenant/purchase-orders/{id}/complete/` body. `actualTotal` is
 * optional — when omitted, the backend just uses its own computed `total`;
 * the UI frames this as "actual bill amount, if different from computed
 * total" rather than a required field.
 */
export interface PurchaseOrderCompleteRequest {
  paymentStatus: Exclude<PurchasePaymentStatus, ''>;
  actualTotal?: string;
  amountPaid?: string;
  dueDate?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
}

/**
 * `PATCH /tenant/purchase-orders/{id}/payment/` body — every field optional
 * (partial update). Corrects payment *terms* on an already-completed
 * purchase order — status/actual bill/due date/supplier invoice reference.
 * `amountPaid` isn't here — record an actual payment via
 * `PurchaseOrderPaymentCreateRequest` instead, which keeps an auditable
 * history rather than letting one number be overwritten. Rejected
 * server-side once `isPaymentLocked` is true.
 */
export interface PurchaseOrderPaymentUpdateRequest {
  paymentStatus?: Exclude<PurchasePaymentStatus, ''>;
  actualTotal?: string;
  dueDate?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
}

/**
 * `POST /tenant/purchase-orders/{id}/payments/` body — records one payment
 * (an advance, an installment, the final balance) against an already-
 * completed purchase order. Rejected server-side once `isPaymentLocked` is
 * true.
 */
export interface PurchaseOrderPaymentCreateRequest {
  amount: string;
  paidOn?: string;
  note?: string;
}
