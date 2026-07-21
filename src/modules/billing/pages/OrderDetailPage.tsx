import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListOrdered, Trash2 } from 'lucide-react';

import type { DataTableColumn, DataTableRowAction } from '@/components';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Loader,
  PageHeader,
  SearchInput,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';
import { useProducts } from '@/modules/inventory';

import {
  BILLING_QUERY_KEYS,
  BILLING_ROUTES,
  canCancel,
  isFoodFlowProduct,
  nextStatusFor,
  ORDER_TYPE_OPTIONS,
  roleMayTransition,
  TRANSITION_ACTION_LABELS,
} from '../constants/billing.constants';
import { useOrder } from '../hooks/useOrder';
import { billingService } from '../services/billingService';
import type { OrderItem, OrderStatus } from '../types/billing.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

const ORDER_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/** Maps a transition target to the `billingService` method that drives it. */
const TARGET_TO_SERVICE_CALL: Record<
  Exclude<OrderStatus, 'pending'>,
  (orderId: string) => ReturnType<typeof billingService.fireKot>
> = {
  kot_fired: billingService.fireKot,
  preparing: billingService.setPreparing,
  ready: billingService.setReady,
  delivered: billingService.deliver,
  completed: billingService.complete,
  cancelled: billingService.cancel,
};

/** Strips the decimal-string's fixed 3-place padding for display — `"1.000"` reads as `"1"`, `"2.500"` as `"2.5"` — same rounding + trim `inventory.constants.ts`'s own `formatQuantity` uses, so a summed float artifact (`"1.0000000000002"`) doesn't leak through either. */
function formatQuantity(quantity: string): string {
  const num = Number(quantity);
  if (!Number.isFinite(num)) return quantity;
  return num.toFixed(3).replace(/\.?0+$/, '') || '0';
}

/** `date | time` in the locale's short form — used throughout the order timeline. */
function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One order's full detail — items (as a proper table: qty/price/tax/total
 * each their own column, searchable, scrolling only inside its own row area
 * rather than growing the page — same shared `DataTable` every list screen
 * uses), totals, order/customer context, a timeline of every status the
 * order has actually passed through, and whichever single "next step"
 * transition button applies for the order's current status + flow (food vs
 * non-food) + the acting user's role (confirmed via the F6 confirm-first
 * question as its own dedicated view, not a table row-actions menu — an
 * order is something you'd revisit and link to, unlike a quick-edit modal).
 * Items can only be added/removed while the order is still `pending` — the
 * backend rejects both endpoints otherwise.
 */
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);

  const orderQuery = useOrder(orderId);
  const productsQuery = useProducts();
  const order = orderQuery.data;

  const [addItemSearch, setAddItemSearch] = useState('');
  const [pendingCancel, setPendingCancel] = useState(false);

  const isFoodFlow = useMemo(() => {
    if (!order) return false;
    const businessProduct = (productsQuery.data ?? []).find(
      (product) => product.businessId === order.businessId,
    );
    return businessProduct ? isFoodFlowProduct(businessProduct) : false;
  }, [order, productsQuery.data]);

  function invalidateOrder() {
    queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.order(orderId ?? '') });
    queryClient.invalidateQueries({ queryKey: ['billing', 'orders'] });
  }

  const transitionMutation = useMutation({
    mutationFn: (target: Exclude<OrderStatus, 'pending'>) =>
      TARGET_TO_SERVICE_CALL[target](orderId as string),
    onSuccess: ({ warning }) => {
      invalidateOrder();
      setPendingCancel(false);
      showToast({ tone: warning ? 'warning' : 'success', message: warning ?? 'Order updated.' });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingCancel(false);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: string }) =>
      billingService.addItem(orderId as string, { productId, quantity }),
    onSuccess: invalidateOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const removeItemMutation = useMutation({
    mutationFn: (productId: string) => billingService.removeItem(orderId as string, productId),
    onSuccess: invalidateOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const itemColumns: DataTableColumn<OrderItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Item',
        width: 'minmax(160px, 1fr)',
        render: (item) => <span className="font-medium text-ink">{item.name}</span>,
      },
      {
        key: 'quantity',
        header: 'Qty',
        width: '70px',
        align: 'right',
        render: (item) => formatQuantity(item.quantity),
      },
      {
        key: 'unitPrice',
        header: 'Price',
        width: '90px',
        align: 'right',
        render: (item) => `₹${item.unitPrice}`,
      },
      {
        key: 'tax',
        header: 'Tax %',
        width: '70px',
        align: 'right',
        render: (item) => {
          const rate = Number(item.gstRate);
          if (!rate) return '—';
          return String(Math.round(rate));
        },
      },
      {
        key: 'lineTotal',
        header: 'Total',
        width: '90px',
        align: 'right',
        render: (item) => <span className="font-semibold text-ink">₹{item.lineTotal}</span>,
      },
    ],
    [],
  );

  if (orderQuery.isLoading) return <Loader label="Loading order…" />;
  if (orderQuery.isError || !order) {
    return (
      <EmptyState
        title="Order not found"
        description={orderQuery.isError ? describeApiError(orderQuery.error) : undefined}
        action={
          <Button variant="secondary" onClick={() => navigate(BILLING_ROUTES.orders)}>
            Back to orders
          </Button>
        }
      />
    );
  }

  const isPending = order.status === 'pending';
  const nextTarget = nextStatusFor(order.status, isFoodFlow);
  const mayCancel = canCancel(order.status, isFoodFlow);
  const role = currentUser?.role;
  const mayAdvance = nextTarget && role && roleMayTransition(role, nextTarget);
  const mayCancelWithRole = mayCancel && role && roleMayTransition(role, 'cancelled');

  const existingProductIds = new Set(order.items.map((item) => item.productId));

  const addableProducts = (productsQuery.data ?? []).filter((product) => {
    if (product.businessId !== order.businessId) return false;
    const term = addItemSearch.trim().toLowerCase();
    if (!term) return true;
    return product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
  });

  function handleAddProduct(productId: string) {
    const existing = order?.items.find((item) => item.productId === productId);
    const nextQuantity = existing ? Number(existing.quantity) + 1 : 1;
    addItemMutation.mutate({ productId, quantity: String(nextQuantity) });
  }

  function getItemRowActions(item: OrderItem): DataTableRowAction<OrderItem>[] {
    return [
      {
        label: 'Remove item',
        icon: Trash2,
        destructive: true,
        onSelect: () => removeItemMutation.mutate(item.productId),
        disabled: () => removeItemMutation.isPending,
      },
    ];
  }

  // Only the statuses this order has actually reached, in the order the
  // fields appear on the model — `cancelledAt` and `completedAt` never both
  // populate on one order, so this naturally shows one terminal entry or
  // neither if it's still open.
  const timelineSteps = (
    [
      { label: 'Order placed', timestamp: order.createdAt },
      { label: 'Sent to kitchen', timestamp: order.kotFiredAt },
      { label: 'Preparing', timestamp: order.preparingAt },
      { label: 'Ready', timestamp: order.readyAt },
      { label: 'Delivered', timestamp: order.deliveredAt },
      { label: 'Completed', timestamp: order.completedAt },
      { label: 'Cancelled', timestamp: order.cancelledAt },
    ] as { label: string; timestamp: string | null }[]
  ).filter((step): step is { label: string; timestamp: string } => Boolean(step.timestamp));

  return (
    <div>
      <PageHeader
        title={order.tokenNumber ? `Token #${order.tokenNumber}` : order.tableNumber || 'Order'}
        subtitle={`${order.customerName || 'Walk-in'} · ${order.customerPhone} · ${ORDER_TYPE_LABELS[order.orderType]}`}
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<ListOrdered size={16} />}
              onClick={() => navigate(BILLING_ROUTES.orders)}
            >
              Orders overview
            </Button>
            <Badge tone={toneForStatus(order.status)}>{statusLabel(order.status)}</Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Items{order.items.length ? ` (${order.items.length})` : ''}
            </p>
            <DataTable
              columns={itemColumns}
              data={order.items}
              getRowKey={(item) => item.id}
              getSearchValue={(item) => item.name}
              searchPlaceholder="Search items…"
              emptyTitle="No items on this order yet"
              rowActions={isPending ? getItemRowActions : undefined}
              minBodyHeight={200}
            />

            {isPending ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                  Add a product
                </p>
                <div>
                  <SearchInput
                    value={addItemSearch}
                    onChange={(event) => setAddItemSearch(event.target.value)}
                    placeholder="Search products to add…"
                  />
                </div>
                {addableProducts.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-faint">No matching products.</p>
                ) : (
                  <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                    {addableProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddProduct(product.id)}
                        disabled={addItemMutation.isPending}
                        className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:opacity-50"
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">
                            {product.name}
                          </span>
                          {existingProductIds.has(product.id) ? (
                            <Badge tone="accent">In order</Badge>
                          ) : null}
                        </span>
                        <span className="text-sm font-semibold text-brand">
                          ₹{product.sellingPrice}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">Totals</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
                <span>₹{order.taxTotal}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                <span>Total</span>
                <span>₹{order.total}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Order info
            </p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Type</span>
                <span className="font-medium text-ink">{ORDER_TYPE_LABELS[order.orderType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Location</span>
                <span className="truncate pl-2 font-medium text-ink">{order.locationName}</span>
              </div>
              {order.tableNumber ? (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Table</span>
                  <span className="font-medium text-ink">{order.tableNumber}</span>
                </div>
              ) : null}
              {order.tokenNumber ? (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Token</span>
                  <span className="font-medium text-ink">#{order.tokenNumber}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-ink-soft">Placed</span>
                <span className="font-medium text-ink">{formatTimestamp(order.createdAt)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Customer
            </p>
            <div className="flex flex-col gap-1 text-sm text-ink">
              <p className="font-medium">{order.customerName || 'Walk-in'}</p>
              <p className="text-ink-soft">{order.customerPhone}</p>
              {order.customerEmail ? <p className="text-ink-soft">{order.customerEmail}</p> : null}
              {order.customerGstin ? (
                <p className="text-xs text-ink-faint">GSTIN: {order.customerGstin}</p>
              ) : null}
              {order.note ? (
                <p className="mt-2 text-xs text-ink-faint">Note: {order.note}</p>
              ) : null}
            </div>
          </Card>

          {timelineSteps.length > 1 ? (
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Timeline
              </p>
              <div className="flex flex-col gap-2.5">
                {timelineSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{step.label}</span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatTimestamp(step.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {mayAdvance || mayCancelWithRole ? (
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Actions
              </p>
              <div className="flex flex-col gap-2">
                {mayAdvance && nextTarget ? (
                  <Button
                    isLoading={
                      transitionMutation.isPending && transitionMutation.variables === nextTarget
                    }
                    disabled={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate(nextTarget)}
                  >
                    {TRANSITION_ACTION_LABELS[nextTarget]}
                  </Button>
                ) : null}
                {mayCancelWithRole ? (
                  <Button
                    variant="secondary"
                    disabled={transitionMutation.isPending}
                    onClick={() => setPendingCancel(true)}
                  >
                    Cancel order
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={pendingCancel}
        title="Cancel this order?"
        description="This can't be undone — the order moves to Cancelled."
        confirmText="Cancel order"
        isDestructive
        isLoading={transitionMutation.isPending && transitionMutation.variables === 'cancelled'}
        onConfirm={() => transitionMutation.mutate('cancelled')}
        onCancel={() => setPendingCancel(false)}
      />
    </div>
  );
}
