import type { InvoiceListFilters } from '../types/reports.types';

/** Route paths owned by the reports module — imported by the router, never hardcoded at call sites. */
export const REPORTS_ROUTES = {
  reports: '/reports',
} as const;

/** TanStack Query cache keys for this module. */
export const REPORTS_QUERY_KEYS = {
  invoices: (filters: InvoiceListFilters = {}) => ['reports', 'invoices', filters] as const,
};
