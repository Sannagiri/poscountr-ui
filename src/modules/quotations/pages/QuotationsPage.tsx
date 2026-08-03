import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

import type { DataTableColumn, DataTableFilter } from '@/components';
import { Badge, Button, Card, DataTable, DatePicker, PageHeader, Select } from '@/components';
import { dateIST, formatTimestamp, toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { QuotationBillPreviewModal } from '../components/QuotationBillPreviewModal';
import { QUOTATION_STATUS_OPTIONS, QUOTATIONS_ROUTES } from '../constants/quotation.constants';
import { useQuotations } from '../hooks/useQuotations';
import type { Quotation } from '../types/quotation.types';

/** Search matches customer name/phone/GSTIN, quotation number, and location. */
function getQuotationSearchValue(quotation: Quotation): string {
  return [
    quotation.quotationNumber ?? '',
    quotation.customerName,
    quotation.customerPhone,
    quotation.customerGstin,
    quotation.locationName,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Unlike `OrdersPage`'s `tokenDate`, quotations carry no pre-stamped IST day
 * field — only `createdAt`, a full ISO timestamp — so each row's day is
 * derived on the fly via `toISTDate()` before comparing against the bounds
 * below, rather than compared as a raw string like `tokenDate` is. `null`
 * means "every quotation," not "none" — that's the `all` preset.
 */
type DatePreset = 'today' | 'week' | 'date' | 'range' | 'all';

// Narrowest to broadest span — same chronological order every date-preset
// list in this app follows (`reportsFilters.constants.ts`, `NotificationBell`'s
// own preset list).
const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'date', label: 'Specific date' },
  { value: 'range', label: 'Date range' },
  { value: 'all', label: 'All time' },
];

/**
 * Every quotation visible to the actor, in one flat table — manager
 * pre-scoped to their own assigned location server-side, tenant_admin sees
 * every location (same scoping shape `PurchaseOrdersPage`/`OrdersPage`
 * already establish). Filters are applied client-side over the one
 * already-fetched list, same "fetch once, narrow with `DataTable`'s own
 * filters" convention `PurchaseOrdersPage` uses.
 */
export function QuotationsPage() {
  const navigate = useNavigate();
  const quotationsQuery = useQuotations();
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>('week');
  const [specificDate, setSpecificDate] = useState(() => dateIST());
  const [rangeFrom, setRangeFrom] = useState(() => dateIST());
  const [rangeTo, setRangeTo] = useState(() => dateIST());

  const dateBounds = useMemo(() => {
    if (datePreset === 'today') {
      const today = dateIST();
      return { from: today, to: today };
    }
    // Rolling 7-day window (today - 6 days .. today), same "week" convention
    // `resolveDatePresetBounds` (notifications) and `reportsFilters.constants.ts`
    // already use — not a Monday-Sunday calendar week.
    if (datePreset === 'week') return { from: dateIST(-6), to: dateIST() };
    if (datePreset === 'date') return { from: specificDate, to: specificDate };
    if (datePreset === 'range') return { from: rangeFrom, to: rangeTo };
    return null;
  }, [datePreset, specificDate, rangeFrom, rangeTo]);

  const dateFilteredQuotations = useMemo(() => {
    const quotations = quotationsQuery.data ?? [];
    if (!dateBounds) return quotations;
    return quotations.filter((quotation) => {
      const createdDate = toISTDate(quotation.createdAt);
      return createdDate >= dateBounds.from && createdDate <= dateBounds.to;
    });
  }, [quotationsQuery.data, dateBounds]);

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const quotation of quotationsQuery.data ?? [])
      seen.set(quotation.locationId, quotation.locationName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [quotationsQuery.data]);

  const columns: DataTableColumn<Quotation>[] = useMemo(
    () => [
      {
        key: 'quotationNumber',
        header: 'Quotation #',
        width: '130px',
        render: (row) => row.quotationNumber ?? '—',
      },
      { key: 'customerName', header: 'Customer', width: '1.3fr' },
      { key: 'locationName', header: 'Location', width: '1fr' },
      {
        key: 'status',
        header: 'Status',
        width: '120px',
        render: (row) => <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>,
      },
      { key: 'total', header: 'Total', width: '100px', render: (row) => `₹${row.total}` },
      {
        key: 'validUntil',
        header: 'Valid until',
        width: '110px',
        render: (row) => row.validUntil ?? '—',
      },
      {
        key: 'createdAt',
        header: 'Created',
        width: '180px',
        render: (row) => formatTimestamp(row.createdAt),
      },
      {
        key: 'document',
        header: 'Document',
        width: '110px',
        render: (row) => (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FileText size={14} />}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewQuotation(row);
            }}
          >
            Preview
          </Button>
        ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<Quotation>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: QUOTATION_STATUS_OPTIONS },
      { key: 'locationId', label: 'Location', options: locationFilterOptions },
    ],
    [locationFilterOptions],
  );

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Offers awaiting a customer's acceptance, in one place"
      />

      <Card>
        <DataTable
          columns={columns}
          data={dateFilteredQuotations}
          getRowKey={(row) => row.id}
          isLoading={quotationsQuery.isLoading}
          errorMessage={quotationsQuery.isError ? describeApiError(quotationsQuery.error) : null}
          onRetry={() => quotationsQuery.refetch()}
          emptyTitle="No quotations yet"
          emptyDescription="Raise your first quotation using the button above."
          getSearchValue={getQuotationSearchValue}
          searchPlaceholder="Search quotations…"
          filters={filters}
          onRowClick={(row) => navigate(QUOTATIONS_ROUTES.quotationDetail(row.id))}
          mobileCard={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {row.quotationNumber ?? '—'}
                </span>
                <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>
              </div>
              <span className="truncate text-sm text-ink">{row.customerName}</span>
              <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
                <span className="truncate">{row.locationName}</span>
                <span className="shrink-0 font-semibold text-ink">₹{row.total}</span>
              </div>
              <span className="text-xs text-ink-faint">{formatTimestamp(row.createdAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<FileText size={14} />}
                className="mt-1 self-start"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewQuotation(row);
                }}
              >
                Preview document
              </Button>
            </div>
          )}
          toolbarTrailing={
            <>
              <Select
                className="w-auto min-w-[9.5rem]"
                value={datePreset}
                onChange={(value) => setDatePreset(value as DatePreset)}
                options={DATE_PRESET_OPTIONS}
              />
              {datePreset === 'date' ? (
                <DatePicker
                  value={specificDate}
                  onChange={setSpecificDate}
                  className="w-auto min-w-[9.5rem]"
                />
              ) : null}
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
              <Button onClick={() => navigate(QUOTATIONS_ROUTES.newQuotation)}>
                New quotation
              </Button>
            </>
          }
        />
      </Card>

      <QuotationBillPreviewModal
        quotation={previewQuotation}
        onClose={() => setPreviewQuotation(null)}
      />
    </div>
  );
}
