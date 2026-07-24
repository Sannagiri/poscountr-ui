import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

import type { DataTableColumn, DataTableFilter } from '@/components';
import { Badge, Button, Card, DataTable, DatePicker, PageHeader, Select } from '@/components';
import { dateIST } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { OrderBillPreviewModal } from '../components/OrderBillPreviewModal';
import { BILLING_ROUTES, ORDER_TYPE_OPTIONS } from '../constants/billing.constants';
import { useOrders } from '../hooks/useOrders';
import type { Order, OrderStatus, OrderType } from '../types/billing.types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'kot_fired', label: 'KOT fired' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ORDER_TYPE_LABELS: Record<OrderType, string> = Object.fromEntries(
  ORDER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OrderType, string>;

/**
 * When it's on, `tokenDate` is compared as a plain ISO string against the
 * two bounds (inclusive both ends) — safe because `tokenDate` is always a
 * `YYYY-MM-DD` day, which sorts identically as a string or a real date.
 * `null` means "every order," not "none" — that's the `all` preset.
 */
type DatePreset = 'today' | 'date' | 'range' | 'all';

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
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

/**
 * Every order visible to the actor, in one flat table — manager pre-scoped
 * to their assigned location server-side, tenant_admin sees every location
 * (same scoping shape `ProductsPage` already established for products). No
 * server-side status/type/location filter is wired here since the whole
 * list is small enough to fetch once and narrow client-side via `DataTable`'s
 * built-in filters, exactly like `ProductsPage` does. The date filter below
 * follows the same client-side pattern, keyed off `tokenDate` — the same
 * IST day-boundary field the backend stamps at order-creation time (see
 * `DashboardPage`'s `dateIST()` usage for the same convention) — rather
 * than `createdAt`, so "today" always means the same day the backend meant
 * when it assigned the order its daily token number. Defaults to "today,"
 * per the same convention as the dashboard, rather than showing every order
 * ever placed.
 */
export function OrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useOrders();
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [specificDate, setSpecificDate] = useState(() => dateIST());
  const [rangeFrom, setRangeFrom] = useState(() => dateIST());
  const [rangeTo, setRangeTo] = useState(() => dateIST());

  const dateBounds = useMemo(() => {
    if (datePreset === 'today') {
      const today = dateIST();
      return { from: today, to: today };
    }
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

  const columns: DataTableColumn<Order>[] = useMemo(
    () => [
      {
        key: 'orderNumber',
        header: 'Order #',
        width: '110px',
        render: (row) => row.orderNumber ?? '—',
      },
      {
        key: 'customerName',
        header: 'Customer',
        width: '1.3fr',
        render: (row) => (
          <span className="flex flex-col">
            <span className="truncate font-medium">{row.customerName || 'Walk-in'}</span>
            <span className="truncate text-xs text-ink-faint">{row.customerPhone}</span>
          </span>
        ),
      },
      {
        key: 'tokenNumber',
        header: 'Token / Table',
        width: '120px',
        render: (row) => row.tokenNumber ?? (row.tableNumber || '—'),
      },
      {
        key: 'orderType',
        header: 'Type',
        width: '110px',
        render: (row) => ORDER_TYPE_LABELS[row.orderType],
      },
      { key: 'locationName', header: 'Location', width: '1fr' },
      {
        key: 'status',
        header: 'Status',
        width: '130px',
        render: (row) => <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>,
      },
      {
        key: 'total',
        header: 'Total',
        width: '100px',
        render: (row) => `₹${row.total}`,
      },
      {
        key: 'createdAt',
        header: 'Created',
        width: '160px',
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        key: 'bill',
        header: 'Bill',
        width: '110px',
        render: (row) => (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FileText size={14} />}
            disabled={row.status !== 'completed'}
            disabledReason={
              row.status !== 'completed' ? 'Available once the order is completed' : undefined
            }
            onClick={(event) => {
              event.stopPropagation();
              setPreviewOrder(row);
            }}
          >
            Preview
          </Button>
        ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<Order>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: STATUS_OPTIONS },
      {
        key: 'orderType',
        label: 'Type',
        options: ORDER_TYPE_OPTIONS,
      },
      { key: 'locationId', label: 'Location', options: locationFilterOptions },
    ],
    [locationFilterOptions],
  );

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order across your locations, in one place" />

      <Card>
        <DataTable
          columns={columns}
          data={dateFilteredOrders}
          getRowKey={(row) => row.id}
          isLoading={ordersQuery.isLoading}
          errorMessage={ordersQuery.isError ? describeApiError(ordersQuery.error) : null}
          onRetry={() => ordersQuery.refetch()}
          emptyTitle="No orders yet"
          emptyDescription="Open your first order using the button above."
          getSearchValue={getOrderSearchValue}
          searchPlaceholder="Search orders…"
          filters={filters}
          onRowClick={(row) => navigate(BILLING_ROUTES.orderDetail(row.id))}
          mobileCard={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {row.orderNumber ?? (row.tokenNumber ? `Token #${row.tokenNumber}` : '—')}
                </span>
                <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>
              </div>
              <span className="truncate text-sm text-ink">{row.customerName || 'Walk-in'}</span>
              <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
                <span className="truncate">
                  {ORDER_TYPE_LABELS[row.orderType]} · {row.locationName}
                </span>
                <span className="shrink-0 font-semibold text-ink">₹{row.total}</span>
              </div>
              <span className="text-xs text-ink-faint">
                {new Date(row.createdAt).toLocaleString()}
              </span>
              {row.status === 'completed' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<FileText size={14} />}
                  className="mt-1 self-start"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewOrder(row);
                  }}
                >
                  Preview bill
                </Button>
              ) : null}
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
              <Button onClick={() => navigate(BILLING_ROUTES.newOrder)}>New order</Button>
            </>
          }
        />
      </Card>

      <OrderBillPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
    </div>
  );
}
