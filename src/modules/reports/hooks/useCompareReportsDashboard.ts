import { REPORTS_QUERY_KEYS } from '../constants/reports.constants';
import { compareReportsService } from '../services/compareReportsService';
import type { CompareReportsDashboardFilters } from '../types/compareReports.types';

import { useQuery } from '@tanstack/react-query';

/** The Compare-reports dashboard's data source — `from`/`to` are required, so the query stays disabled until both are set, same guard as `useReportsDashboard`/`usePurchaseReportsDashboard`. */
export function useCompareReportsDashboard(filters: CompareReportsDashboardFilters) {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.compareDashboard(filters),
    queryFn: () => compareReportsService.getDashboardSummary(filters),
    enabled: Boolean(filters.from && filters.to),
  });
}
