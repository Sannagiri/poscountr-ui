import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, MapPin, Minus, Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Switch,
  useToast,
} from '@/components';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useFillRemainingHeight } from '@/hooks/useFillRemainingHeight';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';
import { preventNumberInputScroll } from '@/utils/numberInputScroll';
import { getSessionMemory, setSessionMemory } from '@/utils/sessionMemory';
import { breakpoints } from '@/styles/breakpoints';

import { useAuthStore } from '@/modules/auth';
import { useBusinesses, useLocations } from '@/modules/businesses';
import type { Product } from '@/modules/inventory';
import {
  getAvailableStock,
  getStockLabel,
  getStockTone,
  inventoryService,
  useProducts,
} from '@/modules/inventory';
import { useOrderSettings } from '@/modules/settings';
import type { Table } from '@/modules/tables';
import { TableSelectScreen } from '@/modules/tables';

import {
  BILLING_ROUTES,
  ORDER_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from '../constants/billing.constants';
import { useAutoSelectSingle } from '../hooks/useAutoSelectSingle';
import { billingService } from '../services/billingService';
import type {
  OfflineOrderSyncRequest,
  Order,
  OrderStatus,
  PaymentMethod,
} from '../types/billing.types';
import type { OrderCreateFormValues } from '../validations/billing.validation';
import { buildOrderCreateSchema } from '../validations/billing.validation';

import { notifyQueueChanged, offlineDb } from '@/offline/db';
import { runSync } from '@/offline/syncEngine';
import { usePendingOrderCount } from '@/offline/usePendingOrderCount';
import { ApiError } from '@/types/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CartLine {
  product: Product;
  quantity: number;
  /** This line's own discount (0-100), layered under the order-level discount below — set inline in the cart, defaults to 0. */
  discountPercent: number;
}

/**
 * Remembers the business/location/order-type picks across navigating away
 * from and back to this page (e.g. checking the Orders list mid-sale) — not
 * the cart or customer name/phone, which shouldn't carry over into an
 * unrelated order. Resets on an actual browser reload, same as
 * `DataTable`'s persisted filters — see `sessionMemory`'s doc comment.
 */
const NEW_ORDER_SELECTION_KEY = 'newOrder:selection';
type NewOrderSelection = Pick<OrderCreateFormValues, 'businessId' | 'locationId' | 'orderType'>;

/** Maps a transition target to the `billingService` call that drives it — same shape `OrderDetailPage` uses. `completed` is handled separately in `advanceOrder` since it's the one transition that needs a payment method. */
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
 *
 * `completed` is handled separately from the rest of the chain — it's the
 * one transition that takes a payment method, so `completion` must be
 * supplied whenever the chain includes it. Discounts are no longer part of
 * completion — they're set earlier, while the order/cart is being built.
 */
async function advanceOrder(
  orderId: string,
  chain: Exclude<OrderStatus, 'pending'>[],
  completion?: { paymentMethod: PaymentMethod },
) {
  let result: Awaited<ReturnType<typeof billingService.fireKot>> | undefined;
  for (const target of chain) {
    result =
      target === 'completed'
        ? await billingService.complete(orderId, completion!.paymentMethod)
        : await TARGET_TO_SERVICE_CALL[target](orderId);
  }
  return result as Awaited<ReturnType<typeof billingService.fireKot>>;
}

/** This line's own price after its own discount — `effectiveSellingPrice` (the location-resolved price, falling back to the master price when there's no override) is tax-inclusive, so this is just `qty × price × (1 - discount%)`, not a tax breakdown. */
function lineEstimate(line: CartLine): number {
  return (
    line.quantity * Number(line.product.effectiveSellingPrice) * (1 - line.discountPercent / 100)
  );
}

/**
 * Client-side-only preview of what the order will cost, mirroring the
 * backend's layered math (`OrderService._recompute_totals`): each line's own
 * discount first, then the order-level discount on top of that subtotal.
 * The real `subtotal`/`taxTotal`/`total` are always computed and returned by
 * the backend once the order is actually created — this is just for the
 * cart's running total, not a tax breakdown.
 */
function estimateTotal(lines: CartLine[], orderDiscountPercent: number): number {
  const preOrderDiscount = lines.reduce((sum, line) => sum + lineEstimate(line), 0);
  return preOrderDiscount * (1 - orderDiscountPercent / 100);
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

  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const pendingSyncCount = usePendingOrderCount();

  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const locationsQuery = useLocations({ enabled: isTenantAdmin });

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [productSearch, setProductSearch] = useState('');
  // Whole-order discount (%), asked up front while the cart is being built —
  // not at completion — and applied on top of each line's own discount, if
  // any. Defaults to 0 so most orders never touch it.
  const [orderDiscountPercent, setOrderDiscountPercent] = useState('0');
  // Free-hand per-order choice, same "set at creation" moment as the
  // discount above — defaults on (today's always-on behavior) so most
  // orders never need to touch this either. Locked once the order can no
  // longer be edited (see `billingService.setApplyGst`'s own doc comment);
  // this page only ever sends the initial value at creation.
  const [applyGst, setApplyGst] = useState(true);

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
    defaultValues: {
      orderType: 'takeaway',
      businessId: '',
      locationId: '',
      ...getSessionMemory<NewOrderSelection>(NEW_ORDER_SELECTION_KEY),
    },
  });

  const selectedBusinessId = watch('businessId');
  const selectedLocationId = watch('locationId');
  const orderType = watch('orderType');
  // Table number is a dine-in concept, not a kitchen one — a takeaway/delivery
  // order never has a table, and a business without a kitchen can still seat
  // dine-in customers (e.g. a retail counter with a small seating area).
  const isDineIn = orderType === 'dine_in';

  useEffect(() => {
    setSessionMemory<NewOrderSelection>(NEW_ORDER_SELECTION_KEY, {
      businessId: selectedBusinessId,
      locationId: selectedLocationId,
      orderType,
    });
  }, [selectedBusinessId, selectedLocationId, orderType]);

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
        (location) =>
          location.isActive && (!selectedBusinessId || location.businessId === selectedBusinessId),
      ),
    [locationsQuery.data, selectedBusinessId],
  );

  const locationOptions = useMemo(
    () => filteredLocations.map((location) => ({ value: location.id, label: location.name })),
    [filteredLocations],
  );

  // A business with more than one location waits for one to be picked
  // before fetching products at all, rather than fetching the unfiltered
  // business-wide list first and then re-fetching the location-scoped one
  // the moment a location resolves (auto-picked or chosen) — that was a
  // visible flash of the wrong prices/availability followed immediately by
  // a second load. A business with 0-1 locations skips the wait — its one
  // location auto-selects near-instantly (`useAutoSelectSingle` below), so
  // there's nothing worth waiting for.
  const waitingForLocation = isTenantAdmin && filteredLocations.length > 1 && !selectedLocationId;
  // A manager's own `assignedLocationId` isn't available anywhere in the
  // frontend today (their JWT/`useAuthStore` doesn't carry it, and
  // `useLocations()` — the only source of a location list — is
  // `IsTenantAdmin`-gated so they can't resolve it themselves either), so
  // their grid stays the unfiltered full-business list; correctness at
  // their one location is still enforced server-side when a line is added
  // (`OrderService._upsert_item` rejects an unavailable-there product with
  // a normal error toast). A tenant_admin gets the real per-location
  // effective view once they've picked a location.
  const productsQuery = useProducts(isTenantAdmin ? selectedLocationId || undefined : undefined, {
    enabled: !waitingForLocation,
  });

  // Clear a location left over from a *previously* selected business before
  // anything else runs — `NEW_ORDER_SELECTION_KEY` (sessionMemory) persists
  // the last business/location pair across visits, but switching business
  // here must not silently keep submitting another business's (or another
  // business's now-inactive) location; the backend rejects that combination
  // outright ("location does not belong to this business"). Runs before
  // `useAutoSelectSingle` below so the same render pass that clears a stale
  // id also gets a chance to auto-fill the newly-selected business's own
  // single location, if it has just one.
  useEffect(() => {
    if (
      selectedLocationId &&
      !filteredLocations.some((location) => location.id === selectedLocationId)
    ) {
      setValue('locationId', '');
    }
  }, [filteredLocations, selectedLocationId, setValue]);

  // Auto-fill the business/location pickers when there's exactly one option
  // — a tenant_admin with a single business/location never has to touch
  // these. The business picker also hides itself in that case (see the
  // Selects' conditional rendering below); the location picker stays
  // visible even at a single option so it's always clear *which* location
  // an order is being opened against, especially once a tenant has more
  // than one business (the scenario that surfaced the stale-location bug
  // fixed above).
  useAutoSelectSingle(businessesQuery.data, selectedBusinessId, (id) => setValue('businessId', id));
  useAutoSelectSingle(filteredLocations, selectedLocationId, (id) => setValue('locationId', id));

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
  const nameRequired = isTenantAdmin
    ? (orderSettingsQuery.data?.customerNameRequired ?? true)
    : true;
  const phoneRequired = isTenantAdmin
    ? (orderSettingsQuery.data?.customerPhoneRequired ?? true)
    : true;
  // Same tenant_admin-only gating as name/phone-required above, for the
  // same reason — a manager's business isn't resolvable on this page yet.
  // A manager therefore always sees the classic flow, same limitation the
  // codebase already accepted for the other two settings.
  const tableLayoutEnabled = isTenantAdmin
    ? (orderSettingsQuery.data?.tableLayoutEnabled ?? false)
    : false;

  useEffect(() => {
    requiredFieldsRef.current = { nameRequired, phoneRequired };
  }, [nameRequired, phoneRequired]);

  // The table chosen on `TableSelectScreen` — `null` means either the
  // classic flow, or table-first mode still waiting on a pick. Cleared
  // whenever the resolved location changes so a stale table from a
  // previous location can never carry into this one.
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  useEffect(() => {
    setSelectedTable(null);
  }, [selectedLocationId]);

  useEffect(() => {
    if (selectedTable) setValue('orderType', 'dine_in');
  }, [selectedTable, setValue]);

  // Offline read fallback: the only one this feature needs. Cached
  // opportunistically whenever the products fetch actually succeeds; read
  // back only once there's nothing else to show (a reload mid-outage would
  // otherwise leave the product grid blank — TanStack Query's in-memory
  // cache doesn't survive a reload).
  const productCacheKey = isTenantAdmin ? selectedLocationId || '__all__' : '__all__';
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (productsQuery.data) {
      void offlineDb.productCache.put({
        key: productCacheKey,
        products: productsQuery.data,
        cachedAt: Date.now(),
      });
    }
  }, [productsQuery.data, productCacheKey]);

  useEffect(() => {
    if (productsQuery.data || isOnline) return;
    offlineDb.productCache
      .get(productCacheKey)
      .then((entry) => setCachedProducts(entry?.products ?? []))
      .catch(() => setCachedProducts([]));
  }, [productCacheKey, isOnline, productsQuery.data]);

  const availableProducts = useMemo(() => {
    let products = productsQuery.data ?? cachedProducts;
    if (isTenantAdmin) {
      if (!selectedBusinessId) return [];
      // Already the right, location-resolved set server-side whenever
      // `productsQuery` carried a `locationId` (see its own useProducts()
      // call above) — this filter is then a harmless no-op re-check. It's
      // still load-bearing for the window before a location is picked
      // (business chosen, no location yet) and for a manager, whose call
      // never carries a location at all.
      products = products.filter((product) => product.businessId === selectedBusinessId);
    }
    const term = productSearch.trim().toLowerCase();
    if (term) {
      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
          (product.barcode ?? '').toLowerCase().includes(term),
      );
    }
    return products;
  }, [productsQuery.data, cachedProducts, isTenantAdmin, selectedBusinessId, productSearch]);

  const cartLines = Object.values(cart);
  const estimatedTotal = estimateTotal(cartLines, Number(orderDiscountPercent || 0));

  // Manager path never resolves a location client-side (see the
  // `productsQuery` comment above) — `getAvailableStock` returns `null` in
  // that case (treat as unlimited here; the backend's own `_upsert_item`
  // check is still the real gate at submit time).
  const cartLocationId = isTenantAdmin ? selectedLocationId || undefined : undefined;

  function addToCart(product: Product) {
    const available = getAvailableStock(product, cartLocationId);
    if (available !== null) {
      if (available <= 0) {
        showToast({
          tone: 'danger',
          message: `'${product.name}' is out of stock at this location.`,
        });
        return;
      }
      const currentQty = cart[product.id]?.quantity ?? 0;
      if (currentQty + 1 > available) {
        showToast({ tone: 'warning', message: `Only ${available} of '${product.name}' in stock.` });
        return;
      }
    }
    setCart((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: (existing?.quantity ?? 0) + 1,
          // Only the first time this product lands in the cart —
          // `effectiveDiscountPercent` (the location-resolved default,
          // falling back to the master product's own when there's no
          // override), still freely editable per line afterward via
          // `setItemDiscountPercent`.
          discountPercent:
            existing?.discountPercent ?? Number(product.effectiveDiscountPercent || 0),
        },
      };
    });
  }

  /** Whether the `+` stepper on an already-in-cart line may go higher — `null` (unlimited/unresolved stock) always can. */
  function canIncreaseQuantity(line: CartLine): boolean {
    const available = getAvailableStock(line.product, cartLocationId);
    return available === null || line.quantity < available;
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

  function setItemDiscountPercent(productId: string, discountPercent: number) {
    setCart((prev) => {
      if (!prev[productId]) return prev;
      const clamped = Math.min(100, Math.max(0, discountPercent || 0));
      return { ...prev, [productId]: { ...prev[productId], discountPercent: clamped } };
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

  // Scan-to-cart: resolves a scanned/typed code against the same product
  // lookup the general "scan for details" flow uses, then feeds the result
  // straight through `addToCart` — same code path a manual tile click
  // already goes through, so cart logic itself is untouched. Disarmed once
  // the completion modal is open (that's a different screen's worth of
  // fields, no cart to add into) and while the business/location picker
  // hasn't resolved yet for a tenant_admin (no catalog scoped to scan
  // against yet).
  useBarcodeScanner({
    enabled: !pendingOrder && (!isTenantAdmin || Boolean(selectedBusinessId)),
    onScan: async (code) => {
      try {
        const product = await inventoryService.lookupProductByCode(
          code,
          isTenantAdmin ? selectedBusinessId : undefined,
        );
        addToCart(product);
        showToast({ tone: 'success', message: `${product.name} added.` });
      } catch (error) {
        showToast({ tone: 'danger', message: describeApiError(error) });
      }
    },
  });

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
    setOrderDiscountPercent('0');
    setProductSearch('');
    // Table-first mode sends the cashier back to the floor plan for the
    // next walk-in rather than reusing the same table's cart.
    setSelectedTable(null);
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

  const cartItemLines = cartLines.map((line) => ({
    productId: line.product.id,
    quantity: String(line.quantity),
    discountPercent: String(line.discountPercent || 0),
  }));

  /**
   * Queues the whole cart as one offline cash sale — no PENDING window, no
   * kitchen routing (that's the online-only, connectivity-dependent flow;
   * see `apps/billing/services/order_service.py`'s `create_offline_sale`).
   * The write to `offlineDb` happens *before* this resolves, so the caller
   * can treat a resolved promise as "durably queued," matching the
   * write-ahead-then-reflect-success order the feature was designed around.
   */
  async function queueOfflineSale(values: OrderCreateFormValues): Promise<void> {
    const payload: OfflineOrderSyncRequest = {
      businessId: values.businessId || undefined,
      locationId: values.locationId || undefined,
      orderType: values.orderType,
      tableNumber: values.tableNumber || undefined,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      discountPercent: orderDiscountPercent || '0',
      applyGst,
      items: cartItemLines,
      paymentMethod: 'cash',
      idempotencyKey: crypto.randomUUID(),
    };
    await offlineDb.pendingOrders.add({
      localId: payload.idempotencyKey,
      payload,
      status: 'queued',
      createdAt: Date.now(),
    });
    notifyQueueChanged();
  }

  const offlineSaleMutation = useMutation({
    mutationFn: queueOfflineSale,
    // TanStack Query's default `networkMode: 'online'` pauses a mutation
    // (`onMutate` runs, but the mutationFn itself never fires) whenever
    // `navigator.onLine` is false — a real bug hit while verifying this
    // feature: this mutation IS the "we're offline" handler, its body is a
    // pure local IndexedDB write with no network call at all, so it must
    // run regardless of the browser's online/offline signal.
    networkMode: 'always',
    onSuccess: () => {
      showToast({
        tone: 'success',
        message: 'Offline sale queued — will sync automatically once back online.',
      });
      closeModalAndReset();
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: OrderCreateFormValues) =>
      billingService.createOrder({
        businessId: values.businessId || undefined,
        locationId: values.locationId || undefined,
        orderType: values.orderType,
        tableId: selectedTable?.id,
        tableNumber: values.tableNumber || undefined,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        discountPercent: orderDiscountPercent || '0',
        applyGst,
        items: cartItemLines,
      }),
    onSuccess: (order) => {
      setPendingOrder(order);
    },
    onError: (error, values) => {
      // A real network failure (not a validation/permission error) with the
      // cart otherwise ready to submit — fall back to the same offline path
      // `isOnline === false` would have taken, rather than just losing the
      // sale to a toast. Non-cash payment methods aren't reachable here:
      // this mutation only ever fires from the form submit, before payment
      // method is even chosen (see the decision modal below) — the offline
      // fallback always completes as cash, same as the proactive branch.
      if (error instanceof ApiError && error.code === 'network_error') {
        offlineSaleMutation.mutate(values);
        return;
      }
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
        { paymentMethod },
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

  // `pendingOrder.total` already reflects every discount (item-level + the
  // order-level one set while building the cart) — the backend computed it
  // at creation, so there's nothing left to net out here.
  const amountToCollect = pendingOrder ? Number(pendingOrder.total) : 0;
  const changeDue = pendingOrder ? Math.max(0, Number(amountTendered || 0) - amountToCollect) : 0;

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        title="New order"
        subtitle="Pick items and enter the customer's details"
        actions={
          <div className="flex items-center gap-2">
            {!isOnline && <Badge tone="warning">Offline — cash sales only</Badge>}
            {pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={() => void runSync(queryClient)}
                title="Sales queued while offline — click to sync now"
              >
                <Badge tone="accent">{pendingSyncCount} pending sync</Badge>
              </button>
            )}
            <Button
              variant="secondary"
              leadingIcon={<ListOrdered size={16} />}
              onClick={() => navigate(BILLING_ROUTES.orders)}
            >
              Orders overview
            </Button>
          </div>
        }
      />

      <form
        id="new-order-form"
        onSubmit={handleSubmit((values) =>
          isOnline ? createMutation.mutate(values) : offlineSaleMutation.mutate(values),
        )}
        className="flex flex-col gap-4"
      >
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
              {locationOptions.length >= 1 ? (
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

        {tableLayoutEnabled && !selectedTable ? (
          selectedLocationId ? (
            <TableSelectScreen
              locationId={selectedLocationId}
              onSelectFreeTable={setSelectedTable}
              onSelectOccupiedTable={(table) => {
                if (table.currentOrder) navigate(BILLING_ROUTES.orderDetail(table.currentOrder.id));
              }}
            />
          ) : (
            <Card>
              <EmptyState
                title="Select a business/location"
                description="Pick a business and location above to see its floor plan."
              />
            </Card>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
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
                ) : waitingForLocation ? (
                  <EmptyState
                    title="Select a location"
                    description="This business has more than one location — pick one above to see what it carries."
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
                    {availableProducts.map((product) => {
                      const stockLabel = getStockLabel(product, cartLocationId);
                      const outOfStock = getAvailableStock(product, cartLocationId) === 0;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={outOfStock}
                          className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-ink">
                              {product.name}
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-brand">
                              ₹{product.effectiveSellingPrice}
                            </span>
                          </span>
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-xs text-ink-faint">{product.sku}</span>
                            {stockLabel ? (
                              <span
                                className={cn(
                                  'shrink-0 text-[11px] font-medium',
                                  getStockTone(product, cartLocationId) === 'danger' &&
                                    'text-danger',
                                  getStockTone(product, cartLocationId) === 'warning' &&
                                    'text-warning-text',
                                  getStockTone(product, cartLocationId) === 'faint' &&
                                    'text-ink-faint',
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
                        {cartLines.map((line) => {
                          const canIncrease = canIncreaseQuantity(line);
                          return (
                            <div
                              key={line.product.id}
                              className="flex flex-col gap-1.5 rounded-control border border-border/60 p-2"
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-ink">
                                    {line.product.name}
                                  </p>
                                  <p className="text-xs text-ink-faint">
                                    ₹{line.product.effectiveSellingPrice} × {line.quantity}
                                    {line.discountPercent > 0
                                      ? ` − ${line.discountPercent}%`
                                      : ''}{' '}
                                    = ₹{lineEstimate(line).toFixed(2)}
                                  </p>
                                  {!canIncrease ? (
                                    <p className="text-[11px] font-medium text-warning-text">
                                      Max in stock reached
                                    </p>
                                  ) : null}
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
                                    disabled={!canIncrease}
                                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                              <div className="flex items-center gap-1.5">
                                <label
                                  className="text-[11px] text-ink-faint"
                                  htmlFor={`item-discount-${line.product.id}`}
                                >
                                  Item discount
                                </label>
                                <input
                                  id={`item-discount-${line.product.id}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  inputMode="decimal"
                                  value={line.discountPercent || ''}
                                  onChange={(event) =>
                                    setItemDiscountPercent(
                                      line.product.id,
                                      Number(event.target.value),
                                    )
                                  }
                                  onWheel={preventNumberInputScroll}
                                  placeholder="0"
                                  className="h-6 w-14 rounded-control border border-border px-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                                />
                                <span className="text-[11px] text-ink-faint">%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex shrink-0 flex-col gap-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="order-discount-percent"
                          className="text-xs font-medium text-ink-soft"
                        >
                          Order discount (optional)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            id="order-discount-percent"
                            type="number"
                            min={0}
                            max={100}
                            inputMode="decimal"
                            value={orderDiscountPercent}
                            onChange={(event) => setOrderDiscountPercent(event.target.value)}
                            onWheel={preventNumberInputScroll}
                            placeholder="0"
                            className="h-7 w-16 rounded-control border border-border px-1.5 text-sm text-ink focus:border-brand focus:outline-none"
                          />
                          <span className="text-xs text-ink-faint">%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ink-soft">Apply GST</span>
                        <Switch
                          size="sm"
                          checked={applyGst}
                          onCheckedChange={setApplyGst}
                          label="Apply GST"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold text-ink">
                        <span>Estimated total</span>
                        <span>₹{estimatedTotal.toFixed(2)}</span>
                      </div>
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
                  {selectedTable ? (
                    <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface/60 p-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <MapPin size={15} className="text-brand" />
                        Dine-in · Table {selectedTable.name}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedTable(null)}
                      >
                        Change table
                      </Button>
                    </div>
                  ) : (
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
                  )}
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
                  isLoading={createMutation.isPending || offlineSaleMutation.isPending}
                  disabled={cartLines.length === 0}
                >
                  {cartLines.length === 0
                    ? 'Create order'
                    : isOnline
                      ? `Create order · ₹${estimatedTotal.toFixed(2)}`
                      : `Complete cash sale (offline) · ₹${estimatedTotal.toFixed(2)}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      <Modal
        open={pendingOrder !== null}
        onOpenChange={(open) => {
          if (!open) closeModalAndReset();
        }}
        title={paymentStep ? 'Take payment' : 'Order created'}
        description={
          paymentStep
            ? `Total due ₹${amountToCollect.toFixed(2)}`
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
              placeholder={amountToCollect.toFixed(2)}
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
