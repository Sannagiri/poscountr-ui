import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card, DatePicker, ListToolbar, PageHeader, Select, useToast } from '@/components';
import { dateIST } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { OrderBillPreviewModal } from '../components/OrderBillPreviewModal';
import { OrderListCards } from '../components/OrderListCards';
import { BILLING_ROUTES, ORDER_TYPE_OPTIONS } from '../constants/billing.constants';
import { useOrderBill } from '../hooks/useOrderBill';
import { useOrders } from '../hooks/useOrders';
import type { Order, OrderStatus } from '../types/billing.types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'kot_fired', label: 'KOT fired' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * When it's on, `tokenDate` is compared as a plain ISO string against the
 * two bounds (inclusive both ends) — safe because `tokenDate` is always a
 * `YYYY-MM-DD` day, which sorts identically as a string or a real date.
 * `null` means "every order," not "none" — that's the `all` preset.
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

/** Search matches customer name/phone, table number, token number, and location. */
function getOrderSearchValue(order: Order): string {
  return [
    order.customerName,
    order.customerPhone,
    order.tableNumber,
    order.tokenNumber != null ? String(order.tokenNumber) : '',
    order.locationName,
  ]
    .filter(Boolean)
    .join(' ');
}

interface OrderFilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Every order visible to the actor, as a compact, colorful list (see
 * `OrderListCards`) — manager pre-scoped to their assigned location
 * server-side, tenant_admin sees every location (same scoping shape
 * `ProductsPage` already established for products). No server-side
 * status/type/location filter is wired here since the whole list is small
 * enough to fetch once and narrow client-side via `ListToolbar` +
 * `listFilter` helpers, exactly like `TenantsPage`'s card grid does. The
 * date filter below follows the same client-side pattern, keyed off
 * `tokenDate` — the same IST day-boundary field the backend stamps at
 * order-creation time (see `DashboardPage`'s `dateIST()` usage for the same
 * convention) — rather than `createdAt`, so "today" always means the same
 * day the backend meant when it assigned the order its daily token number.
 * Defaults to "Last 7 days" — enough of a window to actually see something
 * on a normal shop day without loading every order ever placed.
 */
export function OrdersPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { printBill } = useOrderBill();
  const ordersQuery = useOrders();
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const handlePrint = useCallback(
    async (order: Order) => {
      setPrintingOrderId(order.id);
      try {
        await printBill(order);
      } catch (error) {
        showToast({ tone: 'danger', message: describeApiError(error) });
      } finally {
        setPrintingOrderId(null);
      }
    },
    [printBill, showToast],
  );

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

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const order of ordersQuery.data ?? []) seen.set(order.locationId, order.locationName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [ordersQuery.data]);

  const filters: OrderFilterDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: STATUS_OPTIONS },
      { key: 'orderType', label: 'Type', options: ORDER_TYPE_OPTIONS },
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
  const filteredOrders = useMemo(() => {
    const searched = filterBySearch(dateFilteredOrders, searchTerm, getOrderSearchValue);
    return applyFilterValues(searched, filters, filterValues);
  }, [dateFilteredOrders, searchTerm, filters, filterValues]);
  function clearFilters() {
    setSearchTerm('');
    setFilterValues({});
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order across your locations, in one place" />

      <Card>
        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search orders…"
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
              <Button onClick={() => navigate(BILLING_ROUTES.newOrder)}>New order</Button>
            </>
          }
        />
        <OrderListCards
          orders={filteredOrders}
          isLoading={ordersQuery.isLoading}
          errorMessage={ordersQuery.isError ? describeApiError(ordersQuery.error) : null}
          onRetry={() => ordersQuery.refetch()}
          onRowClick={(order) => navigate(BILLING_ROUTES.orderDetail(order.id))}
          onPreview={(order) => setPreviewOrder(order)}
          onPrint={handlePrint}
          printingOrderId={printingOrderId}
          emptyTitle="No orders yet"
          emptyDescription="Open your first order using the button above."
          isFilteredEmpty={dateFilteredOrders.length > 0 && hasActiveFilters}
          onClearFilters={clearFilters}
        />
      </Card>

      <OrderBillPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
    </div>
  );
}
