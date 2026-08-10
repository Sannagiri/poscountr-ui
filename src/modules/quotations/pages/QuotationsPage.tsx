import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card, DatePicker, ListToolbar, PageHeader, Select } from '@/components';
import { dateIST, toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { QuotationBillPreviewModal } from '../components/QuotationBillPreviewModal';
import { QuotationListCards } from '../components/QuotationListCards';
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

interface QuotationFilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Every quotation visible to the actor, as a compact, colorful list (see
 * `QuotationListCards`) — manager pre-scoped to their own assigned location
 * server-side, tenant_admin sees every location (same scoping shape
 * `PurchaseOrdersPage`/`OrdersPage` already establish). Filters are applied
 * client-side over the one already-fetched list, same "fetch once, narrow
 * with `ListToolbar` + `listFilter` helpers" convention `OrdersPage` uses.
 */
export function QuotationsPage() {
  const navigate = useNavigate();
  const quotationsQuery = useQuotations();
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

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

  const filters: QuotationFilterDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: QUOTATION_STATUS_OPTIONS },
      { key: 'locationId', label: 'Location', options: locationFilterOptions },
    ],
    [locationFilterOptions],
  );

  const toolbarFilters = useMemo(
    () =>
      filters.map((filter) => ({
        key: filter.key,
        label: filter.label,
        value: filterValues[filter.key] ?? 'all',
        onChange: (value: string) => setFilterValues((prev) => ({ ...prev, [filter.key]: value })),
        options: filter.options,
      })),
    [filters, filterValues],
  );
  const hasActiveFilters = hasActiveListFilters(searchTerm, filterValues);
  const filteredQuotations = useMemo(() => {
    const searched = filterBySearch(dateFilteredQuotations, searchTerm, getQuotationSearchValue);
    return applyFilterValues(searched, filters, filterValues);
  }, [dateFilteredQuotations, searchTerm, filters, filterValues]);
  function clearFilters() {
    setSearchTerm('');
    setFilterValues({});
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Offers awaiting a customer's acceptance, in one place"
      />

      <Card>
        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search quotations…"
          filters={toolbarFilters}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          trailing={
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
        <QuotationListCards
          quotations={filteredQuotations}
          isLoading={quotationsQuery.isLoading}
          errorMessage={quotationsQuery.isError ? describeApiError(quotationsQuery.error) : null}
          onRetry={() => quotationsQuery.refetch()}
          onRowClick={(row) => navigate(QUOTATIONS_ROUTES.quotationDetail(row.id))}
          onPreview={(row) => setPreviewQuotation(row)}
          emptyTitle="No quotations yet"
          emptyDescription="Raise your first quotation using the button above."
          isFilteredEmpty={dateFilteredQuotations.length > 0 && hasActiveFilters}
          onClearFilters={clearFilters}
        />
      </Card>

      <QuotationBillPreviewModal
        quotation={previewQuotation}
        onClose={() => setPreviewQuotation(null)}
      />
    </div>
  );
}
