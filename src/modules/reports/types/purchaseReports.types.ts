/**
 * `GET /tenant/reports/purchases/summary` — the Purchase-summary dashboard's
 * data source. Mirrors `apps/reports/serializers/purchase_output.py`. Every
 * section is a pre-aggregated rollup (not a live model), computed
 * server-side, same convention as `reports.types.ts`'s sales dashboard.
 *
 * Decimal fields stay `string` end-to-end (DRF's `DecimalField` serializes
 * as a string to avoid float precision loss) — same convention as
 * `reports.types.ts`.
 */

export interface PurchaseReportsKpi {
  totalPurchaseValue: string;
  taxTotal: string;
  poCount: number;
  averagePoValue: string;
  unitsPurchased: string;
  /** Scoped to the selected date range (POs raised in range), not an all-time balance — see `KpiTile`'s caption on this tile. */
  outstandingDues: string;
  cancelledCount: number;
  cancelledValue: string;
}

export interface PurchaseDailyTrendPoint {
  /** `YYYY-MM-DD`, IST calendar day of `PurchaseOrder.created_at` (no `token_date`-equivalent field exists on PurchaseOrder). */
  date: string;
  spend: string;
  poCount: number;
  units: string;
}

export interface TopSupplierRow {
  supplierId: string;
  name: string;
  poCount: number;
  spend: string;
}

export interface TopProductPurchasedRow {
  productId: string;
  name: string;
  category: string;
  quantityPurchased: string;
  spend: string;
}

export interface PurchaseLocationPerformanceRow {
  /** No denormalized name — join against `useLocations()` for display. */
  locationId: string;
  spend: string;
  poCount: number;
  averagePoValue: string;
  share: string;
}

export interface PaymentStatusMixRow {
  paymentStatus: 'paid' | 'partial' | 'credit';
  amount: string;
  poCount: number;
  /** Percentage of total payment-status-mix amount, `'0.00'`-`'100.00'`. */
  share: string;
}

export interface PurchaseReportsDashboardSummary {
  range: { dateFrom: string; dateTo: string };
  /** Always daily buckets — the chart re-buckets to weekly/monthly client-side for wide ranges, same as the sales dashboard. */
  dailyTrend: PurchaseDailyTrendPoint[];
  kpi: PurchaseReportsKpi;
  topSuppliers: TopSupplierRow[];
  topProductsPurchased: TopProductPurchasedRow[];
  /** Empty for a single-location tenant — only rendered for a tenant_admin with more than one location. */
  locationPerformance: PurchaseLocationPerformanceRow[];
  paymentStatusMix: PaymentStatusMixRow[];
}

/** `GET /tenant/reports/purchases/summary` query params — `from`/`to` are required (YYYY-MM-DD). */
export interface PurchaseReportsDashboardFilters {
  from: string;
  to: string;
  businessId?: string;
  locationId?: string;
}
