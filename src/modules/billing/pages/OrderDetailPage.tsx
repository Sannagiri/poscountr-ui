import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Eye,
  FileText,
  History,
  IndianRupee,
  ListOrdered,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Trash2,
  User,
  Zap,
} from 'lucide-react';

import type { AddAdhocLineValues, DataTableColumn } from '@/components';
import {
  AddAdhocLineModal,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Loader,
  Modal,
  PageHeader,
  SearchInput,
  SectionCard,
  Switch,
  useToast,
  WayBillUpload,
} from '@/components';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { cn } from '@/utils/cn';
import { formatTimestamp } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';
import { categoricalPalette, colors } from '@/styles/colors';

import { useAuthStore } from '@/modules/auth';
import type { Product } from '@/modules/inventory';
import {
  getAvailableStock,
  getStockLabel,
  getStockTone,
  inventoryService,
  useProducts,
} from '@/modules/inventory';
import { TerminalPaymentPanel } from '@/modules/paymentTerminals';

import { OrderBillPreviewModal } from '../components/OrderBillPreviewModal';
import { PaymentMethodGrid } from '../components/PaymentMethodGrid';
import {
  BILLING_QUERY_KEYS,
  BILLING_ROUTES,
  canCancel,
  nextStatusFor,
  ORDER_TYPE_OPTIONS,
  roleMayTransition,
  TRANSITION_ACTION_LABELS,
} from '../constants/billing.constants';
import { useOrder } from '../hooks/useOrder';
import { useOrderBill } from '../hooks/useOrderBill';
import { billingService } from '../services/billingService';
import type {
  Order,
  OrderItem,
  OrderItemRequest,
  OrderStatus,
  PaymentMethod,
  PaymentMethodSelection,
} from '../types/billing.types';
import { PHONE_REGEX } from '../validations/billing.validation';

import { useMutation, useQueryClient } from '@tanstack/react-query';

const ORDER_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/** One accent hue per section card, pulled from the app's validated categorical palette so every section reads as a distinct block instead of a wall of identical white cards. */
const SECTION_ACCENT = {
  orderDetails: categoricalPalette[0], // blue
  customer: categoricalPalette[6], // violet
  items: colors.brand.DEFAULT, // brand orange
  actions: categoricalPalette[2], // aqua
  totals: colors.success.DEFAULT, // green
  wayBill: categoricalPalette[3], // yellow
  timeline: categoricalPalette[4], // magenta
} as const;

const TIMELINE_STEP_COLOR: Record<string, string> = {
  'Order placed': colors.ink.faint,
  'Sent to kitchen': colors.accent.DEFAULT,
  Preparing: colors.accent.DEFAULT,
  Ready: colors.success.DEFAULT,
  Delivered: colors.success.DEFAULT,
  Completed: colors.success.DEFAULT,
  Cancelled: colors.danger.DEFAULT,
};

/** Maps a transition target to the `billingService` method that drives it. `completed` is handled separately below since it's the one transition that needs a payment method. */
const TARGET_TO_SERVICE_CALL: Record<
  Exclude<OrderStatus, 'pending' | 'completed'>,
  (orderId: string) => ReturnType<typeof billingService.fireKot>
> = {
  kot_fired: billingService.fireKot,
  preparing: billingService.setPreparing,
  ready: billingService.setReady,
  delivered: billingService.deliver,
  cancelled: billingService.cancel,
};

/** Strips the decimal-string's fixed 3-place padding for display — `"1.000"` reads as `"1"`, `"2.500"` as `"2.5"` — same rounding + trim `inventory.constants.ts`'s own `formatQuantity` uses, so a summed float artifact (`"1.0000000000002"`) doesn't leak through either. */
function formatQuantity(quantity: string): string {
  const num = Number(quantity);
  if (!Number.isFinite(num)) return quantity;
  return num.toFixed(3).replace(/\.?0+$/, '') || '0';
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
 * Items can only be added/removed before preparation starts (`pending` or,
 * for a kitchen-enabled order, `kot_fired`) — the backend rejects both
 * endpoints otherwise.
 */
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);

  // Backs the "Terminal" tile on PaymentMethodGrid specifically — see
  // TerminalPaymentPanel's own doc comment on why this page (not that
  // component) owns the order-polling.
  const [pollTerminalPayment, setPollTerminalPayment] = useState(false);

  const orderQuery = useOrder(orderId, { poll: pollTerminalPayment });
  const order = orderQuery.data;
  // This order's location is fixed (set at creation) — the effective,
  // location-resolved price/discount for a product being added here should
  // reflect that location's own overrides, same as `NewOrderPage`. Waits
  // for the order to load rather than firing once unscoped and once
  // location-scoped a moment later.
  const productsQuery = useProducts(order?.locationId, { enabled: Boolean(order) });
  const { ensureBillUploaded, printBill } = useOrderBill();
  const [isPrintingBill, setIsPrintingBill] = useState(false);

  async function handlePrintBill() {
    if (!order) return;
    setIsPrintingBill(true);
    try {
      await printBill(order);
    } catch (error) {
      showToast({ tone: 'danger', message: describeApiError(error) });
    } finally {
      setIsPrintingBill(false);
    }
  }
  // Cross-references an already-placed line's `productId` against this same
  // fetch's stock numbers — `OrderItem` itself carries no stock field (it's
  // a server-echoed price/qty snapshot), so this is the only way to flag a
  // line that now exceeds on-hand stock (e.g. it was added before a stock
  // adjustment/another order ate into it).
  const productById = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  );

  const [addItemSearch, setAddItemSearch] = useState('');
  const [adhocModalOpen, setAdhocModalOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  // Completion needs a payment method (+ optional discount) before it can
  // fire — a lightweight modal step, same shape as the cancel confirmation
  // below, rather than completing immediately like the other transitions.
  // Discounts aren't asked here — they're set earlier, while the order was
  // being built (order-level at creation, per-line when a line was added).
  const [pendingComplete, setPendingComplete] = useState(false);
  // "Terminal" is one more tile on PaymentMethodGrid, not a separate mode
  // picker — see PaymentMethodSelection's own doc comment.
  const [completionPaymentMethod, setCompletionPaymentMethod] =
    useState<PaymentMethodSelection>('cash');
  // Editable, not just a read-only "amount to collect" line — the actual amount handed over can
  // differ from the order total (a goodwill discount given verbally, a friends/family price),
  // same reasoning New Order's own amount-received field already applies. Purely a cashier UX
  // aid (change-due math) — never sent to the completion API, which only takes payment_method.
  const [completionAmountTendered, setCompletionAmountTendered] = useState('');
  // No phone on the order (a walk-in without `customerPhoneRequired`) — ask
  // for one right here instead of sending nowhere. Cancelling/leaving it
  // blank sends nothing, per how this was asked for — no fallback, no retry.
  const [whatsappPhonePrompt, setWhatsappPhonePrompt] = useState(false);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState('');
  const [whatsappPhoneError, setWhatsappPhoneError] = useState<string | null>(null);

  const isFoodFlow = order?.kitchenEnabled ?? false;

  function invalidateOrder() {
    queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.order(orderId ?? '') });
    queryClient.invalidateQueries({ queryKey: ['billing', 'orders'] });
  }

  const transitionMutation = useMutation({
    // The 'completed' branch is only reachable via "Confirm payment", itself
    // only rendered while `completionPaymentMethod !== 'terminal'` — the
    // cast just reflects that at the type level.
    mutationFn: (target: Exclude<OrderStatus, 'pending'>) =>
      target === 'completed'
        ? billingService.complete(orderId as string, completionPaymentMethod as PaymentMethod)
        : TARGET_TO_SERVICE_CALL[target](orderId as string),
    onSuccess: ({ order: updatedOrder, warning, invoice }, target) => {
      invalidateOrder();
      setPendingCancel(false);
      setPendingComplete(false);
      showToast({ tone: warning ? 'warning' : 'success', message: warning ?? 'Order updated.' });
      // Fire-and-forget, no browser download popup — just makes sure the
      // PDF exists in S3 (for "Preview bill" reprints and the WhatsApp send
      // button below, both of which need it). The order is already
      // completed regardless of whether this succeeds, so a failure here
      // gets its own toast rather than looking like the completion failed.
      if (target === 'completed') {
        ensureBillUploaded(updatedOrder, invoice).catch((error) =>
          showToast({
            tone: 'warning',
            message: `Bill not saved yet. (${describeApiError(error)})`,
          }),
        );
      }
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingCancel(false);
      setPendingComplete(false);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (request: OrderItemRequest) => billingService.addItem(orderId as string, request),
    onSuccess: invalidateOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const setApplyGstMutation = useMutation({
    mutationFn: (applyGst: boolean) => billingService.setApplyGst(orderId as string, applyGst),
    onSuccess: invalidateOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  // Scan-to-cart: same `handleAddProduct` a manual tile click already goes
  // through, so the add-item mutation/backend path above is untouched.
  // Hooks must run unconditionally on every render (this component has an
  // early return below for the loading/not-found states), so `order` is
  // read defensively here via optional chaining rather than relying on
  // `canEditItems`, which isn't computed until after that early return.
  // `order.businessId` scopes the lookup unambiguously — unlike New Order,
  // this screen is always working within one already-fixed order/business.
  useBarcodeScanner({
    enabled: order?.status === 'pending' || order?.status === 'kot_fired',
    onScan: async (code) => {
      if (!order) return;
      try {
        const product = await inventoryService.lookupProductByCode(code, order.businessId);
        handleAddProduct(product);
      } catch (error) {
        showToast({ tone: 'danger', message: describeApiError(error) });
      }
    },
  });

  /**
   * Client-side `wa.me` deep link, not a real WhatsApp Business API send —
   * this tenant has no WhatsApp Business API account/credentials configured
   * anywhere in the app, so there's nothing to call server-side yet. This
   * opens WhatsApp (app or web) with the customer's chat pre-filled with a
   * link to the bill PDF; the staff member still taps Send themselves.
   * `ensureBillUploaded` guarantees the invoice has a real `pdfUrl` first —
   * it's usually already there from completion, but re-runs safely
   * (idempotent) if that upload hasn't finished yet or this page was
   * reloaded.
   *
   * The tab is opened *synchronously* in the click handler, before any
   * `await` — opening it inside the async `mutationFn` instead gets it
   * silently killed by the browser's popup blocker, since by the time the
   * upload/generate call resolves the click is no longer a "fresh" user
   * gesture as far as the browser's concerned.
   */
  const sendWhatsappMutation = useMutation({
    mutationFn: async ({ phone, tab }: { phone: string; tab: Window | null }) => {
      const invoice = await ensureBillUploaded(order as Order);
      const message = `Hi${order?.customerName ? ` ${order.customerName}` : ''}, here's your bill: ${invoice.pdfUrl}`;
      const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    },
    onError: (error, { tab }) => {
      tab?.close();
      showToast({ tone: 'danger', message: describeApiError(error) });
    },
  });

  function openWhatsapp(phone: string) {
    sendWhatsappMutation.mutate({ phone, tab: window.open('', '_blank') });
  }

  function handleSendWhatsapp() {
    if (!order) return;
    if (PHONE_REGEX.test(order.customerPhone)) {
      openWhatsapp(order.customerPhone);
      return;
    }
    setWhatsappPhoneInput('');
    setWhatsappPhoneError(null);
    setWhatsappPhonePrompt(true);
  }

  function submitWhatsappPhonePrompt() {
    if (!PHONE_REGEX.test(whatsappPhoneInput)) {
      setWhatsappPhoneError('A 10-digit number starting 6-9');
      return;
    }
    setWhatsappPhonePrompt(false);
    openWhatsapp(whatsappPhoneInput);
  }

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.removeItem(orderId as string, itemId),
    onSuccess: invalidateOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const uploadWayBillMutation = useMutation({
    mutationFn: (file: File) => billingService.uploadWayBill(orderId as string, file),
    onSuccess: () => {
      invalidateOrder();
      showToast({ tone: 'success', message: 'Way-bill uploaded.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const removeWayBillMutation = useMutation({
    mutationFn: () => billingService.removeWayBill(orderId as string),
    onSuccess: () => {
      invalidateOrder();
      showToast({ tone: 'success', message: 'Way-bill removed.' });
    },
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
        width: '110px',
        render: (item) => {
          const product = item.productId ? productById.get(item.productId) : undefined;
          const available = product ? getAvailableStock(product, order?.locationId) : null;
          const short = available !== null && Number(item.quantity) > available;
          return (
            <span className="flex flex-col">
              <span className={short ? 'font-semibold text-danger' : undefined}>
                {formatQuantity(item.quantity)}
              </span>
              {short ? (
                <span className="text-[10px] font-medium text-danger">
                  Only {available} in stock
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        key: 'unitPrice',
        header: 'Price',
        width: '90px',
        render: (item) => `₹${item.unitPrice}`,
      },
      {
        key: 'tax',
        header: 'Tax %',
        width: '70px',
        render: (item) => {
          const rate = Number(item.gstRate);
          if (!rate) return '—';
          return String(Math.round(rate));
        },
      },
      {
        key: 'discountPercent',
        header: 'Discount',
        width: '80px',
        render: (item) => {
          const percent = Number(item.discountPercent);
          if (!percent) return '—';
          return <span className="text-danger">-{percent}%</span>;
        },
      },
      {
        key: 'lineTotal',
        header: 'Total',
        width: '90px',
        render: (item) => <span className="font-semibold text-ink">₹{item.lineTotal}</span>,
      },
    ],
    [productById, order?.locationId],
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

  // Editable up to (and including) the kitchen receiving the ticket, but not
  // once prep has actually started — mirrors the backend's
  // OrderService._assert_editable. A non-food order never reaches
  // kot_fired at all, so for that flow this is equivalent to "pending only".
  const canEditItems = order.status === 'pending' || order.status === 'kot_fired';
  const nextTarget = nextStatusFor(order.status, isFoodFlow);
  const mayCancel = canCancel(order.status, isFoodFlow);
  const role = currentUser?.role;
  const mayAdvance = nextTarget && role && roleMayTransition(role, nextTarget);
  const mayCancelWithRole = mayCancel && role && roleMayTransition(role, 'cancelled');

  const existingProductIds = new Set(order.items.map((item) => item.productId));
  // `order.total` already reflects every discount (item-level + order-level)
  // — both were set while the order was being built, nothing left to net out.
  const completionAmountToCollect = Number(order.total);
  const completionChangeDue = Math.max(
    0,
    Number(completionAmountTendered || 0) - completionAmountToCollect,
  );

  function openCompleteModal() {
    if (!order) return;
    setCompletionAmountTendered(order.total);
    setCompletionPaymentMethod('cash');
    setPollTerminalPayment(false);
    setPendingComplete(true);
  }

  const addableProducts = (productsQuery.data ?? []).filter((product) => {
    if (product.businessId !== order.businessId) return false;
    const term = addItemSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      (product.barcode ?? '').toLowerCase().includes(term)
    );
  });

  function handleAddProduct(product: Product) {
    const existing = order?.items.find((item) => item.productId === product.id);
    const nextQuantity = existing ? Number(existing.quantity) + 1 : 1;
    // Client-side heads-up, not a replacement for the backend's own check
    // (`OrderService._upsert_item` now rejects this too) — this just avoids
    // a round-trip for the common case, and gives a friendlier message.
    const available = getAvailableStock(product, order?.locationId);
    if (available !== null && nextQuantity > available) {
      showToast({
        tone: available <= 0 ? 'danger' : 'warning',
        message:
          available <= 0
            ? `'${product.name}' is out of stock at this location.`
            : `Only ${available} of '${product.name}' in stock.`,
      });
      return;
    }
    // Bumping an already-added line's quantity re-sends its *current*
    // discount (the backend's `_upsert_item` always overwrites
    // `discount_percent` from whatever's sent, even on an existing line) —
    // only a brand-new line falls back to this location's effective
    // default (the product's own, or an override for this order's location).
    const discountPercent = existing ? existing.discountPercent : product.effectiveDiscountPercent;
    addItemMutation.mutate({
      productId: product.id,
      quantity: String(nextQuantity),
      discountPercent,
    });
  }

  function handleAddAdhocLine(values: AddAdhocLineValues) {
    addItemMutation.mutate(
      {
        name: values.name,
        unitPrice: values.price,
        quantity: values.quantity,
        gstRate: values.gstRate || undefined,
        discountPercent: values.discountPercent || undefined,
      },
      { onSuccess: () => setAdhocModalOpen(false) },
    );
  }

  // Only ever one action on an item line (remove), so it's a direct icon
  // button in its own column instead of a "⋮" menu with a single entry.
  const itemColumnsForDisplay: DataTableColumn<OrderItem>[] = canEditItems
    ? [
        ...itemColumns,
        {
          key: 'remove',
          header: '',
          width: '52px',
          align: 'center',
          render: (item) => (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove item"
              leadingIcon={<Trash2 size={14} className="text-danger" />}
              isLoading={removeItemMutation.isPending && removeItemMutation.variables === item.id}
              onClick={() => removeItemMutation.mutate(item.id)}
            />
          ),
        },
      ]
    : itemColumns;

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

  const addProductSection = canEditItems ? (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-1.5">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: SECTION_ACCENT.items }}
        >
          <Plus size={10} />
        </span>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Add a product</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={addItemSearch}
            onChange={(event) => setAddItemSearch(event.target.value)}
            placeholder="Search products to add…"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 shrink-0"
          onClick={() => setAdhocModalOpen(true)}
        >
          + Custom line
        </Button>
      </div>
      {addableProducts.length === 0 ? (
        <p className="mt-3 text-xs text-ink-faint">No matching products.</p>
      ) : (
        <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
          {addableProducts.map((product) => {
            const stockLabel = getStockLabel(product, order.locationId);
            const outOfStock = getAvailableStock(product, order.locationId) === 0;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => handleAddProduct(product)}
                disabled={addItemMutation.isPending || outOfStock}
                className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{product.name}</span>
                  {existingProductIds.has(product.id) ? (
                    <Badge tone="accent">In order</Badge>
                  ) : null}
                </span>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brand">
                    ₹{product.effectiveSellingPrice}
                  </span>
                  {stockLabel ? (
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-medium',
                        getStockTone(product, order.locationId) === 'danger' && 'text-danger',
                        getStockTone(product, order.locationId) === 'warning' &&
                          'text-warning-text',
                        getStockTone(product, order.locationId) === 'faint' && 'text-ink-faint',
                      )}
                    >
                      {stockLabel}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  const itemsTable = (
    <DataTable
      columns={itemColumnsForDisplay}
      data={order.items}
      getRowKey={(item) => item.id}
      getSearchValue={(item) => item.name}
      searchPlaceholder="Search items…"
      emptyTitle="No items on this order yet"
      maxBodyHeight={320}
    />
  );

  const actionButtons = (
    <>
      {mayAdvance && nextTarget ? (
        <Button
          isLoading={transitionMutation.isPending && transitionMutation.variables === nextTarget}
          disabled={transitionMutation.isPending}
          onClick={() =>
            nextTarget === 'completed' ? openCompleteModal() : transitionMutation.mutate(nextTarget)
          }
        >
          {TRANSITION_ACTION_LABELS[nextTarget]}
        </Button>
      ) : null}
      {/* Available at every status, not just `completed` —
          `useOrderBill.ts`'s `previewBill` falls back to a
          never-persisted draft preview (real GST split, no real
          invoice number burned) for anything short of completed,
          so there's no need to wait for the order to finish
          before seeing/printing what the bill will look like. */}
      <Button
        variant="secondary"
        leadingIcon={<Eye size={16} />}
        onClick={() => setShowBillPreview(true)}
      >
        Preview bill
      </Button>
      <Button
        variant="secondary"
        leadingIcon={<Printer size={16} />}
        isLoading={isPrintingBill}
        onClick={handlePrintBill}
      >
        Print bill
      </Button>
      {order.status === 'completed' ? (
        <Button
          variant="secondary"
          leadingIcon={<MessageCircle size={16} />}
          isLoading={sendWhatsappMutation.isPending}
          onClick={handleSendWhatsapp}
        >
          Send via WhatsApp
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
    </>
  );
  const showActionsCard = mayAdvance || mayCancelWithRole || order.status === 'completed';

  const gstToggle = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-ink-soft">Apply GST</span>
      <Switch
        size="sm"
        checked={order.applyGst}
        disabled={!canEditItems || setApplyGstMutation.isPending}
        onCheckedChange={(checked) => setApplyGstMutation.mutate(checked)}
        label="Apply GST"
      />
    </div>
  );
  const totalsBreakdown = (
    <>
      <div className="flex justify-between text-ink-soft">
        <span>Subtotal</span>
        <span>₹{order.subtotal}</span>
      </div>
      {Number(order.discountPercent) > 0 ? (
        <div className="flex justify-between text-danger">
          <span>Order discount ({order.discountPercent}%)</span>
          <span>-₹{order.discountAmount}</span>
        </div>
      ) : null}
      <div className="flex justify-between text-ink-soft">
        <span>Tax</span>
        <span>₹{order.taxTotal}</span>
      </div>
    </>
  );

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
          {/*
            Order info (left) / Customer (right) — the same "document
            details" / "who it's for" pairing PurchaseOrderDetailPage uses
            for Supplier/PO info, shown above the items rather than tucked
            into the sidebar. Confined to this column's own width (not the
            full page) so it doesn't crowd out the sidebar beside it.
          */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard
              title="Order details"
              icon={<Receipt size={16} />}
              accent={SECTION_ACCENT.orderDetails}
            >
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Order #</span>
                  <span className="font-medium text-ink">{order.orderNumber ?? '—'}</span>
                </div>
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
            </SectionCard>

            <SectionCard
              title="Customer"
              icon={<User size={16} />}
              accent={SECTION_ACCENT.customer}
            >
              <div className="flex flex-col gap-1 text-sm text-ink">
                <p className="font-medium">{order.customerName || 'Walk-in'}</p>
                <p className="text-ink-soft">{order.customerPhone}</p>
                {order.customerEmail ? (
                  <p className="text-ink-soft">{order.customerEmail}</p>
                ) : null}
                {order.customerGstin ? (
                  <p className="text-xs text-ink-faint">GSTIN: {order.customerGstin}</p>
                ) : null}
                {order.note ? (
                  <p className="mt-2 text-xs text-ink-faint">Note: {order.note}</p>
                ) : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title={`Items${order.items.length ? ` (${order.items.length})` : ''}`}
            icon={<Receipt size={16} />}
            accent={SECTION_ACCENT.items}
          >
            {itemsTable}
            {addProductSection}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          {showActionsCard ? (
            <SectionCard title="Actions" icon={<Zap size={16} />} accent={SECTION_ACCENT.actions}>
              <div className="flex flex-col gap-2">{actionButtons}</div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Totals"
            icon={<IndianRupee size={16} />}
            accent={SECTION_ACCENT.totals}
          >
            <div className="flex flex-col gap-1.5 text-sm">
              {gstToggle}
              {totalsBreakdown}
              <div
                className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ backgroundColor: `${SECTION_ACCENT.totals}1a` }}
              >
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="text-lg font-extrabold" style={{ color: SECTION_ACCENT.totals }}>
                  ₹{order.total}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Way-bill"
            icon={<FileText size={16} />}
            accent={SECTION_ACCENT.wayBill}
          >
            <WayBillUpload
              url={order.wayBillUrl}
              uploadedAt={order.wayBillUploadedAt}
              onUpload={(file) => uploadWayBillMutation.mutateAsync(file)}
              onRemove={() => removeWayBillMutation.mutateAsync()}
            />
          </SectionCard>

          {timelineSteps.length > 1 ? (
            <SectionCard
              title="Timeline"
              icon={<History size={16} />}
              accent={SECTION_ACCENT.timeline}
            >
              <div className="flex flex-col">
                {timelineSteps.map((step, index) => (
                  <div key={step.label} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: TIMELINE_STEP_COLOR[step.label] ?? colors.ink.faint,
                          boxShadow: `0 0 0 4px ${TIMELINE_STEP_COLOR[step.label] ?? colors.ink.faint}1a`,
                        }}
                      />
                      {index < timelineSteps.length - 1 ? (
                        <span className="w-px flex-1 bg-border" />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pb-3">
                      <span className="text-sm font-medium text-ink">{step.label}</span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatTimestamp(step.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
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

      <Modal
        open={pendingComplete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingComplete(false);
            setPollTerminalPayment(false);
          }
        }}
        title="Complete order"
        description={`Amount to collect: ₹${completionAmountToCollect.toFixed(2)}`}
        size={completionPaymentMethod === 'terminal' ? 'md' : 'sm'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingComplete(false)}>
              Back
            </Button>
            {completionPaymentMethod !== 'terminal' ? (
              <Button
                isLoading={
                  transitionMutation.isPending && transitionMutation.variables === 'completed'
                }
                onClick={() => transitionMutation.mutate('completed')}
              >
                Confirm payment
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <PaymentMethodGrid
            value={completionPaymentMethod}
            onChange={setCompletionPaymentMethod}
          />
          {completionPaymentMethod === 'terminal' ? (
            <TerminalPaymentPanel
              orderId={order.id}
              amount={order.total}
              isCompleted={order.status === 'completed'}
              onInitiated={() => setPollTerminalPayment(true)}
              onCompleted={() => {
                invalidateOrder();
                setPendingComplete(false);
                setPollTerminalPayment(false);
                showToast({ tone: 'success', message: 'Payment recorded — order completed.' });
              }}
              onCancel={() => {
                setPollTerminalPayment(false);
                setCompletionPaymentMethod('cash');
              }}
            />
          ) : (
            <>
              <Input
                label="Amount received"
                type="number"
                inputMode="decimal"
                value={completionAmountTendered}
                onChange={(event) => setCompletionAmountTendered(event.target.value)}
                placeholder={completionAmountToCollect.toFixed(2)}
              />
              {completionAmountTendered ? (
                <p className="text-sm text-ink-soft">
                  Change due:{' '}
                  <span className="font-semibold text-ink">₹{completionChangeDue.toFixed(2)}</span>
                </p>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      <OrderBillPreviewModal
        order={showBillPreview ? order : null}
        onClose={() => setShowBillPreview(false)}
      />

      <AddAdhocLineModal
        open={adhocModalOpen}
        onClose={() => setAdhocModalOpen(false)}
        priceLabel="Unit price"
        onSubmit={handleAddAdhocLine}
        isSubmitting={addItemMutation.isPending}
        error={addItemMutation.error ? describeApiError(addItemMutation.error) : null}
      />

      <Modal
        open={whatsappPhonePrompt}
        onOpenChange={(open) => {
          if (!open) setWhatsappPhonePrompt(false);
        }}
        title="Send bill via WhatsApp"
        description="This order has no phone number on file — enter one to send the bill to."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWhatsappPhonePrompt(false)}>
              Cancel
            </Button>
            <Button onClick={submitWhatsappPhonePrompt}>Send</Button>
          </>
        }
      >
        <Input
          label="Customer phone number"
          placeholder="9876543210"
          value={whatsappPhoneInput}
          onChange={(event) => setWhatsappPhoneInput(event.target.value)}
          errorMessage={whatsappPhoneError ?? undefined}
        />
      </Modal>
    </div>
  );
}
