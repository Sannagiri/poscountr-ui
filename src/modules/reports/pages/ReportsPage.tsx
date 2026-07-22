import { useMemo, useState } from 'react';

import type { DataTableColumn } from '@/components';
import { Card, CardHeader, DataTable, DatePicker, PageHeader, Select, Tabs } from '@/components';
import { dateIST, toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';

import { useAuthStore } from '@/modules/auth';
import { useOrders } from '@/modules/billing';
import { useLocations } from '@/modules/businesses';

import { useInvoices } from '../hooks/useInvoices';

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

interface SalesByDayRow {
  date: string;
  orders: number;
  revenue: number;
  tax: number;
}

interface SalesByLocationRow {
  locationId: string;
  locationName: string;
  orders: number;
  revenue: number;
}

interface SalesByBusinessRow {
  businessName: string;
  orders: number;
  revenue: number;
}

interface HsnSummaryRow {
  key: string;
  hsnCode: string;
  gstRate: string;
  taxableValue: number;
  taxAmount: number;
}

const salesByDayColumns: DataTableColumn<SalesByDayRow>[] = [
  {
    key: 'date',
    header: 'Date',
    width: '160px',
    render: (row) =>
      new Date(row.date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
  { key: 'orders', header: 'Orders', width: '110px' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '1fr',
    render: (row) => `₹${row.revenue.toFixed(2)}`,
  },
  { key: 'tax', header: 'Tax collected', width: '1fr', render: (row) => `₹${row.tax.toFixed(2)}` },
];

const salesByLocationColumns: DataTableColumn<SalesByLocationRow>[] = [
  { key: 'locationName', header: 'Location', width: '1.5fr' },
  { key: 'orders', header: 'Orders', width: '110px' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '1fr',
    render: (row) => `₹${row.revenue.toFixed(2)}`,
  },
];

const salesByBusinessColumns: DataTableColumn<SalesByBusinessRow>[] = [
  { key: 'businessName', header: 'Business', width: '1.5fr' },
  { key: 'orders', header: 'Orders', width: '110px' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '1fr',
    render: (row) => `₹${row.revenue.toFixed(2)}`,
  },
];

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

/**
 * Sales summary (by day / business / location) + GST summary (GSTR-1-style
 * HSN-wise breakdown) — both computed client-side from data the app already
 * fetches elsewhere (`useOrders`, the new `useInvoices`) rather than
 * waiting on a dedicated backend `reports` module, which doesn't exist yet
 * (see `POSCountr-UI-Planning/poscountr-ui-page-inventory.md` §D6). GST
 * figures come from real generated `Invoice` rows — CGST/SGST/IGST split
 * and the HSN summary are both computed server-side at invoice-generation
 * time — not re-derived from raw order totals, so they match what a GSTR-1
 * filing would actually need.
 *
 * One date-range control governs both tabs; each tab filters its own date
 * field client-side (`Order.tokenDate` for sales, `Invoice.issuedAt`
 * converted to its IST calendar day for GST — see `toISTDate`).
 */
export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const isTenantAdmin = user?.role === 'tenant_admin';

  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [rangeFrom, setRangeFrom] = useState(() => dateIST(-6));
  const [rangeTo, setRangeTo] = useState(() => dateIST());

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
  const ordersQuery = useOrders();

  const dateFilteredOrders = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    if (!dateBounds) return orders;
    return orders.filter(
      (order) =>
        order.tokenDate !== null &&
        order.tokenDate >= dateBounds.from &&
        order.tokenDate <= dateBounds.to,
    );
  }, [ordersQuery.data, dateBounds]);

  // "Sales" means revenue actually booked — cancelled orders never
  // completed, and a still-open order hasn't been paid for yet.
  const completedOrders = useMemo(
    () => dateFilteredOrders.filter((order) => order.status === 'completed'),
    [dateFilteredOrders],
  );

  const cancelledCount = useMemo(
    () => dateFilteredOrders.filter((order) => order.status === 'cancelled').length,
    [dateFilteredOrders],
  );

  const salesStats = useMemo(() => {
    const revenue = completedOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const tax = completedOrders.reduce((sum, order) => sum + Number(order.taxTotal), 0);
    const count = completedOrders.length;
    return { revenue, tax, count, average: count > 0 ? revenue / count : 0 };
  }, [completedOrders]);

  const salesByDay = useMemo(() => {
    const byDate = new Map<string, SalesByDayRow>();
    for (const order of completedOrders) {
      const date = order.tokenDate ?? 'unknown';
      const row = byDate.get(date) ?? { date, orders: 0, revenue: 0, tax: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      row.tax += Number(order.taxTotal);
      byDate.set(date, row);
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [completedOrders]);

  const salesByLocation = useMemo(() => {
    const byLocation = new Map<string, SalesByLocationRow>();
    for (const order of completedOrders) {
      const row = byLocation.get(order.locationId) ?? {
        locationId: order.locationId,
        locationName: order.locationName,
        orders: 0,
        revenue: 0,
      };
      row.orders += 1;
      row.revenue += Number(order.total);
      byLocation.set(order.locationId, row);
    }
    return Array.from(byLocation.values()).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders]);

  // A manager only ever sees their own single location's orders anyway
  // (server-side scoping), and `useLocations` is `IsTenantAdmin`-gated —
  // this breakdown only makes sense, and is only fetchable, for a
  // tenant_admin with more than one business.
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const businessNameByLocation = useMemo(() => {
    const map = new Map<string, string>();
    for (const location of locationsQuery.data ?? []) map.set(location.id, location.businessName);
    return map;
  }, [locationsQuery.data]);

  const salesByBusiness = useMemo(() => {
    if (!isTenantAdmin) return [];
    const byBusiness = new Map<string, SalesByBusinessRow>();
    for (const order of completedOrders) {
      const businessName = businessNameByLocation.get(order.locationId) ?? 'Unknown';
      const row = byBusiness.get(businessName) ?? { businessName, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      byBusiness.set(businessName, row);
    }
    return Array.from(byBusiness.values()).sort((a, b) => b.revenue - a.revenue);
  }, [isTenantAdmin, completedOrders, businessNameByLocation]);

  const salesBreakdownTabs = [
    {
      value: 'day',
      label: 'By day',
      content: (
        <Card>
          <DataTable
            columns={salesByDayColumns}
            data={salesByDay}
            getRowKey={(row) => row.date}
            isLoading={ordersQuery.isLoading}
            emptyTitle="No completed orders in this range"
          />
        </Card>
      ),
    },
    {
      value: 'location',
      label: 'By location',
      content: (
        <Card>
          <DataTable
            columns={salesByLocationColumns}
            data={salesByLocation}
            getRowKey={(row) => row.locationId}
            isLoading={ordersQuery.isLoading}
            emptyTitle="No completed orders in this range"
          />
        </Card>
      ),
    },
    ...(isTenantAdmin
      ? [
          {
            value: 'business',
            label: 'By business',
            content: (
              <Card>
                <DataTable
                  columns={salesByBusinessColumns}
                  data={salesByBusiness}
                  getRowKey={(row) => row.businessName}
                  isLoading={ordersQuery.isLoading || locationsQuery.isLoading}
                  emptyTitle="No completed orders in this range"
                />
              </Card>
            ),
          },
        ]
      : []),
  ];

  // ─── GST summary ─────────────────────────────────────────────────────────
  const invoicesQuery = useInvoices();

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
      </div>

      <Tabs
        items={[
          {
            value: 'sales',
            label: 'Sales summary',
            content: (
              <div className="flex flex-col gap-3.5">
                {ordersQuery.isError ? (
                  <p className="text-sm text-danger">{describeApiError(ordersQuery.error)}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Revenue</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      ₹{salesStats.revenue.toFixed(2)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Completed orders</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      {salesStats.count}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Average order value</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      ₹{salesStats.average.toFixed(2)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Cancelled orders</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      {cancelledCount}
                    </p>
                  </Card>
                </div>
                <Tabs items={salesBreakdownTabs} />
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
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Invoices</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      {gstStats.count}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Taxable value</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      ₹{gstStats.taxable.toFixed(2)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Tax collected</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      ₹{(gstStats.cgst + gstStats.sgst + gstStats.igst).toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      CGST ₹{gstStats.cgst.toFixed(2)} · SGST ₹{gstStats.sgst.toFixed(2)} · IGST ₹
                      {gstStats.igst.toFixed(2)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs font-medium text-ink-soft">Total invoiced</p>
                    <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                      ₹{gstStats.total.toFixed(2)}
                    </p>
                  </Card>
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
