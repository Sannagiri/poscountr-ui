import { REPORTS_QUERY_KEYS } from '../constants/reports.constants';
import { reportsService } from '../services/reportsService';
import type { ReportsDashboardFilters } from '../types/reports.types';

import { useQuery } from '@tanstack/react-query';

/** The Sales-summary dashboard's data source — `from`/`to` are required, so the query stays disabled until both are set (guards the brief window before `SalesReportsPage` derives its initial date range). */
export function useReportsDashboard(filters: ReportsDashboardFilters) {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.dashboard(filters),
    queryFn: () => reportsService.getDashboardSummary(filters),
    enabled: Boolean(filters.from && filters.to),
  });
}
