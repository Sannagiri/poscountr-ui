import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, Minus, Plus, Trash2 } from 'lucide-react';

import type { AddAdhocLineValues } from '@/components';
import {
  AddAdhocLineModal,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SearchInput,
  Select,
  useToast,
} from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';
import { preventNumberInputScroll } from '@/utils/numberInputScroll';
import { getSessionMemory, setSessionMemory } from '@/utils/sessionMemory';

import { useAuthStore } from '@/modules/auth';
import { INDIAN_STATE_OPTIONS, useBusinesses, useLocations } from '@/modules/businesses';
import type { Product } from '@/modules/inventory';
import { getAvailableStock, getStockLabel, getStockTone, useProducts } from '@/modules/inventory';

import { QUOTATION_ORDER_TYPE_OPTIONS, QUOTATIONS_ROUTES } from '../constants/quotation.constants';
import { useAutoSelectSingle } from '../hooks/useAutoSelectSingle';
import { quotationService } from '../services/quotationService';
import type { QuotationLineRequest } from '../types/quotation.types';
import type { QuotationCreateFormValues } from '../validations/quotation.validation';
import { quotationCreateSchema } from '../validations/quotation.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

/**
 * A catalog line (`kind: 'product'`, keyed by `product.id`) or an ad-hoc/
 * external one-time line (`kind: 'adhoc'`, keyed by a locally-generated
 * `key`) — same shape `NewOrderPage`'s own `CartLine` union follows.
 */
type CartLine =
  | { kind: 'product'; product: Product; quantity: number; discountPercent: number }
  | {
      kind: 'adhoc';
      key: string;
      name: string;
      unitPrice: string;
      gstRate: string;
      quantity: number;
      discountPercent: number;
    };

function lineKey(line: CartLine): string {
  return line.kind === 'product' ? line.product.id : line.key;
}

function lineName(line: CartLine): string {
  return line.kind === 'product' ? line.product.name : line.name;
}

function lineUnitPrice(line: CartLine): string {
  return line.kind === 'product' ? line.product.effectiveSellingPrice : line.unitPrice;
}

/**
 * Remembers just the business/location/order-type picks across visits to
 * this page — same rationale and mechanism as `NewOrderPage`'s
 * `NEW_ORDER_SELECTION_KEY` (session-scoped, not the cart/customer fields,
 * which shouldn't carry over into an unrelated quotation). Resets on an
 * actual browser reload.
 */
const NEW_QUOTATION_SELECTION_KEY = 'newQuotation:selection';
type NewQuotationSelection = Pick<
  QuotationCreateFormValues,
  'businessId' | 'locationId' | 'orderType'
>;

/** This line's own price after its own discount — a product's `effectiveSellingPrice` and an ad-hoc line's typed-in `unitPrice` are both tax-inclusive, same as `NewOrderPage`'s own `lineEstimate`. */
function lineEstimate(line: CartLine): number {
  return line.quantity * Number(lineUnitPrice(line)) * (1 - line.discountPercent / 100);
}

/**
 * Client-side-only preview of what the quotation will total — mirrors the
 * backend's layered math the same way `NewOrderPage`'s own `estimateTotal`
 * does: each line's own discount first, then the quotation-level discount on
 * top of that subtotal. The real `subtotal`/`taxTotal`/`total` are always
 * computed and returned by the backend once the quotation actually exists.
 */
function estimateTotal(lines: CartLine[], quotationDiscountPercent: number): number {
  const preQuotationDiscount = lines.reduce((sum, line) => sum + lineEstimate(line), 0);
  return preQuotationDiscount * (1 - quotationDiscountPercent / 100);
}

/**
 * Full-page quotation builder — product picker on the left, running cart +
 * customer form on the right, the same sell-side cart-building shape as
 * `NewOrderPage` (not purchasing's buy-side batch/mfg/expiry cart, which
 * doesn't apply here). Unlike `NewOrderPage`, there's no kitchen-flow
 * decision modal or payment step at creation — a quotation is always
 * created `pending`, awaiting the customer's accept/decline, so submitting
 * just navigates straight to the new quotation's detail page.
 *
 * `customerName`/`customerPhone` are always required (no settings toggle,
 * unlike `Order`) — a quotation has to reach someone to be accepted or
 * declined.
 */
export function NewQuotationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const locationsQuery = useLocations({ enabled: isTenantAdmin });

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [adhocModalOpen, setAdhocModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [quotationDiscountPercent, setQuotationDiscountPercent] = useState('0');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<QuotationCreateFormValues>({
    resolver: zodResolver(quotationCreateSchema),
    defaultValues: {
      orderType: 'takeaway',
      businessId: '',
      locationId: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerGstin: '',
      customerState: '',
      note: '',
      ...getSessionMemory<NewQuotationSelection>(NEW_QUOTATION_SELECTION_KEY),
    },
  });

  const selectedBusinessId = watch('businessId');
  const selectedLocationId = watch('locationId');
  const orderType = watch('orderType');

  useEffect(() => {
    setSessionMemory<NewQuotationSelection>(NEW_QUOTATION_SELECTION_KEY, {
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

  useEffect(() => {
    if (
      selectedLocationId &&
      !filteredLocations.some((location) => location.id === selectedLocationId)
    ) {
      setValue('locationId', '');
    }
  }, [filteredLocations, selectedLocationId, setValue]);

  useAutoSelectSingle(businessesQuery.data, selectedBusinessId, (id) => setValue('businessId', id));
  useAutoSelectSingle(filteredLocations, selectedLocationId, (id) => setValue('locationId', id));

  const waitingForLocation = isTenantAdmin && filteredLocations.length > 1 && !selectedLocationId;
  const productsQuery = useProducts(isTenantAdmin ? selectedLocationId || undefined : undefined, {
    enabled: !waitingForLocation,
  });

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
  const estimatedTotal = estimateTotal(cartLines, Number(quotationDiscountPercent || 0));

  // Manager path never resolves a location client-side (see `NewOrderPage`'s
  // own note on this) — `getAvailableStock` returns `null` in that case
  // (unlimited here; the backend's `_upsert_item` check is the real gate).
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
      const existingLine = cart[product.id];
      const currentQty = existingLine?.kind === 'product' ? existingLine.quantity : 0;
      if (currentQty + 1 > available) {
        showToast({ tone: 'warning', message: `Only ${available} of '${product.name}' in stock.` });
        return;
      }
    }
    setCart((prev) => {
      const existing = prev[product.id];
      const existingQuantity = existing?.kind === 'product' ? existing.quantity : 0;
      const existingDiscount = existing?.kind === 'product' ? existing.discountPercent : undefined;
      return {
        ...prev,
        [product.id]: {
          kind: 'product',
          product,
          quantity: existingQuantity + 1,
          discountPercent: existingDiscount ?? Number(product.effectiveDiscountPercent || 0),
        },
      };
    });
  }

  /** Appends a new ad-hoc line — always a fresh cart entry, matching the backend's own "ad-hoc lines are always append-only" rule, same as `NewOrderPage`'s own `addAdhocToCart`. */
  function addAdhocToCart(values: AddAdhocLineValues) {
    const key = `adhoc:${crypto.randomUUID()}`;
    setCart((prev) => ({
      ...prev,
      [key]: {
        kind: 'adhoc',
        key,
        name: values.name,
        unitPrice: values.price,
        gstRate: values.gstRate || '0',
        quantity: Number(values.quantity),
        discountPercent: Number(values.discountPercent || 0),
      },
    }));
    setAdhocModalOpen(false);
  }

  /** Whether the `+` stepper on an already-in-cart line may go higher — `null` (unlimited/unresolved stock) always can, same as an ad-hoc line (no stock concept at all). */
  function canIncreaseQuantity(line: CartLine): boolean {
    if (line.kind === 'adhoc') return true;
    const available = getAvailableStock(line.product, cartLocationId);
    return available === null || line.quantity < available;
  }

  function setQuantity(key: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const existing = prev[key];
      if (!existing) return prev;
      return { ...prev, [key]: { ...existing, quantity } };
    });
  }

  function setItemDiscountPercent(key: string, discountPercent: number) {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const clamped = Math.min(100, Math.max(0, discountPercent || 0));
      return { ...prev, [key]: { ...existing, discountPercent: clamped } };
    });
  }

  function removeFromCart(key: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: QuotationCreateFormValues) =>
      quotationService.createQuotation({
        businessId: values.businessId || undefined,
        locationId: values.locationId || undefined,
        orderType: values.orderType,
        note: values.note || undefined,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || undefined,
        customerGstin: values.customerGstin || undefined,
        customerState: values.customerState || undefined,
        discountPercent: quotationDiscountPercent || '0',
        items: cartLines.map((line): QuotationLineRequest =>
          line.kind === 'product'
            ? {
                productId: line.product.id,
                quantity: String(line.quantity),
                discountPercent: String(line.discountPercent || 0),
              }
            : {
                name: line.name,
                unitPrice: line.unitPrice,
                gstRate: line.gstRate,
                quantity: String(line.quantity),
                discountPercent: String(line.discountPercent || 0),
              },
        ),
      }),
    onSuccess: (quotation) => {
      showToast({ tone: 'success', message: 'Quotation created.' });
      navigate(QUOTATIONS_ROUTES.quotationDetail(quotation.id));
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  return (
    <div>
      <PageHeader
        title="New quotation"
        subtitle="Put together an offer for a customer to accept or decline"
        actions={
          <Button
            variant="secondary"
            leadingIcon={<ListOrdered size={16} />}
            onClick={() => navigate(QUOTATIONS_ROUTES.quotations)}
          >
            Quotations overview
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex shrink-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchInput
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products by name or SKU…"
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
                <div className="grid max-h-[45vh] grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:max-h-[520px]">
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
                                getStockTone(product, cartLocationId) === 'danger' && 'text-danger',
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
                Quoted items
              </p>
              {cartLines.length === 0 ? (
                <p className="flex flex-1 items-center justify-center text-center text-xs text-ink-faint">
                  No items yet — add products from the list on the left.
                </p>
              ) : (
                <>
                  <div className="max-h-[320px] flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-3">
                      {cartLines.map((line) => {
                        const canIncrease = canIncreaseQuantity(line);
                        return (
                          <div
                            key={lineKey(line)}
                            className="flex flex-col gap-1.5 rounded-control border border-border/60 p-2"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">
                                  {lineName(line)}
                                  {line.kind === 'adhoc' ? (
                                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-ink-faint">
                                      Custom
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-ink-faint">
                                  ₹{lineUnitPrice(line)} × {line.quantity}
                                  {line.discountPercent > 0 ? ` − ${line.discountPercent}%` : ''} =
                                  ₹{lineEstimate(line).toFixed(2)}
                                </p>
                                {line.kind === 'product' && !canIncrease ? (
                                  <p className="text-[11px] font-medium text-warning-text">
                                    Max in stock reached
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => setQuantity(lineKey(line), line.quantity - 1)}
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
                                  onClick={() => setQuantity(lineKey(line), line.quantity + 1)}
                                  disabled={!canIncrease}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Remove from cart"
                                  onClick={() => removeFromCart(lineKey(line))}
                                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-danger-bg hover:text-danger"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label
                                className="text-[11px] text-ink-faint"
                                htmlFor={`item-discount-${lineKey(line)}`}
                              >
                                Item discount
                              </label>
                              <input
                                id={`item-discount-${lineKey(line)}`}
                                type="number"
                                min={0}
                                max={100}
                                inputMode="decimal"
                                value={line.discountPercent || ''}
                                onChange={(event) =>
                                  setItemDiscountPercent(lineKey(line), Number(event.target.value))
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
                        htmlFor="quotation-discount-percent"
                        className="text-xs font-medium text-ink-soft"
                      >
                        Quotation discount (optional)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="quotation-discount-percent"
                          type="number"
                          min={0}
                          max={100}
                          inputMode="decimal"
                          value={quotationDiscountPercent}
                          onChange={(event) => setQuotationDiscountPercent(event.target.value)}
                          onWheel={preventNumberInputScroll}
                          placeholder="0"
                          className="h-7 w-16 rounded-control border border-border px-1.5 text-sm text-ink focus:border-brand focus:outline-none"
                        />
                        <span className="text-xs text-ink-faint">%</span>
                      </div>
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
                Customer & quotation details
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Customer name"
                    {...register('customerName')}
                    errorMessage={errors.customerName?.message}
                  />
                  <Input
                    label="Phone"
                    placeholder="9876543210"
                    {...register('customerPhone')}
                    errorMessage={errors.customerPhone?.message}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Email (optional)"
                    {...register('customerEmail')}
                    errorMessage={errors.customerEmail?.message}
                  />
                  <Input label="GSTIN (optional)" {...register('customerGstin')} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    name="customerState"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="State (optional)"
                        placeholder="Select a state"
                        options={[...INDIAN_STATE_OPTIONS]}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    )}
                  />
                  <Controller
                    name="orderType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Order type"
                        options={QUOTATION_ORDER_TYPE_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    )}
                  />
                </div>
                <Input label="Note (optional)" {...register('note')} />
              </div>
            </Card>

            <Button
              type="button"
              size="lg"
              isLoading={createMutation.isPending}
              disabled={cartLines.length === 0}
              onClick={handleSubmit((values) => createMutation.mutate(values))}
            >
              {cartLines.length > 0
                ? `Create quotation · ₹${estimatedTotal.toFixed(2)}`
                : 'Create quotation'}
            </Button>
          </div>
        </div>
      </div>

      <AddAdhocLineModal
        open={adhocModalOpen}
        onClose={() => setAdhocModalOpen(false)}
        priceLabel="Unit price"
        onSubmit={addAdhocToCart}
      />
    </div>
  );
}
