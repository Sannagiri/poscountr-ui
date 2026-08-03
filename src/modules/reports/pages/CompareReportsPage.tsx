import { PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';

import { CompareKpiStrip, CompareLocationChart, CompareTrendChart } from '../components';
import { ReportsToolbar } from '../components/ReportsToolbar';
import { useCompareReportsDashboard } from '../hooks/useCompareReportsDashboard';
import { useReportsFilters } from '../hooks/useReportsFilters';
import type { CompareReportsDashboardFilters } from '../types/compareReports.types';

/**
 * Compare Reports — Sales vs Purchases for a date range, primarily scoped
 * by *location* (a location `Select` in the toolbar, the first Reports page
 * to have one — every other report only filters by business today).
 * Picking a business alone is an overall roll-up across all its locations;
 * picking a location narrows to just that one. Powered by
 * `GET /tenant/reports/compare/summary` (see
 * `apps/reports/services/compare_dashboard_service.py`), which merges the
 * existing Sales and Purchase dashboards' own selector output rather than
 * running any new queries.
 *
 * Its own sidebar sub-item and its own page (see `layouts/AppShell/
 * navConfig.tsx`'s "Reports" group), same split as Sales/Purchase/GST
 * summary. No period-over-period delta query here — this page's own
 * comparison (sales vs purchases) is the point, not a second this-period-
 * vs-last-period one layered on top.
 */
export function CompareReportsPage() {
  const filters = useReportsFilters();
  const { businessId, locationId, resolvedBounds, scopedLocations } = filters;

  const currentFilters: CompareReportsDashboardFilters = {
    ...resolvedBounds,
    businessId,
    locationId,
  };
  const compareDashboardQuery = useCompareReportsDashboard(currentFilters);
  const compareDashboard = compareDashboardQuery.data;

  return (
    <div>
      <PageHeader
        title="Compare Reports"
        subtitle="Sales vs purchases, by location, across your businesses"
      />
      <ReportsToolbar filters={filters} showLocationSelect />

      <div className="flex flex-col gap-3.5">
        {compareDashboardQuery.isError ? (
          <p className="text-sm text-danger">{describeApiError(compareDashboardQuery.error)}</p>
        ) : null}

        <CompareKpiStrip data={compareDashboard?.kpi} isLoading={compareDashboardQuery.isLoading} />

        <CompareTrendChart
          data={compareDashboard?.dailyTrend ?? []}
          isLoading={compareDashboardQuery.isLoading}
          isError={compareDashboardQuery.isError}
          error={compareDashboardQuery.error}
        />

        <CompareLocationChart
          data={compareDashboard?.locationPerformance ?? []}
          locations={scopedLocations}
          isLoading={compareDashboardQuery.isLoading}
          isError={compareDashboardQuery.isError}
          error={compareDashboardQuery.error}
        />
      </div>
    </div>
  );
}
