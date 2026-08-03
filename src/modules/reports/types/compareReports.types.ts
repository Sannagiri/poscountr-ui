/**
 * `GET /tenant/reports/compare/summary` — the Compare-reports dashboard's
 * data source (Sales vs Purchases for a date range, primarily scoped by
 * location — business alone is an overall roll-up across its locations).
 * Mirrors `apps/reports/serializers/compare_output.py`. Every section is a
 * pre-aggregated rollup (not a live model), computed server-side, same
 * convention as `reports.types.ts`/`purchaseReports.types.ts`.
 *
 * Decimal fields stay `string` end-to-end — same convention as the other
 * report types.
 */

export interface CompareReportsKpi {
  netSales: string;
  totalPurchaseValue: string;
  grossMargin: string;
  /** Can be negative or exceed 100 — unlike every other `share`-style field in this module, this isn't a fraction of a fixed total (it's net_sales-relative and net_sales can be small or zero). */
  marginPercent: string;
  transactionCount: number;
  poCount: number;
}

export interface CompareDailyTrendPoint {
  /** `YYYY-MM-DD`. A date with activity on only one side (sales or purchases) still appears here, zero-filled on the other. */
  date: string;
  sales: string;
  purchases: string;
}

export interface CompareLocationPerformanceRow {
  /** No denormalized name — join against `useLocations()` for display. */
  locationId: string;
  sales: string;
  purchases: string;
  margin: string;
}

export interface CompareReportsDashboardSummary {
  range: { dateFrom: string; dateTo: string };
  kpi: CompareReportsKpi;
  dailyTrend: CompareDailyTrendPoint[];
  /** One row per location with sales and/or purchase activity in range — collapses to at most one row when `locationId` is set in the filters. */
  locationPerformance: CompareLocationPerformanceRow[];
}

/** `GET /tenant/reports/compare/summary` query params — `from`/`to` are required (YYYY-MM-DD). */
export interface CompareReportsDashboardFilters {
  from: string;
  to: string;
  businessId?: string;
  locationId?: string;
}
