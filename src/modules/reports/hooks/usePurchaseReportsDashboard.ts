import { REPORTS_QUERY_KEYS } from '../constants/reports.constants';
import { purchaseReportsService } from '../services/purchaseReportsService';
import type { PurchaseReportsDashboardFilters } from '../types/purchaseReports.types';

import { useQuery } from '@tanstack/react-query';

/** The Purchase-summary dashboard's data source — `from`/`to` are required, so the query stays disabled until both are set, same guard as `useReportsDashboard`. */
export function usePurchaseReportsDashboard(filters: PurchaseReportsDashboardFilters) {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.purchaseDashboard(filters),
    queryFn: () => purchaseReportsService.getDashboardSummary(filters),
    enabled: Boolean(filters.from && filters.to),
  });
}
