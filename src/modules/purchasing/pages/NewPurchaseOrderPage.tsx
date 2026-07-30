import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, Plus, Trash2 } from 'lucide-react';

import { Button, Card, EmptyState, Input, PageHeader, SearchInput, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';
import { getSessionMemory, setSessionMemory } from '@/utils/sessionMemory';

import { useAuthStore } from '@/modules/auth';
import { useBusinesses, useLocations } from '@/modules/businesses';
import type { Product } from '@/modules/inventory';
import { useProducts } from '@/modules/inventory';

import { SupplierFormModal } from '../components/SupplierFormModal';
import { PURCHASING_ROUTES } from '../constants/purchasing.constants';
import { useAutoSelectSingle } from '../hooks/useAutoSelectSingle';
import { useSuppliers } from '../hooks/useSuppliers';
import { purchasingService } from '../services/purchasingService';
import type { PurchaseOrderLineRequest } from '../types/purchasing.types';
import type { PurchaseLineFormValues, PurchaseOrderCreateFormValues } from '../validations/purchasing.validation';
import { buildPurchaseLineSchema, purchaseOrderCreateSchema } from '../validations/purchasing.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

/** Same fallback `ToastProvider` already uses — `crypto.randomUUID()` where available, a timestamp+random string otherwise (older browsers/non-HTTPS contexts lack `crypto.randomUUID`). Only used to key cart lines locally before the order exists; never sent to the backend. */
function createLocalId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One not-yet-submitted line — unlike `NewOrderPage`'s cart (keyed by
 * `product.id`, since a sales order line is a per-product upsert), this is
 * keyed by its own `localId`: the same product can appear on more than one
 * line here (one per batch), so two lines for the same product are two
 * separate cart rows, not one bumped quantity.
 */
interface PurchaseCartLine {
  localId: string;
  product: Product;
  quantity: string;
  purchasePrice: string;
  discountPercent: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  mrp: string;
}

/**
 * Remembers just the business/location pair across visits to this page —
 * same rationale and mechanism as `NewOrderPage`'s `NEW_ORDER_SELECTION_KEY`
 * (session-scoped, not the cart/supplier/note, which shouldn't carry over
 * into an unrelated purchase order). Resets on an actual browser reload.
 */
const NEW_PURCHASE_ORDER_SELECTION_KEY = 'newPurchaseOrder:selection';
type NewPurchaseOrderSelection = Pick<PurchaseOrderCreateFormValues, 'businessId' | 'locationId'>;

const EMPTY_LINE_FORM: PurchaseLineFormValues = {
  quantity: '1',
  purchasePrice: '',
  discountPercent: '',
  batchNumber: '',
  mfgDate: '',
  expiryDate: '',
  mrp: '',
};

/** This line's taxable value: `purchasePrice × quantity × (1 - discountPercent/100)` — GST is added on top separately, not netted in (see `PurchaseOrderItem`'s own doc comment on why this is the reverse of a sales `Order` line). */
function lineTaxableValue(line: PurchaseCartLine): number {
  const discount = Number(line.discountPercent || 0);
  return Number(line.quantity || 0) * Number(line.purchasePrice || 0) * (1 - discount / 100);
}

/**
 * Client-side-only preview of what the purchase order will cost — the real
 * `subtotal`/`taxTotal`/`total` are always computed and returned by the
 * backend once the order is actually created, this is just for the
 * builder's running total. GST is estimated per line from that product's own
 * `gstRate` and added on top of the summed taxable value, matching the
 * backend's own tax-exclusive-purchase-price math.
 */
function estimateTotals(lines: PurchaseCartLine[]): { subtotal: number; taxTotal: number; total: number } {
  let subtotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    const taxable = lineTaxableValue(line);
    subtotal += taxable;
    taxTotal += taxable * (Number(line.product.gstRate || 0) / 100);
  }
  return { subtotal, taxTotal, total: subtotal + taxTotal };
}

/**
 * Full-page purchase-order builder — supplier/business/location pickers,
 * a product picker + per-line add form (purchase price/discount/batch
 * fields have to be typed in, unlike a sales order's cart where the price is
 * snapshotted automatically), then submit. Much simpler than `NewOrderPage`:
 * there's no kitchen flow, no payment-at-creation decision — a purchase
 * order is always created `pending`, and completion/cancellation happen
 * later on `PurchaseOrderDetailPage`.
 */
export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const suppliersQuery = useSuppliers();

  const [cart, setCart] = useState<PurchaseCartLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseOrderCreateFormValues>({
    resolver: zodResolver(purchaseOrderCreateSchema),
    defaultValues: {
      businessId: '',
      locationId: '',
      supplierId: '',
      note: '',
      ...getSessionMemory<NewPurchaseOrderSelection>(NEW_PURCHASE_ORDER_SELECTION_KEY),
    },
  });

  const selectedBusinessId = watch('businessId');
  const selectedLocationId = watch('locationId');

  useEffect(() => {
    setSessionMemory<NewPurchaseOrderSelection>(NEW_PURCHASE_ORDER_SELECTION_KEY, {
      businessId: selectedBusinessId,
      locationId: selectedLocationId,
    });
  }, [selectedBusinessId, selectedLocationId]);

  const businessOptions = useMemo(
    () => (businessesQuery.data ?? []).map((business) => ({ value: business.id, label: business.name })),
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
    if (selectedLocationId && !filteredLocations.some((location) => location.id === selectedLocationId)) {
      setValue('locationId', '');
    }
  }, [filteredLocations, selectedLocationId, setValue]);

  useAutoSelectSingle(businessesQuery.data, selectedBusinessId, (id) => setValue('businessId', id));
  useAutoSelectSingle(filteredLocations, selectedLocationId, (id) => setValue('locationId', id));

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data ?? [])
        .filter((supplier) => supplier.isActive)
        .filter((supplier) => !isTenantAdmin || !selectedBusinessId || supplier.businessId === selectedBusinessId)
        .map((supplier) => ({ value: supplier.id, label: supplier.name })),
    [suppliersQuery.data, isTenantAdmin, selectedBusinessId],
  );

  const waitingForLocation = isTenantAdmin && filteredLocations.length > 1 && !selectedLocationId;
  const productsQuery = useProducts(isTenantAdmin ? selectedLocationId || undefined : undefined, {
    enabled: !waitingForLocation,
  });

  const availableProducts = useMemo(() => {
    let products = (productsQuery.data ?? []).filter((product) => product.isActive);
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

  const isBatchTrackedRef = useRef(false);
  isBatchTrackedRef.current = selectedProduct?.isBatchTracked ?? false;

  const {
    register: registerLine,
    handleSubmit: handleLineSubmit,
    reset: resetLineForm,
    formState: { errors: lineErrors },
  } = useForm<PurchaseLineFormValues>({
    resolver: (values, context, options) =>
      zodResolver(buildPurchaseLineSchema(isBatchTrackedRef.current))(values, context, options),
    defaultValues: EMPTY_LINE_FORM,
  });

  function pickProduct(product: Product) {
    setSelectedProduct(product);
    resetLineForm({ ...EMPTY_LINE_FORM, purchasePrice: product.costPrice ?? '' });
  }

  function addLine(values: PurchaseLineFormValues) {
    if (!selectedProduct) return;
    setCart((prev) => [
      ...prev,
      {
        localId: createLocalId(),
        product: selectedProduct,
        quantity: values.quantity,
        purchasePrice: values.purchasePrice,
        discountPercent: values.discountPercent || '0',
        batchNumber: values.batchNumber || '',
        mfgDate: values.mfgDate || '',
        expiryDate: values.expiryDate || '',
        mrp: values.mrp || '',
      },
    ]);
    setSelectedProduct(null);
    resetLineForm(EMPTY_LINE_FORM);
  }

  function removeLine(localId: string) {
    setCart((prev) => prev.filter((line) => line.localId !== localId));
  }

  const totals = estimateTotals(cart);

  const createMutation = useMutation({
    mutationFn: (values: PurchaseOrderCreateFormValues) =>
      purchasingService.createPurchaseOrder({
        businessId: values.businessId || undefined,
        locationId: values.locationId || undefined,
        supplierId: values.supplierId,
        note: values.note || undefined,
        items: cart.map(
          (line): PurchaseOrderLineRequest => ({
            productId: line.product.id,
            quantity: line.quantity,
            purchasePrice: line.purchasePrice,
            discountPercent: line.discountPercent || undefined,
            batchNumber: line.batchNumber || undefined,
            mfgDate: line.mfgDate || undefined,
            expiryDate: line.expiryDate || undefined,
            mrp: line.mrp || undefined,
          }),
        ),
      }),
    onSuccess: (purchaseOrder) => {
      showToast({ tone: 'success', message: 'Purchase order created.' });
      navigate(PURCHASING_ROUTES.purchaseOrderDetail(purchaseOrder.id));
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  return (
    <div>
      <PageHeader
        title="New purchase order"
        subtitle="Record stock coming in from a supplier"
        actions={
          <Button
            variant="secondary"
            leadingIcon={<ListOrdered size={16} />}
            onClick={() => navigate(PURCHASING_ROUTES.purchaseOrders)}
          >
            Purchase orders overview
          </Button>
        }
      />

      {/*
        Plain `div`, not a `<form>` — the "Add {product}" panel below owns
        its own `<form>` (so Enter-to-submit adds just that one line), and
        nested `<form>` elements are invalid HTML (a browser hoists/ignores
        the inner one, which silently breaks its own submit behavior). The
        final "Create purchase order" button instead calls `handleSubmit`
        directly from its own `onClick`.
      */}
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

        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Supplier"
                    placeholder="Choose a supplier"
                    options={supplierOptions}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    errorMessage={errors.supplierId?.message}
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start px-0"
                leadingIcon={<Plus size={13} />}
                disabled={isTenantAdmin && !selectedBusinessId}
                disabledReason={
                  isTenantAdmin && !selectedBusinessId ? 'Select a business first.' : undefined
                }
                onClick={() => setSupplierModalOpen(true)}
              >
                Add new supplier
              </Button>
            </div>
            <Input label="Note (optional)" {...register('note')} />
          </div>
        </Card>

        {/*
          Opens inline rather than sending the user off to `/suppliers` —
          `onSaved` selects the freshly-created supplier straight into this
          form's `supplierId`, so adding one is part of the same flow as
          raising the purchase order, not a separate trip.
        */}
        <SupplierFormModal
          target={supplierModalOpen ? 'create' : null}
          businessId={isTenantAdmin ? selectedBusinessId || undefined : undefined}
          onOpenChange={setSupplierModalOpen}
          onSaved={(supplier) => setValue('supplierId', supplier.id)}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <div className="mb-3">
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
                  description="This business has more than one location — pick one above first."
                />
              ) : availableProducts.length === 0 ? (
                <EmptyState
                  title="No products found"
                  description={productSearch ? 'Try a different search term.' : 'This business has no products yet.'}
                />
              ) : (
                <div className="grid max-h-[420px] grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => pickProduct(product)}
                      className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 data-[selected=true]:border-brand data-[selected=true]:bg-brand/5"
                      data-selected={selectedProduct?.id === product.id}
                    >
                      <span className="truncate text-sm font-semibold text-ink">{product.name}</span>
                      <span className="text-xs text-ink-faint">
                        {product.sku}
                        {product.isBatchTracked ? ' · batch-tracked' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {selectedProduct ? (
              <Card>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                  Add {selectedProduct.name}
                </p>
                <form
                  onSubmit={handleLineSubmit(addLine)}
                  className="flex flex-col gap-3"
                  id="add-purchase-line-form"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Quantity"
                      {...registerLine('quantity')}
                      errorMessage={lineErrors.quantity?.message}
                    />
                    <Input
                      label="Purchase price"
                      hint="Tax-exclusive"
                      {...registerLine('purchasePrice')}
                      errorMessage={lineErrors.purchasePrice?.message}
                    />
                    <Input
                      label="Discount % (optional)"
                      {...registerLine('discountPercent')}
                      errorMessage={lineErrors.discountPercent?.message}
                    />
                  </div>
                  {selectedProduct.isBatchTracked ? (
                    <div className="grid grid-cols-1 gap-3 rounded-control border border-border p-3 sm:grid-cols-2">
                      <Input
                        label="Batch number"
                        {...registerLine('batchNumber')}
                        errorMessage={lineErrors.batchNumber?.message}
                      />
                      <Input
                        label="Expiry date"
                        type="date"
                        {...registerLine('expiryDate')}
                        errorMessage={lineErrors.expiryDate?.message}
                      />
                      <Input
                        label="Mfg date (optional)"
                        type="date"
                        {...registerLine('mfgDate')}
                      />
                      <Input label="MRP (optional)" {...registerLine('mrp')} errorMessage={lineErrors.mrp?.message} />
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setSelectedProduct(null)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add to order</Button>
                  </div>
                </form>
              </Card>
            ) : null}

            <Card className="flex min-h-[220px] flex-col">
              <p className="mb-3 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Lines{cart.length ? ` (${cart.length})` : ''}
              </p>
              {cart.length === 0 ? (
                <p className="flex flex-1 items-center justify-center text-center text-xs text-ink-faint">
                  No lines yet — pick a product on the left to add one.
                </p>
              ) : (
                <>
                  <div className="max-h-[360px] flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2">
                      {cart.map((line) => (
                        <div
                          key={line.localId}
                          className="flex items-start justify-between gap-2 rounded-control border border-border/60 p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{line.product.name}</p>
                            <p className="text-xs text-ink-faint">
                              ₹{line.purchasePrice} × {line.quantity}
                              {Number(line.discountPercent) > 0 ? ` − ${line.discountPercent}%` : ''} = ₹
                              {lineTaxableValue(line).toFixed(2)}
                              {line.batchNumber ? ` · batch ${line.batchNumber}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Remove line"
                            onClick={() => removeLine(line.localId)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-danger-bg hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex shrink-0 flex-col gap-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between text-ink-soft">
                      <span>Subtotal (est.)</span>
                      <span>₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-ink-soft">
                      <span>Tax (est.)</span>
                      <span>₹{totals.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-ink">
                      <span>Total (est.)</span>
                      <span>₹{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Button
              type="button"
              size="lg"
              isLoading={createMutation.isPending}
              disabled={cart.length === 0}
              onClick={handleSubmit((values) => createMutation.mutate(values))}
            >
              {cart.length > 0 ? `Create purchase order · ₹${totals.total.toFixed(2)}` : 'Create purchase order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
