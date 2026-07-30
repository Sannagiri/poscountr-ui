import type { InvoiceListFilters, ReportsDashboardFilters } from '../types/reports.types';

/** Route paths owned by the reports module — imported by the router, never hardcoded at call sites. */
export const REPORTS_ROUTES = {
  reports: '/reports',
} as const;

/** TanStack Query cache keys for this module. */
export const REPORTS_QUERY_KEYS = {
  invoices: (filters: InvoiceListFilters = {}) => ['reports', 'invoices', filters] as const,
  /** Keyed by the full filter set (incl. `from`/`to`) — a different date range is a genuinely different server response, same rationale as `BILLING_QUERY_KEYS.orders`. */
  dashboard: (filters: ReportsDashboardFilters) => ['reports', 'dashboard', filters] as const,
};
