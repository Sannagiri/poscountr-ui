import { apiClient, unwrap } from '@/services/apiClient';

import type {
  CategoryMixRow,
  DailyTrendPoint,
  Invoice,
  InvoiceHsnLine,
  InvoiceListFilters,
  PaymentMixRow,
  ReportsDashboardFilters,
  ReportsDashboardKpi,
  ReportsDashboardSummary,
  RepresentativeTransaction,
  StorePerformanceRow,
  TopProductRow,
} from '../types/reports.types';

/**
 * All calls to `/tenant/invoices/` live here — components and hooks never
 * call `apiClient` directly (docs/coding-standards.md §14). Request/response
 * bodies are translated between the backend's snake_case field names and
 * this module's camelCase types.
 */

interface InvoiceHsnLineRaw {
  hsn_code: string;
  gst_rate: string;
  taxable_value: string;
  tax_amount: string;
}

function mapHsnLine(raw: InvoiceHsnLineRaw): InvoiceHsnLine {
  return {
    hsnCode: raw.hsn_code,
    gstRate: raw.gst_rate,
    taxableValue: raw.taxable_value,
    taxAmount: raw.tax_amount,
  };
}

export interface InvoiceRaw {
  id: string;
  order_id: string;
  business_id: string;
  location_id: string;
  business_name: string;
  business_gstin: string | null;
  location_name: string;
  location_address_line1: string;
  location_address_line2: string;
  location_city: string;
  location_pincode: string;
  invoice_number: string;
  financial_year: string;
  sequence_number: number;
  issued_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  customer_state: string;
  business_state: string;
  is_interstate: boolean;
  discount_amount: string;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  round_off: string;
  total: string;
  pdf_url: string;
  pdf_uploaded_at: string | null;
  hsn_summary: InvoiceHsnLineRaw[];
}

export function mapInvoice(raw: InvoiceRaw): Invoice {
  return {
    id: raw.id,
    orderId: raw.order_id,
    businessId: raw.business_id,
    locationId: raw.location_id,
    businessName: raw.business_name,
    businessGstin: raw.business_gstin,
    locationName: raw.location_name,
    locationAddressLine1: raw.location_address_line1,
    locationAddressLine2: raw.location_address_line2,
    locationCity: raw.location_city,
    locationPincode: raw.location_pincode,
    invoiceNumber: raw.invoice_number,
    financialYear: raw.financial_year,
    sequenceNumber: raw.sequence_number,
    issuedAt: raw.issued_at,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerEmail: raw.customer_email,
    customerGstin: raw.customer_gstin,
    customerState: raw.customer_state,
    businessState: raw.business_state,
    isInterstate: raw.is_interstate,
    discountAmount: raw.discount_amount,
    taxableValue: raw.taxable_value,
    cgstAmount: raw.cgst_amount,
    sgstAmount: raw.sgst_amount,
    igstAmount: raw.igst_amount,
    roundOff: raw.round_off,
    total: raw.total,
    pdfUrl: raw.pdf_url,
    pdfUploadedAt: raw.pdf_uploaded_at,
    hsnSummary: raw.hsn_summary.map(mapHsnLine),
  };
}

interface ReportsKpiRaw {
  gross_sales: string;
  discount_total: string;
  net_sales: string;
  transaction_count: number;
  average_order_value: string;
  units_sold: string;
  cancelled_count: number;
  cancelled_value: string;
}

interface DailyTrendPointRaw {
  date: string;
  revenue: string;
  orders: number;
  units: string;
}

interface CategoryMixRowRaw {
  category: string;
  revenue: string;
  units: string;
  share: string;
}

interface PaymentMixRowRaw {
  payment_method: string;
  revenue: string;
  order_count: number;
  share: string;
}

interface TopProductRowRaw {
  product_id: string;
  name: string;
  category: string;
  units_sold: string;
  revenue: string;
}

interface StorePerformanceRowRaw {
  location_id: string;
  revenue: string;
  order_count: number;
  average_order_value: string;
  share: string;
}

interface RepresentativeTransactionRaw {
  id: string;
  order_number: string | null;
  token_date: string | null;
  completed_at: string | null;
  location_id: string;
  order_type: string;
  payment_method: string;
  discount_amount: string;
  item_count: number;
  total: string;
}

interface ReportsDashboardSummaryRaw {
  range: { date_from: string; date_to: string };
  kpi: ReportsKpiRaw;
  daily_trend: DailyTrendPointRaw[];
  category_mix: CategoryMixRowRaw[];
  payment_mix: PaymentMixRowRaw[];
  top_products: TopProductRowRaw[];
  store_performance: StorePerformanceRowRaw[];
  representative_transactions: RepresentativeTransactionRaw[];
}

function mapKpi(raw: ReportsKpiRaw): ReportsDashboardKpi {
  return {
    grossSales: raw.gross_sales,
    discountTotal: raw.discount_total,
    netSales: raw.net_sales,
    transactionCount: raw.transaction_count,
    averageOrderValue: raw.average_order_value,
    unitsSold: raw.units_sold,
    cancelledCount: raw.cancelled_count,
    cancelledValue: raw.cancelled_value,
  };
}

function mapDailyTrendPoint(raw: DailyTrendPointRaw): DailyTrendPoint {
  return { date: raw.date, revenue: raw.revenue, orders: raw.orders, units: raw.units };
}

function mapCategoryMixRow(raw: CategoryMixRowRaw): CategoryMixRow {
  return { category: raw.category, revenue: raw.revenue, units: raw.units, share: raw.share };
}

function mapPaymentMixRow(raw: PaymentMixRowRaw): PaymentMixRow {
  return {
    paymentMethod: raw.payment_method as PaymentMixRow['paymentMethod'],
    revenue: raw.revenue,
    orderCount: raw.order_count,
    share: raw.share,
  };
}

function mapTopProductRow(raw: TopProductRowRaw): TopProductRow {
  return {
    productId: raw.product_id,
    name: raw.name,
    category: raw.category,
    unitsSold: raw.units_sold,
    revenue: raw.revenue,
  };
}

function mapStorePerformanceRow(raw: StorePerformanceRowRaw): StorePerformanceRow {
  return {
    locationId: raw.location_id,
    revenue: raw.revenue,
    orderCount: raw.order_count,
    averageOrderValue: raw.average_order_value,
    share: raw.share,
  };
}

function mapRepresentativeTransaction(raw: RepresentativeTransactionRaw): RepresentativeTransaction {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    tokenDate: raw.token_date,
    completedAt: raw.completed_at,
    locationId: raw.location_id,
    orderType: raw.order_type as RepresentativeTransaction['orderType'],
    paymentMethod: (raw.payment_method as RepresentativeTransaction['paymentMethod']) || '',
    discountAmount: raw.discount_amount,
    itemCount: raw.item_count,
    total: raw.total,
  };
}

function mapDashboardSummary(raw: ReportsDashboardSummaryRaw): ReportsDashboardSummary {
  return {
    range: { dateFrom: raw.range.date_from, dateTo: raw.range.date_to },
    kpi: mapKpi(raw.kpi),
    dailyTrend: raw.daily_trend.map(mapDailyTrendPoint),
    categoryMix: raw.category_mix.map(mapCategoryMixRow),
    paymentMix: raw.payment_mix.map(mapPaymentMixRow),
    topProducts: raw.top_products.map(mapTopProductRow),
    storePerformance: raw.store_performance.map(mapStorePerformanceRow),
    representativeTransactions: raw.representative_transactions.map(mapRepresentativeTransaction),
  };
}

export const reportsService = {
  /**
   * Every invoice visible to the actor (same tenant_admin/manager scope as
   * billing) — no server-side date filter exists, so the Reports page
   * fetches once and narrows client-side by its own date range, same
   * "fetch once, filter client-side" pattern `OrdersPage` established for
   * orders.
   */
  async listInvoices(filters: InvoiceListFilters = {}): Promise<Invoice[]> {
    const raw = await unwrap<InvoiceRaw[]>(
      apiClient.get('/tenant/invoices/', {
        params: {
          business_id: filters.businessId,
          location_id: filters.locationId,
          financial_year: filters.financialYear,
        },
      }),
    );
    return raw.map(mapInvoice);
  },

  /** The Sales-summary dashboard's data source — pre-aggregated server-side (see `apps/reports/`) so the live page and any future export always agree on the same numbers. `from`/`to` are required. */
  async getDashboardSummary(filters: ReportsDashboardFilters): Promise<ReportsDashboardSummary> {
    const raw = await unwrap<ReportsDashboardSummaryRaw>(
      apiClient.get('/tenant/reports/summary/', {
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
