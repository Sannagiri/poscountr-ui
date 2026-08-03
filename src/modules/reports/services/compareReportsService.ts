import { apiClient, unwrap } from '@/services/apiClient';

import type {
  CompareDailyTrendPoint,
  CompareLocationPerformanceRow,
  CompareReportsDashboardFilters,
  CompareReportsDashboardSummary,
  CompareReportsKpi,
} from '../types/compareReports.types';

/**
 * All calls to `/tenant/reports/compare/` live here — components and hooks
 * never call `apiClient` directly (docs/coding-standards.md §14).
 * Request/response bodies are translated between the backend's snake_case
 * field names and this module's camelCase types, same pattern as
 * `purchaseReportsService.ts`.
 */

interface CompareReportsKpiRaw {
  net_sales: string;
  total_purchase_value: string;
  gross_margin: string;
  margin_percent: string;
  transaction_count: number;
  po_count: number;
}

interface CompareDailyTrendPointRaw {
  date: string;
  sales: string;
  purchases: string;
}

interface CompareLocationPerformanceRowRaw {
  location_id: string;
  sales: string;
  purchases: string;
  margin: string;
}

interface CompareReportsDashboardSummaryRaw {
  range: { date_from: string; date_to: string };
  kpi: CompareReportsKpiRaw;
  daily_trend: CompareDailyTrendPointRaw[];
  location_performance: CompareLocationPerformanceRowRaw[];
}

function mapKpi(raw: CompareReportsKpiRaw): CompareReportsKpi {
  return {
    netSales: raw.net_sales,
    totalPurchaseValue: raw.total_purchase_value,
    grossMargin: raw.gross_margin,
    marginPercent: raw.margin_percent,
    transactionCount: raw.transaction_count,
    poCount: raw.po_count,
  };
}

function mapDailyTrendPoint(raw: CompareDailyTrendPointRaw): CompareDailyTrendPoint {
  return { date: raw.date, sales: raw.sales, purchases: raw.purchases };
}

function mapLocationPerformanceRow(
  raw: CompareLocationPerformanceRowRaw,
): CompareLocationPerformanceRow {
  return {
    locationId: raw.location_id,
    sales: raw.sales,
    purchases: raw.purchases,
    margin: raw.margin,
  };
}

function mapDashboardSummary(
  raw: CompareReportsDashboardSummaryRaw,
): CompareReportsDashboardSummary {
  return {
    range: { dateFrom: raw.range.date_from, dateTo: raw.range.date_to },
    kpi: mapKpi(raw.kpi),
    dailyTrend: raw.daily_trend.map(mapDailyTrendPoint),
    locationPerformance: raw.location_performance.map(mapLocationPerformanceRow),
  };
}

export const compareReportsService = {
  /** The Compare-reports dashboard's data source — pre-aggregated server-side (see `apps/reports/services/compare_dashboard_service.py`). `from`/`to` are required. */
  async getDashboardSummary(
    filters: CompareReportsDashboardFilters,
  ): Promise<CompareReportsDashboardSummary> {
    const raw = await unwrap<CompareReportsDashboardSummaryRaw>(
      apiClient.get('/tenant/reports/compare/summary/', {
        params: {
          from: filters.from,
          to: filters.to,
          business_id: filters.businessId,
          location_id: filters.locationId,
        },
      }),
    );
    return mapDashboardSummary(raw);
  },
};
