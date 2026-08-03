import { apiClient, unwrap } from '@/services/apiClient';

import type {
  PaymentStatusMixRow,
  PurchaseDailyTrendPoint,
  PurchaseLocationPerformanceRow,
  PurchaseReportsDashboardFilters,
  PurchaseReportsDashboardSummary,
  PurchaseReportsKpi,
  TopProductPurchasedRow,
  TopSupplierRow,
} from '../types/purchaseReports.types';

/**
 * All calls to `/tenant/reports/purchases/` live here — components and
 * hooks never call `apiClient` directly (docs/coding-standards.md §14).
 * Request/response bodies are translated between the backend's snake_case
 * field names and this module's camelCase types, same pattern as
 * `reportsService.ts`.
 */

interface PurchaseReportsKpiRaw {
  total_purchase_value: string;
  tax_total: string;
  po_count: number;
  average_po_value: string;
  units_purchased: string;
  outstanding_dues: string;
  cancelled_count: number;
  cancelled_value: string;
}

interface PurchaseDailyTrendPointRaw {
  date: string;
  spend: string;
  po_count: number;
  units: string;
}

interface TopSupplierRowRaw {
  supplier_id: string;
  name: string;
  po_count: number;
  spend: string;
}

interface TopProductPurchasedRowRaw {
  product_id: string;
  name: string;
  category: string;
  quantity_purchased: string;
  spend: string;
}

interface PurchaseLocationPerformanceRowRaw {
  location_id: string;
  spend: string;
  po_count: number;
  average_po_value: string;
  share: string;
}

interface PaymentStatusMixRowRaw {
  payment_status: string;
  amount: string;
  po_count: number;
  share: string;
}

interface PurchaseReportsDashboardSummaryRaw {
  range: { date_from: string; date_to: string };
  kpi: PurchaseReportsKpiRaw;
  daily_trend: PurchaseDailyTrendPointRaw[];
  top_suppliers: TopSupplierRowRaw[];
  top_products_purchased: TopProductPurchasedRowRaw[];
  location_performance: PurchaseLocationPerformanceRowRaw[];
  payment_status_mix: PaymentStatusMixRowRaw[];
}

function mapKpi(raw: PurchaseReportsKpiRaw): PurchaseReportsKpi {
  return {
    totalPurchaseValue: raw.total_purchase_value,
    taxTotal: raw.tax_total,
    poCount: raw.po_count,
    averagePoValue: raw.average_po_value,
    unitsPurchased: raw.units_purchased,
    outstandingDues: raw.outstanding_dues,
    cancelledCount: raw.cancelled_count,
    cancelledValue: raw.cancelled_value,
  };
}

function mapDailyTrendPoint(raw: PurchaseDailyTrendPointRaw): PurchaseDailyTrendPoint {
  return { date: raw.date, spend: raw.spend, poCount: raw.po_count, units: raw.units };
}

function mapTopSupplierRow(raw: TopSupplierRowRaw): TopSupplierRow {
  return { supplierId: raw.supplier_id, name: raw.name, poCount: raw.po_count, spend: raw.spend };
}

function mapTopProductPurchasedRow(raw: TopProductPurchasedRowRaw): TopProductPurchasedRow {
  return {
    productId: raw.product_id,
    name: raw.name,
    category: raw.category,
    quantityPurchased: raw.quantity_purchased,
    spend: raw.spend,
  };
}

function mapLocationPerformanceRow(
  raw: PurchaseLocationPerformanceRowRaw,
): PurchaseLocationPerformanceRow {
  return {
    locationId: raw.location_id,
    spend: raw.spend,
    poCount: raw.po_count,
    averagePoValue: raw.average_po_value,
    share: raw.share,
  };
}

function mapPaymentStatusMixRow(raw: PaymentStatusMixRowRaw): PaymentStatusMixRow {
  return {
    paymentStatus: raw.payment_status as PaymentStatusMixRow['paymentStatus'],
    amount: raw.amount,
    poCount: raw.po_count,
    share: raw.share,
  };
}

function mapDashboardSummary(
  raw: PurchaseReportsDashboardSummaryRaw,
): PurchaseReportsDashboardSummary {
  return {
    range: { dateFrom: raw.range.date_from, dateTo: raw.range.date_to },
    kpi: mapKpi(raw.kpi),
    dailyTrend: raw.daily_trend.map(mapDailyTrendPoint),
    topSuppliers: raw.top_suppliers.map(mapTopSupplierRow),
    topProductsPurchased: raw.top_products_purchased.map(mapTopProductPurchasedRow),
    locationPerformance: raw.location_performance.map(mapLocationPerformanceRow),
    paymentStatusMix: raw.payment_status_mix.map(mapPaymentStatusMixRow),
  };
}

export const purchaseReportsService = {
  /** The Purchase-summary dashboard's data source — pre-aggregated server-side (see `apps/reports/selectors/purchase_dashboard.py`). `from`/`to` are required. */
  async getDashboardSummary(
    filters: PurchaseReportsDashboardFilters,
  ): Promise<PurchaseReportsDashboardSummary> {
    const raw = await unwrap<PurchaseReportsDashboardSummaryRaw>(
      apiClient.get('/tenant/reports/purchases/summary/', {
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
