import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, Minus, Plus, Trash2 } from 'lucide-react';

import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  useToast,
} from '@/components';
import { useFillRemainingHeight } from '@/hooks/useFillRemainingHeight';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { describeApiError } from '@/utils/errors';
import { breakpoints } from '@/styles/breakpoints';

import { useAuthStore } from '@/modules/auth';
import { useBusinesses, useLocations } from '@/modules/businesses';
import type { Product } from '@/modules/inventory';
import { useProducts } from '@/modules/inventory';
import { useOrderSettings } from '@/modules/settings';

import { BILLING_ROUTES, ORDER_TYPE_OPTIONS } from '../constants/billing.constants';
import { useAutoSelectSingle } from '../hooks/useAutoSelectSingle';
import { billingService } from '../services/billingService';
import type { Order, OrderStatus } from '../types/billing.types';
import type { OrderCreateFormValues } from '../validations/billing.validation';
import { buildOrderCreateSchema } from '../validations/billing.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

interface CartLine {
  product: Product;
  quantity: number;
}

/**
 * UI-only for now — the backend has no payment-method/amount-tendered field
 * anywhere on `Order` yet (see `billing.types.ts`), so this step just drives
 * the existing `complete` transition; it doesn't persist the method/amount
 * anywhere. Placeholder until the payment concept gets a real schema.
 */
const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
] as const;
type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]['value'];

/** Maps a transition target to the `billingService` call that drives it — same shape `OrderDetailPage` uses. */
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

const KITCHEN_CHAIN: Exclude<OrderStatus, 'pending'>[] = ['kot_fired'];
const DELIVERED_CHAIN: Exclude<OrderStatus, 'pending'>[] = [
  'kot_fired',
  'preparing',
  'ready',
  'delivered',
];
const COMPLETED_FOOD_CHAIN: Exclude<OrderStatus, 'pending'>[] = [
  'kot_fired',
  'preparing',
  'ready',
  'delivered',
  'completed',
];
const COMPLETED_NONFOOD_CHAIN: Exclude<OrderStatus, 'pending'>[] = ['completed'];

/**
 * Fires each transition in `chain` in strict sequence (never in parallel) —
 * the backend's state machine only accepts a target when the order's
 * *current* status is exactly the one step before it
 * (`allowed_from(entity_type, target)` in `apps/billing/constants.py`), so a
 * counter sale that skips the kitchen still has to walk every intermediate
 * status, just back-to-back instead of waiting on the KDS. Returns the last
 * transition's result, since only the final target in a chain can carry the
 * `complete`-only monthly-quota warning.
 */
async function advanceOrder(orderId: string, chain: Exclude<OrderStatus, 'pending'>[]) {
  let result: Awaited<ReturnType<typeof billingService.fireKot>> | undefined;
  for (const target of chain) {
    result = await TARGET_TO_SERVICE_CALL[target](orderId);
  }
  return result as Awaited<ReturnType<typeof billingService.fireKot>>;
}

/** Client-side-only preview of what the order will cost — `sellingPrice` is tax-inclusive, so this is just `quantity × price` summed, not a tax breakdown. The real `subtotal`/`taxTotal`/`total` are always computed and returned by the backend once the order is created. */
function estimateTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * Number(line.product.sellingPrice), 0);
}

/**
 * Full-page POS screen — product picker on the left, running cart +
 * customer form on the right, matching real point-of-sale UX (confirmed via
 * the F6 confirm-first question) rather than a cramped modal.
 *
 * A manager never sees the business/location pickers — the backend always
 * forces their own `assignedLocation` regardless of what's sent, and
 * `useBusinesses`/`useLocations` are `IsTenantAdmin`-gated so a manager
 * can't call them anyway. A tenant_admin picks a business first, which
 * narrows both the location picker and the product list to that business's
 * catalog (`useProducts()` returns everything visible to the actor in one
 * flat list — same "filter client-side" convention `ProductsPage` uses).
 *
 * Creating an order doesn't navigate away: it opens a decision modal (send
 * to the kitchen vs. take payment now) and, once that's resolved, resets the
 * cart/form in place so the next walk-in order can start immediately —
 * matching how a real POS terminal stays on the order screen between sales.
 */
export function NewOrderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const productsQuery = useProducts();

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [productSearch, setProductSearch] = useState('');

  const productGridRef = useRef<HTMLDivElement>(null);
  const productGridHeight = useFillRemainingHeight(productGridRef, { minHeight: 320 });
  // Below `lg` the two "columns" stack into one (see the form's own
  // `grid-cols-1 lg:grid-cols-2`), so filling "the rest of the viewport"
  // for the product grid would eat the whole screen before the cart,
  // customer details, or the submit button ever come into view — a fixed
  // `max-h` + its own scroll instead keeps the grid a reasonably-sized pane
  // the user can browse without losing the rest of the page below it.
  const isDesktopLayout = useMediaQuery(`(min-width: ${breakpoints.lg}px)`);

  // Resolver reads from this ref rather than closing over `orderSettingsQuery.data`
  // directly — `useForm`'s `resolver` identity only needs to stay stable; the ref
  // is kept current by the effect below, so `trigger()`/`handleSubmit()` always
  // validate against whichever business's required-field settings are selected
  // right now, without needing to reconstruct the form on every settings load.
  const requiredFieldsRef = useRef({ nameRequired: true, phoneRequired: true });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrderCreateFormValues>({
    resolver: (values, context, options) =>
      zodResolver(
        buildOrderCreateSchema(
          requiredFieldsRef.current.nameRequired,
          requiredFieldsRef.current.phoneRequired,
        ),
      )(values, context, options),
    defaultValues: { orderType: 'takeaway', businessId: '', locationId: '' },
  });

  const selectedBusinessId = watch('businessId');
  // Table number is a dine-in concept, not a kitchen one — a takeaway/delivery
  // order never has a table, and a business without a kitchen can still seat
  // dine-in customers (e.g. a retail counter with a small seating area).
  const isDineIn = watch('orderType') === 'dine_in';

  const businessOptions = useMemo(
    () =>
      (businessesQuery.data ?? []).map((business) => ({
        value: business.id,
        label: business.name,
      })),
    [businessesQuery.data],
  );

  const filteredLocations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) => !selectedBusinessId || location.businessId === selectedBusinessId,
      ),
    [locationsQuery.data, selectedBusinessId],
  );

  const locationOptions = useMemo(
    () => filteredLocations.map((location) => ({ value: location.id, label: location.name })),
    [filteredLocations],
  );

  // Auto-fill (and, per the Selects' own conditional rendering below, hide)
  // the business/location pickers when there's exactly one option — a
  // tenant_admin with a single business/location never has to touch these.
  useAutoSelectSingle(businessesQuery.data, selectedBusinessId, (id) => setValue('businessId', id));
  useAutoSelectSingle(filteredLocations, watch('locationId'), (id) => setValue('locationId', id));

  // Clear a stray table number left over from a previous dine-in selection —
  // otherwise it'd still submit (and later display) on a takeaway/delivery
  // order even though the field itself is hidden once orderType changes.
  useEffect(() => {
    if (!isDineIn) setValue('tableNumber', '');
  }, [isDineIn, setValue]);

  // Only a tenant_admin has a resolved business before the order exists (a
  // manager's business is implied server-side by their assigned location —
  // see `_scope.resolve_order_context` — with no pre-creation equivalent on
  // the frontend today). Defaults (both required, kitchen fields shown)
  // match the pre-OrderSettings behavior, so a manager's form doesn't change.
  const orderSettingsQuery = useOrderSettings(
    isTenantAdmin ? selectedBusinessId || undefined : undefined,
  );
  const nameRequired = isTenantAdmin ? (orderSettingsQuery.data?.customerNameRequired ?? true) : true;
  const phoneRequired = isTenantAdmin ? (orderSettingsQuery.data?.customerPhoneRequired ?? true) : true;

  useEffect(() => {
    requiredFieldsRef.current = { nameRequired, phoneRequired };
  }, [nameRequired, phoneRequired]);

  const availableProducts = useMemo(() => {
    let products = productsQuery.data ?? [];
    if (isTenantAdmin) {
      if (!selectedBusinessId) return [];
      products = products.filter((product) => product.businessId === selectedBusinessId);
    }
    const term = productSearch.trim().toLowerCase();
    if (term) {
      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term),
      );
    }
    return products;
  }, [productsQuery.data, isTenantAdmin, selectedBusinessId, productSearch]);

  const cartLines = Object.values(cart);
  const estimatedTotal = estimateTotal(cartLines);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: { product, quantity: (existing?.quantity ?? 0) + 1 },
      };
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...prev[productId], quantity } };
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  // The order just created, awaiting the "send to kitchen / take payment"
  // decision — `null` means the modal is closed.
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [paymentStep, setPaymentStep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');

  // Whether the just-created order's business runs the food flow
  // (pending → kot_fired → … ) vs. the non-food flow (pending → completed
  // directly) — read straight off the order (`OrderOutputSerializer`'s
  // `kitchen_enabled`, the business's `OrderSettings.kitchen_enabled` at
  // creation time), same signal `OrderDetailPage` uses. This is what
  // actually decides which of the two actions is valid from `pending`,
  // mirroring `nextStatusFor` in `billing.constants.ts`.
  const isFoodFlow = pendingOrder?.kitchenEnabled ?? false;

  function closeModalAndReset() {
    setPendingOrder(null);
    setPaymentStep(false);
    setPaymentMethod('cash');
    setAmountTendered('');
    setCart({});
    setProductSearch('');
    // Keep the business/location the cashier already had selected — only
    // the customer-specific fields need to clear for the next walk-in order.
    reset({
      orderType: 'takeaway',
      businessId: watch('businessId'),
      locationId: watch('locationId'),
      customerName: '',
      customerPhone: '',
      tableNumber: '',
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: OrderCreateFormValues) =>
      billingService.createOrder({
        businessId: values.businessId || undefined,
        locationId: values.locationId || undefined,
        orderType: values.orderType,
        tableNumber: values.tableNumber || undefined,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: String(line.quantity),
        })),
      }),
    onSuccess: (order) => {
      setPendingOrder(order);
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
    },
  });

  const sendToKitchenMutation = useMutation({
    mutationFn: () => advanceOrder((pendingOrder as Order).id, KITCHEN_CHAIN),
    onSuccess: () => {
      showToast({ tone: 'success', message: 'Order sent to kitchen.' });
      closeModalAndReset();
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  // For a counter item that never really needs kitchen prep — walks the full
  // food-flow chain (kot_fired → preparing → ready → delivered) back-to-back
  // instead of waiting on the KDS, since the backend's state machine only
  // ever accepts one step at a time (no skipping straight to `delivered`).
  const markDeliveredMutation = useMutation({
    mutationFn: () => advanceOrder((pendingOrder as Order).id, DELIVERED_CHAIN),
    onSuccess: () => {
      showToast({ tone: 'success', message: 'Order marked delivered.' });
      closeModalAndReset();
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const completePaymentMutation = useMutation({
    mutationFn: () =>
      advanceOrder(
        (pendingOrder as Order).id,
        isFoodFlow ? COMPLETED_FOOD_CHAIN : COMPLETED_NONFOOD_CHAIN,
      ),
    onSuccess: ({ warning }) => {
      showToast({
        tone: warning ? 'warning' : 'success',
        message: warning ?? 'Payment recorded — order completed.',
      });
      closeModalAndReset();
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const anyDecisionPending =
    sendToKitchenMutation.isPending ||
    markDeliveredMutation.isPending ||
    completePaymentMutation.isPending;

  const changeDue = pendingOrder
    ? Math.max(0, Number(amountTendered || 0) - Number(pendingOrder.total))
    : 0;

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        title="New order"
        subtitle="Pick items and enter the customer's details"
        actions={
          <Button
            variant="secondary"
            leadingIcon={<ListOrdered size={16} />}
            onClick={() => navigate(BILLING_ROUTES.orders)}
          >
            Orders overview
          </Button>
        }
      />

      <form
        id="new-order-form"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <div className="flex min-w-0 flex-col gap-4">
          {isTenantAdmin && (businessOptions.length > 1 || locationOptions.length > 1) ? (
            <Card>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {businessOptions.length > 1 ? (
                  <Controller
                    name="businessId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Business"
                        placeholder="Select a business"
                        options={businessOptions}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        disabled={businessesQuery.isLoading}
                      />
                    )}
                  />
                ) : null}
                {locationOptions.length > 1 ? (
                  <Controller
                    name="locationId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Location"
                        placeholder="Select a location"
                        options={locationOptions}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        disabled={!selectedBusinessId}
                      />
                    )}
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card className="flex min-h-0 flex-1 flex-col">
            {/* Plain block wrapper, not a flex item — `SearchInput`'s own
                root div ships `flex-1` for its usual row layouts, and inside
                a column flex container (this Card) that stretches it
                vertically to fill the whole card instead of staying a
                normal-height search bar. */}
            <div className="mb-3 shrink-0">
              <SearchInput
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products by name or SKU…"
              />
            </div>
            {isTenantAdmin && !selectedBusinessId ? (
              <EmptyState
                title="Select a business"
                description="Pick a business above to see its products."
              />
            ) : availableProducts.length === 0 ? (
              <EmptyState
                title="No products found"
                description={
                  productSearch
                    ? 'Try a different search term.'
                    : 'This business has no products yet.'
                }
              />
            ) : (
              <div
                ref={productGridRef}
                style={isDesktopLayout ? { height: productGridHeight } : undefined}
                className="grid max-h-[45vh] grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:max-h-none"
              >
                {availableProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {product.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand">
                        ₹{product.sellingPrice}
                      </span>
                    </span>
                    <span className="text-xs text-ink-faint">{product.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex min-h-[220px] flex-col">
            <p className="mb-3 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Cart
            </p>
            {cartLines.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-center text-xs text-ink-faint">
                No items yet — add products from the list on the left.
              </p>
            ) : (
              <>
                <div className="max-h-[360px] flex-1 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-3">
                    {cartLines.map((line) => (
                      <div key={line.product.id} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {line.product.name}
                          </p>
                          <p className="text-xs text-ink-faint">
                            ₹{line.product.sellingPrice} × {line.quantity} = ₹
                            {(line.quantity * Number(line.product.sellingPrice)).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center text-xs font-semibold">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from cart"
                            onClick={() => removeFromCart(line.product.id)}
                            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-danger-bg hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border pt-3 text-sm font-semibold text-ink">
                  <span>Estimated total</span>
                  <span>₹{estimatedTotal.toFixed(2)}</span>
                </div>
              </>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Customer & order details
            </p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={nameRequired ? 'Customer name' : 'Customer name (optional)'}
                  placeholder="Walk-in customer"
                  {...register('customerName')}
                  errorMessage={errors.customerName?.message}
                />
                <Input
                  label={phoneRequired ? 'Phone' : 'Phone (optional)'}
                  placeholder="9876543210"
                  {...register('customerPhone')}
                  errorMessage={errors.customerPhone?.message}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  name="orderType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Order type"
                      options={ORDER_TYPE_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
                {isDineIn ? (
                  <Input label="Table number (optional)" {...register('tableNumber')} />
                ) : null}
              </div>
            </div>
          </Card>

          {/* Fixed (not sticky) below `lg` so the submit action stays
              reachable without scrolling past the cart/customer-details
              cards above it — `position: sticky` only clamps to the
              viewport edge once the page has scrolled *past* this element's
              normal position, so on a page barely taller than one screen it
              would render mid-content instead of waiting below the fold.
              `fixed` always pins it; the page's own `pb-24` (root wrapper,
              cleared again at `lg`) reserves the matching space so it never
              overlaps real content. At `lg` this collapses back to a plain
              in-flow button (matches the side-by-side desktop layout, where
              it's already on-screen). */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 sm:px-6 lg:static lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
            <Button
              type="submit"
              size="lg"
              isLoading={createMutation.isPending}
              disabled={cartLines.length === 0}
            >
              {cartLines.length > 0 ? `Create order · ₹${estimatedTotal.toFixed(2)}` : 'Create order'}
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={pendingOrder !== null}
        onOpenChange={(open) => {
          if (!open) closeModalAndReset();
        }}
        title={paymentStep ? 'Take payment' : 'Order created'}
        description={
          paymentStep
            ? `Total due ₹${pendingOrder?.total ?? '0'}`
            : isFoodFlow
              ? 'Send it to the kitchen, or skip straight to delivered/completed for a counter item that needs no prep.'
              : 'Take payment to complete this order.'
        }
        size="sm"
        footer={
          paymentStep ? (
            <>
              <Button variant="secondary" onClick={() => setPaymentStep(false)}>
                Back
              </Button>
              <Button
                isLoading={completePaymentMutation.isPending}
                onClick={() => completePaymentMutation.mutate()}
              >
                Confirm payment
              </Button>
            </>
          ) : isFoodFlow ? (
            <div className="flex w-full flex-col gap-2">
              <Button
                isLoading={sendToKitchenMutation.isPending}
                disabled={anyDecisionPending}
                onClick={() => sendToKitchenMutation.mutate()}
              >
                Send to kitchen
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  isLoading={markDeliveredMutation.isPending}
                  disabled={anyDecisionPending}
                  onClick={() => markDeliveredMutation.mutate()}
                >
                  Delivered
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={anyDecisionPending}
                  onClick={() => setPaymentStep(true)}
                >
                  Completed
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setPaymentStep(true)}>Take payment</Button>
          )
        }
      >
        {paymentStep ? (
          <div className="flex flex-col gap-4">
            <Select
              label="Payment method"
              options={[...PAYMENT_METHOD_OPTIONS]}
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as PaymentMethod)}
            />
            <Input
              label="Amount received"
              type="number"
              inputMode="decimal"
              value={amountTendered}
              onChange={(event) => setAmountTendered(event.target.value)}
              placeholder={pendingOrder?.total}
            />
            {amountTendered ? (
              <p className="text-sm text-ink-soft">
                Change due: <span className="font-semibold text-ink">₹{changeDue.toFixed(2)}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-sm text-ink-soft">
            <p>
              Order for{' '}
              <span className="font-semibold text-ink">
                {pendingOrder?.customerName || 'Walk-in customer'}
              </span>{' '}
              is open.
            </p>
            <p>
              Total: <span className="font-semibold text-ink">₹{pendingOrder?.total}</span>
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
