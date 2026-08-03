import { useMemo } from 'react';
import { IndianRupee, Percent, Receipt, TrendingUp } from 'lucide-react';

import type { DataTableColumn } from '@/components';
import { Card, CardHeader, DataTable, PageHeader } from '@/components';
import { toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';

import { KpiTile } from '../components';
import { ReportsToolbar } from '../components/ReportsToolbar';
import { useInvoices } from '../hooks/useInvoices';
import { useReportsFilters } from '../hooks/useReportsFilters';
import { formatCompactMoney } from '../utils/reportsFormat';

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

/**
 * GST summary — GSTR-1-style HSN-wise breakdown, computed client-side from
 * real generated `Invoice` rows (`useInvoices`): CGST/SGST/IGST split and the
 * HSN summary are both computed server-side at invoice-generation time, not
 * re-derived from raw order totals, so they match what a GSTR-1 filing would
 * actually need. Unlike Sales/Purchase summary there's no server-side date
 * filter — invoices are fetched once and narrowed client-side by
 * `Invoice.issuedAt` (converted to its IST calendar day, see `toISTDate`).
 *
 * Its own sidebar sub-item and its own page (see `layouts/AppShell/
 * navConfig.tsx`'s "Reports" group) — split out alongside Sales/Purchase
 * summary so each report can later be suppressed independently by
 * license/add-on.
 */
export function GstReportsPage() {
  const filters = useReportsFilters();
  const { businessId, dateBounds } = filters;

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
      <PageHeader
        title="GST Reports"
        subtitle="GSTR-1-style HSN-wise summary across your businesses"
      />
      <ReportsToolbar filters={filters} />

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
    </div>
  );
}
