import type { CompareReportsDashboardFilters } from '../types/compareReports.types';
import type { PurchaseReportsDashboardFilters } from '../types/purchaseReports.types';
import type { InvoiceListFilters, ReportsDashboardFilters } from '../types/reports.types';

/** Route paths owned by the reports module — Sales/Purchase/GST/Compare summary are each their own page (see `layouts/AppShell/navConfig.tsx`'s "Reports" group), not tabs on one shared page. */
export const REPORTS_ROUTES = {
  sales: '/reports/sales',
  purchases: '/reports/purchases',
  gst: '/reports/gst',
  compare: '/reports/compare',
} as const;

/** TanStack Query cache keys for this module. */
export const REPORTS_QUERY_KEYS = {
  invoices: (filters: InvoiceListFilters = {}) => ['reports', 'invoices', filters] as const,
  /** Keyed by the full filter set (incl. `from`/`to`) — a different date range is a genuinely different server response, same rationale as `BILLING_QUERY_KEYS.orders`. */
  dashboard: (filters: ReportsDashboardFilters) => ['reports', 'dashboard', filters] as const,
  purchaseDashboard: (filters: PurchaseReportsDashboardFilters) =>
    ['reports', 'purchaseDashboard', filters] as const,
  compareDashboard: (filters: CompareReportsDashboardFilters) =>
    ['reports', 'compareDashboard', filters] as const,
};
