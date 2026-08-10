import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card, DatePicker, ListToolbar, PageHeader, Select } from '@/components';
import { dateIST, toISTDate } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { PurchaseOrderBillPreviewModal } from '../components/PurchaseOrderBillPreviewModal';
import { PurchaseOrderListCards } from '../components/PurchaseOrderListCards';
import {
  PURCHASE_ORDER_STATUS_OPTIONS,
  PURCHASING_ROUTES,
} from '../constants/purchasing.constants';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import type { PurchaseOrder } from '../types/purchasing.types';

/** Search matches supplier name/phone/GSTIN, purchase number, and location. */
function getPurchaseOrderSearchValue(purchaseOrder: PurchaseOrder): string {
  return [
    purchaseOrder.purchaseNumber ?? '',
    purchaseOrder.supplierName,
    purchaseOrder.supplierPhone,
    purchaseOrder.supplierGstin,
    purchaseOrder.locationName,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Unlike `OrdersPage`'s `tokenDate`, purchase orders carry no pre-stamped IST
 * day field — only `createdAt`, a full ISO timestamp — so each row's day is
 * derived on the fly via `toISTDate()` before comparing against the bounds
 * below, rather than compared as a raw string like `tokenDate` is. `null`
 * means "every purchase order," not "none" — that's the `all` preset.
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

interface PurchaseOrderFilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Every purchase order visible to the actor, as a compact, colorful list
 * (see `PurchaseOrderListCards`) — manager pre-scoped to their own assigned
 * location server-side, tenant_admin sees every location (same scoping
 * shape `OrdersPage` already established for sales orders).
 * Search/status/location/supplier filters are all applied client-side over
 * the one already-fetched list, same "fetch once, narrow with `ListToolbar`
 * + `listFilter` helpers" convention `OrdersPage`/`ProductsPage` use — the
 * backend also accepts these three as server-side query params
 * (`usePurchaseOrders`'s own filters argument), left unused here for the
 * same reason `OrdersPage` leaves its own status/location filters unused:
 * the whole list is small enough that one fetch plus client-side narrowing
 * is simpler than plumbing filter state into the query.
 */
export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const purchaseOrdersQuery = usePurchaseOrders();
  const [previewPurchaseOrder, setPreviewPurchaseOrder] = useState<PurchaseOrder | null>(null);

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

  const dateFilteredPurchaseOrders = useMemo(() => {
    const purchaseOrders = purchaseOrdersQuery.data ?? [];
    if (!dateBounds) return purchaseOrders;
    return purchaseOrders.filter((purchaseOrder) => {
      const createdDate = toISTDate(purchaseOrder.createdAt);
      return createdDate >= dateBounds.from && createdDate <= dateBounds.to;
    });
  }, [purchaseOrdersQuery.data, dateBounds]);

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const purchaseOrder of purchaseOrdersQuery.data ?? [])
      seen.set(purchaseOrder.locationId, purchaseOrder.locationName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [purchaseOrdersQuery.data]);

  const supplierFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const purchaseOrder of purchaseOrdersQuery.data ?? [])
      seen.set(purchaseOrder.supplierId, purchaseOrder.supplierName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [purchaseOrdersQuery.data]);

  const filters: PurchaseOrderFilterDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: PURCHASE_ORDER_STATUS_OPTIONS },
      { key: 'locationId', label: 'Location', options: locationFilterOptions },
      { key: 'supplierId', label: 'Supplier', options: supplierFilterOptions },
    ],
    [locationFilterOptions, supplierFilterOptions],
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
  const filteredPurchaseOrders = useMemo(() => {
    const searched = filterBySearch(
      dateFilteredPurchaseOrders,
      searchTerm,
      getPurchaseOrderSearchValue,
    );
    return applyFilterValues(searched, filters, filterValues);
  }, [dateFilteredPurchaseOrders, searchTerm, filters, filterValues]);
  function clearFilters() {
    setSearchTerm('');
    setFilterValues({});
  }

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        subtitle="Every stock-in order from your suppliers, in one place"
      />

      <Card>
        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search purchase orders…"
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
              <Button onClick={() => navigate(PURCHASING_ROUTES.newPurchaseOrder)}>
                New purchase order
              </Button>
            </>
          }
        />
        <PurchaseOrderListCards
          purchaseOrders={filteredPurchaseOrders}
          isLoading={purchaseOrdersQuery.isLoading}
          errorMessage={
            purchaseOrdersQuery.isError ? describeApiError(purchaseOrdersQuery.error) : null
          }
          onRetry={() => purchaseOrdersQuery.refetch()}
          onRowClick={(row) => navigate(PURCHASING_ROUTES.purchaseOrderDetail(row.id))}
          onPreview={(row) => setPreviewPurchaseOrder(row)}
          emptyTitle="No purchase orders yet"
          emptyDescription="Record your first stock-in order using the button above."
          isFilteredEmpty={dateFilteredPurchaseOrders.length > 0 && hasActiveFilters}
          onClearFilters={clearFilters}
        />
      </Card>

      <PurchaseOrderBillPreviewModal
        purchaseOrder={previewPurchaseOrder}
        onClose={() => setPreviewPurchaseOrder(null)}
      />
    </div>
  );
}
