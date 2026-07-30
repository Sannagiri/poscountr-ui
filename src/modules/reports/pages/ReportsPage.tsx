import { useEffect, useMemo, useState } from 'react';
import { IndianRupee, Percent, Receipt, TrendingUp } from 'lucide-react';

import type { DataTableColumn } from '@/components';
import { Card, CardHeader, DataTable, DatePicker, PageHeader, Select, Tabs } from '@/components';
import { dateIST, toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';

import { useAuthStore } from '@/modules/auth';
import { useBusinesses, useLocations } from '@/modules/businesses';

import {
  CategoryMixChart,
  DailyTrendChart,
  KpiStrip,
  KpiTile,
  PaymentMixChart,
  RepresentativeTransactionsTable,
  StorePerformanceChart,
  TopProductsChart,
} from '../components';
import { useInvoices } from '../hooks/useInvoices';
import { useReportsDashboard } from '../hooks/useReportsDashboard';
import type { ReportsDashboardFilters } from '../types/reports.types';
import { formatCompactMoney } from '../utils/reportsFormat';

/**
 * When it's on, a day is compared as a plain ISO string against the two
 * bounds (inclusive both ends) — safe since every date here is always a
 * `YYYY-MM-DD` day, which sorts identically as a string or a real date.
 * `null` means "every record," not "none" — that's the `all` preset.
 */
type DatePreset = 'today' | 'week' | 'month' | 'range' | 'all';

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'range', label: 'Date range' },
  { value: 'all', label: 'All time' },
];

// The reports summary endpoint requires concrete `from`/`to` bounds — the
// `all` preset (which the client-side-filtered GST tab treats as "no
// filter") substitutes this wide fixed start instead, since there's no
// tenant-creation date available client-side to derive a real one from.
const ALL_TIME_FROM = '2000-01-01';

interface HsnSummaryRow {
  key: string;
  hsnCode: string;
  gstRate: string;
  taxableValue: number;
  taxAmount: number;
}

const hsnColumns: DataTableColumn<HsnSummaryRow>[] = [
  { key: 'hsnCode', header: 'HSN code', width: '140px', render: (row) => row.hsnCode || '—' },
  { key: 'gstRate', header: 'GST rate', width: '120px', render: (row) => `${row.gstRate}%` },
  {
    key: 'taxableValue',
    header: 'Taxable value',
    width: '1fr',
    render: (row) => `₹${row.taxableValue.toFixed(2)}`,
  },
  {
    key: 'taxAmount',
    header: 'Tax amount',
    width: '1fr',
    render: (row) => `₹${row.taxAmount.toFixed(2)}`,
  },
];

/** The immediately preceding period of equal length — e.g. "this month" -> "last month" of the same day-count — for the KPI strip's period-over-period deltas. */
function previousRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const lengthDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(fromDate.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (lengthDays - 1) * 86_400_000);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { from: format(prevFrom), to: format(prevTo) };
}

/**
 * Sales summary (an analytics dashboard — KPIs with period-over-period
 * deltas, a daily trend chart, category/payment mix, top products, and
 * capped tables) + GST summary (GSTR-1-style HSN-wise breakdown).
 *
 * Sales summary is powered by a dedicated backend aggregation endpoint
 * (`GET /tenant/reports/summary`, see `apps/reports/`) rather than fetching
 * every order and computing client-side — the old approach didn't scale
 * past a few hundred orders and would have forked from a future CSV/Word
 * export's numbers. GST summary is unchanged: computed client-side from
 * real generated `Invoice` rows (`useInvoices`) — CGST/SGST/IGST split and
 * the HSN summary are both computed server-side at invoice-generation time,
 * not re-derived from raw order totals, so they match what a GSTR-1 filing
 * would actually need.
 *
 * One date-range control governs both tabs; the sales tab sends its bounds
 * straight to the backend, the GST tab still filters `Invoice.issuedAt`
 * (converted to its IST calendar day) client-side — see `toISTDate`.
 */
export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const isTenantAdmin = user?.role === 'tenant_admin';

  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [rangeFrom, setRangeFrom] = useState(() => dateIST(-6));
  const [rangeTo, setRangeTo] = useState(() => dateIST());

  // A manager's data is already scoped server-side to their own location
  // regardless of `business_id`, so the picker (and the filter itself) is
  // tenant_admin-only — same gating `NewOrderPage` uses for its own business
  // picker. Always resolves to one concrete business (no blended "all
  // businesses" option) so neither tab's numbers ever mix businesses.
  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  useEffect(() => {
    if (selectedBusinessId || !businessesQuery.data?.length) return;
    setSelectedBusinessId(businessesQuery.data[0].id);
  }, [businessesQuery.data, selectedBusinessId]);
  const businessId = isTenantAdmin ? selectedBusinessId || undefined : undefined;

  const dateBounds = useMemo(() => {
    if (datePreset === 'today') {
      const today = dateIST();
      return { from: today, to: today };
    }
    if (datePreset === 'week') return { from: dateIST(-6), to: dateIST() };
    if (datePreset === 'month') {
      const today = dateIST();
      return { from: `${today.slice(0, 7)}-01`, to: today };
    }
    if (datePreset === 'range') return { from: rangeFrom, to: rangeTo };
    return null;
  }, [datePreset, rangeFrom, rangeTo]);

  // ─── Sales summary ──────────────────────────────────────────────────────
  const resolvedBounds = dateBounds ?? { from: ALL_TIME_FROM, to: dateIST() };
  const currentFilters: ReportsDashboardFilters = { ...resolvedBounds, businessId };
  const previousFilters: ReportsDashboardFilters = useMemo(
    () => ({ ...previousRange(resolvedBounds.from, resolvedBounds.to), businessId }),
    [resolvedBounds.from, resolvedBounds.to, businessId],
  );

  const dashboardQuery = useReportsDashboard(currentFilters);
  const previousDashboardQuery = useReportsDashboard(previousFilters);
  const dashboard = dashboardQuery.data;

  // A manager only ever sees their own single location's orders anyway
  // (server-side scoping), and `useLocations` is `IsTenantAdmin`-gated — the
  // store-performance breakdown only makes sense, and is only fetchable, for
  // a tenant_admin with more than one location. Filtered to the selected
  // business first — otherwise a tenant with several businesses would count
  // (and label) locations that don't even belong to the business currently
  // on screen.
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const scopedLocations = useMemo(
    () => (locationsQuery.data ?? []).filter((location) => !businessId || location.businessId === businessId),
    [locationsQuery.data, businessId],
  );
  const showStorePerformance = isTenantAdmin && scopedLocations.length > 1;

  // ─── GST summary ─────────────────────────────────────────────────────────
  const invoicesQuery = useInvoices({ businessId });

  const dateFilteredInvoices = useMemo(() => {
    const invoices = invoicesQuery.data ?? [];
    if (!dateBounds) return invoices;
    return invoices.filter((invoice) => {
      const day = toISTDate(invoice.issuedAt);
      return day >= dateBounds.from && day <= dateBounds.to;
    });
  }, [invoicesQuery.data, dateBounds]);

  const gstStats = useMemo(() => {
    const taxable = dateFilteredInvoices.reduce((sum, i) => sum + Number(i.taxableValue), 0);
    const cgst = dateFilteredInvoices.reduce((sum, i) => sum + Number(i.cgstAmount), 0);
    const sgst = dateFilteredInvoices.reduce((sum, i) => sum + Number(i.sgstAmount), 0);
    const igst = dateFilteredInvoices.reduce((sum, i) => sum + Number(i.igstAmount), 0);
    const total = dateFilteredInvoices.reduce((sum, i) => sum + Number(i.total), 0);
    return { count: dateFilteredInvoices.length, taxable, cgst, sgst, igst, total };
  }, [dateFilteredInvoices]);

  const hsnSummaryRows = useMemo(() => {
    const byKey = new Map<string, HsnSummaryRow>();
    for (const invoice of dateFilteredInvoices) {
      for (const line of invoice.hsnSummary) {
        const key = `${line.hsnCode}__${line.gstRate}`;
        const row = byKey.get(key) ?? {
          key,
          hsnCode: line.hsnCode,
          gstRate: line.gstRate,
          taxableValue: 0,
          taxAmount: 0,
        };
        row.taxableValue += Number(line.taxableValue);
        row.taxAmount += Number(line.taxAmount);
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => Number(b.gstRate) - Number(a.gstRate));
  }, [dateFilteredInvoices]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales and GST summaries across your businesses" />

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <Select
          className="w-auto min-w-[9.5rem]"
          value={datePreset}
          onChange={(value) => setDatePreset(value as DatePreset)}
          options={DATE_PRESET_OPTIONS}
        />
        {datePreset === 'range' ? (
          <>
            <DatePicker
              value={rangeFrom}
              onChange={setRangeFrom}
              placeholder="From"
              className="w-auto min-w-[9.5rem]"
            />
            <span className="text-xs text-ink-faint">to</span>
            <DatePicker
              value={rangeTo}
              onChange={setRangeTo}
              placeholder="To"
              className="w-auto min-w-[9.5rem]"
            />
          </>
        ) : null}
        {isTenantAdmin && businessesQuery.data?.length ? (
          <Select
            className="w-auto min-w-[9.5rem]"
            value={selectedBusinessId}
            onChange={(value) => setSelectedBusinessId(value)}
            options={businessesQuery.data.map((business) => ({ value: business.id, label: business.name }))}
          />
        ) : null}
      </div>

      <Tabs
        items={[
          {
            value: 'sales',
            label: 'Sales summary',
            content: (
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
                  className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${
                    showStorePerformance ? 'lg:grid-cols-3' : ''
                  }`}
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
                  {showStorePerformance ? (
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
            ),
          },
          {
            value: 'gst',
            label: 'GST summary',
            content: (
              <div className="flex flex-col gap-3.5">
                {invoicesQuery.isError ? (
                  <p className="text-sm text-danger">{describeApiError(invoicesQuery.error)}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <KpiTile
                    label="Invoices"
                    value={String(gstStats.count)}
                    icon={Receipt}
                    tint="accent"
                    deltaPercent={null}
                    goodDirection="neutral"
                  />
                  <KpiTile
                    label="Taxable value"
                    value={formatCompactMoney(gstStats.taxable)}
                    icon={IndianRupee}
                    tint="brand"
                    deltaPercent={null}
                    goodDirection="neutral"
                  />
                  <KpiTile
                    label="Tax collected"
                    value={formatCompactMoney(gstStats.cgst + gstStats.sgst + gstStats.igst)}
                    icon={Percent}
                    tint="warning"
                    deltaPercent={null}
                    goodDirection="neutral"
                  />
                  <KpiTile
                    label="Total invoiced"
                    value={formatCompactMoney(gstStats.total)}
                    icon={TrendingUp}
                    tint="success"
                    deltaPercent={null}
                    goodDirection="neutral"
                  />
                </div>
                <Card>
                  <CardHeader
                    title="HSN-wise summary"
                    subtitle="GSTR-1-style — taxable value and tax by HSN code and rate slab"
                  />
                  <DataTable
                    columns={hsnColumns}
                    data={hsnSummaryRows}
                    getRowKey={(row) => row.key}
                    isLoading={invoicesQuery.isLoading}
                    emptyTitle="No invoices in this range"
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
