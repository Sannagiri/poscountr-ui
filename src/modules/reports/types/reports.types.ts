// Concrete-file import, not the `@/modules/billing` barrel — that barrel's
// `billingService.ts` imports from this module's `reportsService.ts`
// (avoiding an invoice mapping cycle), so importing the barrel back here
// would create a billing <-> reports cycle at module-init time. Same
// rationale as the note in `billingService.ts`.
import type { OrderType, PaymentMethod } from '@/modules/billing/types/billing.types';

/**
 * Types mirror the real Django serializers in `apps/invoicing/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See `apps/invoicing/serializers/
 * output.py` (`InvoiceOutputSerializer`, `InvoiceHsnLineOutputSerializer`),
 * `apps/invoicing/models/invoice.py`.
 *
 * Decimal fields stay `string` end-to-end, same convention
 * `billing.types.ts`/`inventory.types.ts` already established — DRF's
 * `DecimalField` serializes as a string to avoid float precision loss.
 * Reports pages that need to sum/average these convert with `Number(...)`
 * at the point of aggregation, never earlier.
 */

/** One HSN-wise summary row (grouped from an invoice's order items, computed on read — never persisted). */
export interface InvoiceHsnLine {
  /** May be `''` — not every product has an HSN code set yet. */
  hsnCode: string;
  gstRate: string;
  taxableValue: string;
  taxAmount: string;
}

/**
 * A GST invoice generated from one completed order — money/tax-split/
 * customer fields are snapshotted at generation time (see the backend's
 * own doc comment on `Invoice`), never re-derived from the live order.
 */
export interface Invoice {
  id: string;
  orderId: string;
  businessId: string;
  locationId: string;
  /** Denormalized from the business/location the invoice was generated for — lets the client-rendered bill PDF (`thermalBillPdf.ts`) skip a separate business/location fetch, which matters since those list endpoints are tenant_admin-only while invoice reads are tenant_admin-or-manager. */
  businessName: string;
  businessGstin: string | null;
  locationName: string;
  locationAddressLine1: string;
  locationAddressLine2: string;
  locationCity: string;
  locationPincode: string;
  invoiceNumber: string;
  /** e.g. `'2026-27'`. */
  financialYear: string;
  sequenceNumber: number;
  issuedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  customerState: string;
  businessState: string;
  /** `true` -> IGST; `false` -> CGST + SGST. */
  isInterstate: boolean;
  /** Flat discount applied at completion (optional) — already netted into `taxableValue`/`total` below, not an amount to subtract again. */
  discountAmount: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOff: string;
  total: string;
  /** `''` until the frontend-rendered PDF has been uploaded. */
  pdfUrl: string;
  pdfUploadedAt: string | null;
  /** Which `LayoutTemplate` this invoice is permanently pinned to (set from the Bill Preview modal's Layout dropdown) — `null` means "follow the business's current default", same as before this field existed. */
  layoutTemplateId: string | null;
  hsnSummary: InvoiceHsnLine[];
}

/** `GET /tenant/invoices/` query params — all optional narrowing filters. */
export interface InvoiceListFilters {
  businessId?: string;
  locationId?: string;
  financialYear?: string;
}

/**
 * `GET /tenant/reports/summary` — the Sales-summary dashboard's data source.
 * Mirrors `apps/reports/serializers/output.py`. Every section but
 * `representativeTransactions` is a pre-aggregated rollup (not a live
 * model), computed server-side so the live dashboard and any future export
 * always agree on the same numbers.
 */
export interface ReportsDashboardKpi {
  grossSales: string;
  /** Sum of `discountAmount` on completed orders in range. */
  discountTotal: string;
  /** `grossSales - discountTotal`. */
  netSales: string;
  transactionCount: number;
  /** `netSales / transactionCount` — the actual average ticket size, not the pre-discount figure. */
  averageOrderValue: string;
  unitsSold: string;
  /** "Lost revenue" proxy — POSCountr has no refund/return model, cancelled orders are the nearest analog. */
  cancelledCount: number;
  cancelledValue: string;
}

export interface DailyTrendPoint {
  /** `YYYY-MM-DD`, mirrors `Order.tokenDate`. */
  date: string;
  revenue: string;
  orders: number;
  units: string;
}

export interface CategoryMixRow {
  /** `'Uncategorized'` when the product has no category set. */
  category: string;
  revenue: string;
  units: string;
  /** Percentage of total category-mix revenue, `'0.00'`–`'100.00'`. */
  share: string;
}

export interface PaymentMixRow {
  paymentMethod: PaymentMethod;
  revenue: string;
  orderCount: number;
  share: string;
}

export interface TopProductRow {
  productId: string;
  name: string;
  category: string;
  unitsSold: string;
  revenue: string;
}

export interface StorePerformanceRow {
  /** No denormalized name — join against `useLocations()` for display. */
  locationId: string;
  revenue: string;
  orderCount: number;
  averageOrderValue: string;
  share: string;
}

/** One recent completed order — one row per order (a POSCountr cart can hold several items), not per line item. */
export interface RepresentativeTransaction {
  id: string;
  orderNumber: string | null;
  tokenDate: string | null;
  completedAt: string | null;
  locationId: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod | '';
  discountAmount: string;
  itemCount: number;
  total: string;
}

export interface ReportsDashboardSummary {
  range: { dateFrom: string; dateTo: string };
  kpi: ReportsDashboardKpi;
  /** Always daily buckets — the chart re-buckets to weekly/monthly client-side for wide ranges. */
  dailyTrend: DailyTrendPoint[];
  categoryMix: CategoryMixRow[];
  paymentMix: PaymentMixRow[];
  /** Top 10 by revenue. */
  topProducts: TopProductRow[];
  /** Empty for a single-location tenant — the page only renders this section for a tenant_admin with more than one location. */
  storePerformance: StorePerformanceRow[];
  /** Most recent 25 completed orders in range — a real recent slice, not a statistical sample. */
  representativeTransactions: RepresentativeTransaction[];
}

/** `GET /tenant/reports/summary` query params — `from`/`to` are required (YYYY-MM-DD). */
export interface ReportsDashboardFilters {
  from: string;
  to: string;
  businessId?: string;
  locationId?: string;
}
