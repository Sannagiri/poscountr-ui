import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { DataTableColumn, DataTableFilter } from '@/components';
import { Badge, Button, Card, DataTable, PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

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
 * built-in filters, exactly like `ProductsPage` does.
 */
export function OrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useOrders();

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const order of ordersQuery.data ?? []) seen.set(order.locationId, order.locationName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [ordersQuery.data]);

  const columns: DataTableColumn<Order>[] = useMemo(
    () => [
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
        align: 'right',
        render: (row) => `₹${row.total}`,
      },
      {
        key: 'createdAt',
        header: 'Created',
        width: '160px',
        render: (row) => new Date(row.createdAt).toLocaleString(),
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
          data={ordersQuery.data ?? []}
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
          toolbarTrailing={
            <Button onClick={() => navigate(BILLING_ROUTES.newOrder)}>New order</Button>
          }
        />
      </Card>
    </div>
  );
}
