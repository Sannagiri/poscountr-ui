import { useMemo } from 'react';

import { PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';

import {
  DailyTrendChart,
  PurchaseKpiStrip,
  PurchaseLocationChart,
  PurchasePaymentStatusChart,
  TopProductsPurchasedChart,
  TopSuppliersChart,
} from '../components';
import { ReportsToolbar } from '../components/ReportsToolbar';
import { usePurchaseReportsDashboard } from '../hooks/usePurchaseReportsDashboard';
import { useReportsFilters } from '../hooks/useReportsFilters';
import type { PurchaseReportsDashboardFilters } from '../types/purchaseReports.types';
import { previousRange } from '../utils/previousRange';

/**
 * Purchase summary — the buy-side mirror of Sales Reports (KPIs, daily
 * trend, top suppliers/products purchased, location breakdown, payment
 * status mix), powered by `GET /tenant/reports/purchases/summary` (see
 * `apps/reports/selectors/purchase_dashboard.py`).
 *
 * Its own sidebar sub-item and its own page (see `layouts/AppShell/
 * navConfig.tsx`'s "Reports" group) — split out alongside Sales/GST summary
 * so each report can later be suppressed independently by license/add-on,
 * not bundled as one un-splittable "Reports" feature.
 */
export function PurchaseReportsPage() {
  const filters = useReportsFilters();
  const { businessId, resolvedBounds, scopedLocations, showLocationBreakdown } = filters;

  const currentFilters: PurchaseReportsDashboardFilters = { ...resolvedBounds, businessId };
  const previousFilters: PurchaseReportsDashboardFilters = useMemo(
    () => ({ ...previousRange(resolvedBounds.from, resolvedBounds.to), businessId }),
    [resolvedBounds.from, resolvedBounds.to, businessId],
  );

  const purchaseDashboardQuery = usePurchaseReportsDashboard(currentFilters);
  const previousPurchaseDashboardQuery = usePurchaseReportsDashboard(previousFilters);
  const purchaseDashboard = purchaseDashboardQuery.data;

  return (
    <div>
      <PageHeader title="Purchase Reports" subtitle="Purchasing analytics across your businesses" />
      <ReportsToolbar filters={filters} />

      <div className="flex flex-col gap-3.5">
        {purchaseDashboardQuery.isError ? (
          <p className="text-sm text-danger">{describeApiError(purchaseDashboardQuery.error)}</p>
        ) : null}

        <PurchaseKpiStrip
          current={purchaseDashboard?.kpi}
          previous={previousPurchaseDashboardQuery.data?.kpi ?? null}
          isLoading={purchaseDashboardQuery.isLoading}
        />

        <DailyTrendChart
          data={
            purchaseDashboard?.dailyTrend.map((point) => ({
              date: point.date,
              revenue: point.spend,
              orders: point.poCount,
              units: point.units,
            })) ?? []
          }
          isLoading={purchaseDashboardQuery.isLoading}
          isError={purchaseDashboardQuery.isError}
          error={purchaseDashboardQuery.error}
          title="Daily purchase trend"
          subtitle="Spend over the selected range, with a smoothed trend line"
          valueLabel="Spend"
          emptyTitle="No completed purchase orders in this range"
        />

        <div
          className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${showLocationBreakdown ? 'lg:grid-cols-3' : ''}`}
        >
          <TopSuppliersChart
            data={purchaseDashboard?.topSuppliers ?? []}
            isLoading={purchaseDashboardQuery.isLoading}
            isError={purchaseDashboardQuery.isError}
            error={purchaseDashboardQuery.error}
          />
          <PurchasePaymentStatusChart
            data={purchaseDashboard?.paymentStatusMix ?? []}
            outstandingDues={purchaseDashboard?.kpi.outstandingDues}
            isLoading={purchaseDashboardQuery.isLoading}
            isError={purchaseDashboardQuery.isError}
            error={purchaseDashboardQuery.error}
          />
          {showLocationBreakdown ? (
            <PurchaseLocationChart
              data={purchaseDashboard?.locationPerformance ?? []}
              locations={scopedLocations}
              isLoading={purchaseDashboardQuery.isLoading}
              isError={purchaseDashboardQuery.isError}
              error={purchaseDashboardQuery.error}
            />
          ) : null}
        </div>

        <TopProductsPurchasedChart
          data={purchaseDashboard?.topProductsPurchased ?? []}
          isLoading={purchaseDashboardQuery.isLoading}
          isError={purchaseDashboardQuery.isError}
          error={purchaseDashboardQuery.error}
        />
      </div>
    </div>
  );
}
