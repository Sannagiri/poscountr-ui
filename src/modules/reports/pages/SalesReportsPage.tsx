import { useMemo } from 'react';

import { PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';

import {
  CategoryMixChart,
  DailyTrendChart,
  KpiStrip,
  PaymentMixChart,
  RepresentativeTransactionsTable,
  StorePerformanceChart,
  TopProductsChart,
} from '../components';
import { ReportsToolbar } from '../components/ReportsToolbar';
import { useReportsDashboard } from '../hooks/useReportsDashboard';
import { useReportsFilters } from '../hooks/useReportsFilters';
import type { ReportsDashboardFilters } from '../types/reports.types';
import { previousRange } from '../utils/previousRange';

/**
 * Sales summary — an analytics dashboard (KPIs with period-over-period
 * deltas, a daily trend chart, category/payment mix, top products, and a
 * capped recent-transactions table), powered by a dedicated backend
 * aggregation endpoint (`GET /tenant/reports/summary`, see `apps/reports/`)
 * rather than fetching every order and computing client-side.
 *
 * Its own sidebar sub-item and its own page (see `layouts/AppShell/
 * navConfig.tsx`'s "Reports" group), not a tab sharing a page with Purchase/
 * GST summary — same "each report gets its own route" split Settings
 * already established, and the precondition for later suppressing any one
 * of these independently by license/add-on.
 */
export function SalesReportsPage() {
  const filters = useReportsFilters();
  const { businessId, resolvedBounds, scopedLocations, showLocationBreakdown } = filters;

  const currentFilters: ReportsDashboardFilters = { ...resolvedBounds, businessId };
  const previousFilters: ReportsDashboardFilters = useMemo(
    () => ({ ...previousRange(resolvedBounds.from, resolvedBounds.to), businessId }),
    [resolvedBounds.from, resolvedBounds.to, businessId],
  );

  const dashboardQuery = useReportsDashboard(currentFilters);
  const previousDashboardQuery = useReportsDashboard(previousFilters);
  const dashboard = dashboardQuery.data;

  return (
    <div>
      <PageHeader title="Sales Reports" subtitle="Sales analytics across your businesses" />
      <ReportsToolbar filters={filters} />

      <div className="flex flex-col gap-3.5">
        {dashboardQuery.isError ? (
          <p className="text-sm text-danger">{describeApiError(dashboardQuery.error)}</p>
        ) : null}

        <KpiStrip
          current={dashboard?.kpi}
          previous={previousDashboardQuery.data?.kpi ?? null}
          isLoading={dashboardQuery.isLoading}
        />

        <DailyTrendChart
          data={dashboard?.dailyTrend ?? []}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          error={dashboardQuery.error}
        />

        <div
          className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${showLocationBreakdown ? 'lg:grid-cols-3' : ''}`}
        >
          <CategoryMixChart
            data={dashboard?.categoryMix ?? []}
            isLoading={dashboardQuery.isLoading}
            isError={dashboardQuery.isError}
            error={dashboardQuery.error}
          />
          <PaymentMixChart
            data={dashboard?.paymentMix ?? []}
            isLoading={dashboardQuery.isLoading}
            isError={dashboardQuery.isError}
            error={dashboardQuery.error}
          />
          {showLocationBreakdown ? (
            <StorePerformanceChart
              data={dashboard?.storePerformance ?? []}
              locations={scopedLocations}
              isLoading={dashboardQuery.isLoading}
              isError={dashboardQuery.isError}
              error={dashboardQuery.error}
            />
          ) : null}
        </div>

        <TopProductsChart
          data={dashboard?.topProducts ?? []}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          error={dashboardQuery.error}
        />

        <RepresentativeTransactionsTable
          data={dashboard?.representativeTransactions ?? []}
          locations={scopedLocations}
          isLoading={dashboardQuery.isLoading}
          errorMessage={dashboardQuery.isError ? describeApiError(dashboardQuery.error) : null}
        />
      </div>
    </div>
  );
}
