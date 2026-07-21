import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Boxes, Layers } from 'lucide-react';

import { Button, Checkbox, ErrorMessage, Input, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import {
  INVENTORY_QUERY_KEYS,
  PHARMACY_SCHEDULE_OPTIONS,
  UNIT_OPTIONS,
} from '../../constants/inventory.constants';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { inventoryService } from '../../services/inventoryService';
import type { Product, ProductRequest } from '../../types/inventory.types';
import type { ProductFormValues } from '../../validations/inventory.validation';
import { productSchema } from '../../validations/inventory.validation';
import { BatchesModal } from '../BatchesModal';
import { ProductImageField } from '../ProductImageField';
import { StockModal } from '../StockModal';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface ProductFormModalProps {
  /** `null`/`undefined` closes the modal. `'create'` opens it blank for a new product; a `Product` opens it in edit mode for that one. */
  target: Product | 'create' | null | undefined;
  /**
   * Which business a new product belongs to — resolved by the caller
   * (`ProductsPage`, via `ChooseBusinessModal` for a tenant_admin) before
   * this opens in create mode. Omitted for a manager, whose own business is
   * forced server-side regardless of what's sent. Ignored once editing.
   */
  businessId?: string;
  onOpenChange: (open: boolean) => void;
}

const VEG_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-veg' },
];

const SCHEDULE_SELECT_OPTIONS = [{ value: '', label: 'Not set' }, ...PHARMACY_SCHEDULE_OPTIONS];

function defaultValuesFor(product: Product | undefined): ProductFormValues {
  if (!product) {
    return {
      name: '',
      sku: '',
      category: '',
      unit: 'pcs',
      barcode: '',
      sellingPrice: '',
      mrp: '',
      costPrice: '',
      gstRate: '',
      hsnCode: '',
      description: '',
      isVeg: '',
      kitchenStation: '',
      isAvailable: true,
      manufacturer: '',
      schedule: '',
      composition: '',
      openingStock: '',
      reorderLevel: '',
    };
  }
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    barcode: product.barcode ?? '',
    sellingPrice: product.sellingPrice,
    mrp: product.mrp ?? '',
    costPrice: product.costPrice ?? '',
    gstRate: product.gstRate,
    hsnCode: product.hsnCode,
    description: product.description,
    isVeg: product.isVeg === true ? 'veg' : product.isVeg === false ? 'non_veg' : '',
    kitchenStation: product.kitchenStation,
    isAvailable: product.isAvailable,
    manufacturer: product.manufacturer,
    schedule: product.schedule,
    composition: product.composition,
    openingStock: '',
    reorderLevel: '',
  };
}

/**
 * Create + edit, one modal — same "single scrollable panel, nested modals
 * for a related sub-resource" shape `TenantEditModal` established (its
 * "Manage admins" row opening `TenantAdminsModal`), not a tabbed detail
 * page. `Stock`/`Batches` get their own modal each here for the same
 * reason `TenantAdminsModal` does: each is its own list-of-rows resource
 * with its own add/edit flow, not a couple of extra fields — the buttons
 * that open them live in this modal's own footer (left side, mirrored by
 * Close/Save on the right) rather than the form body, so they read as
 * "manage related data elsewhere" instead of one more field to fill in.
 *
 * The create form only shows universal fields (+ opening stock/reorder,
 * which the backend silently ignores for a restaurant/cafe or pharmacy
 * business) — before a product exists there's no `isStockTracked`/
 * `isBatchTracked` to gate the entity-specific sections on, and neither the
 * frontend nor a manager (who can't call the businesses-list endpoint at
 * all — `IsTenantAdmin`-gated) has any other way to know the target
 * business's `entity_type` upfront. On a successful create, this swaps
 * straight into editing that new product (`createdProduct` state) instead
 * of closing — the entity-specific sections and Stock/Batches/Image
 * buttons appear immediately, one save away rather than a dead end.
 *
 * Saving edits to an already-existing product (opened via the table's
 * "Edit" action) closes the modal and toasts, matching every other
 * single-entity edit modal in the app (`BusinessEditModal`, `LocationsModal`'s
 * edit flow, …). Saving while still inside that just-created continuation
 * session stays open instead, so Stock/Batches/Image stay reachable
 * without a reopen.
 *
 * `editingProduct` reads from the shared products query (by id) rather
 * than trusting the `target`/`createdProduct` snapshot forever — those
 * snapshots go stale the moment a nested action (image upload/remove,
 * stock set/adjust, a batch upsert) invalidates the products query, which
 * previously meant the image/stock/batches shown here didn't update until
 * a full page reload.
 *
 * Barcode and HSN code are deliberately not rendered here for now — both
 * stay in `ProductFormValues`/the save payload untouched (still optional,
 * still round-tripped for a product that already has one), this just
 * removes the two input fields from the form until they're wanted again.
 */
export function ProductFormModal({ target, businessId, onOpenChange }: ProductFormModalProps) {
  const isCreateTarget = target === 'create';
  const open = Boolean(target);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const categoriesQuery = useCategories();

  const [createdProduct, setCreatedProduct] = useState<Product | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [batchesModalOpen, setBatchesModalOpen] = useState(false);

  // Shares its cache with `ProductsPage`'s own `useProducts()` (same query
  // key) — this is a cache read, not a second network fetch, same
  // reasoning `StockModal`/`BatchesModal` already document for reading
  // `product.stock` off an already-fetched product.
  const productsQuery = useProducts();
  const snapshotProduct = target && target !== 'create' ? target : createdProduct;
  const liveProduct = snapshotProduct
    ? productsQuery.data?.find((product) => product.id === snapshotProduct.id)
    : undefined;
  // Prefer the live, post-invalidation query data; fall back to the
  // snapshot only for the brief window before that refetch resolves (e.g.
  // immediately after create, before the new product exists in the cache).
  const editingProduct = liveProduct ?? snapshotProduct;
  const isEditing = Boolean(editingProduct);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValuesFor(undefined),
  });

  // Resets the form (and every bit of "which product am I on" state) each
  // time the modal transitions from closed to open — done during render
  // rather than a `useEffect`, matching `LocationsModal`'s own fix for the
  // one-frame flicker an effect-based reset causes (it only runs after the
  // first paint).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCreatedProduct(null);
      setSaveError(null);
      setStockModalOpen(false);
      setBatchesModalOpen(false);
      reset(defaultValuesFor(target && target !== 'create' ? target : undefined));
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const shared = {
        name: values.name,
        sku: values.sku,
        category: values.category || undefined,
        unit: values.unit,
        barcode: values.barcode || undefined,
        sellingPrice: values.sellingPrice,
        mrp: values.mrp || undefined,
        costPrice: values.costPrice || undefined,
        gstRate: values.gstRate || undefined,
        hsnCode: values.hsnCode || undefined,
        description: values.description || undefined,
        isVeg: values.isVeg === 'veg' ? true : values.isVeg === 'non_veg' ? false : undefined,
        kitchenStation: values.kitchenStation || undefined,
        isAvailable: values.isAvailable,
        manufacturer: values.manufacturer || undefined,
        schedule: values.schedule || undefined,
        composition: values.composition || undefined,
      } satisfies Partial<ProductRequest>;

      if (editingProduct) {
        const product = await inventoryService.updateProduct(editingProduct.id, shared);
        return { product, warning: null as string | null };
      }
      return inventoryService.createProduct({
        ...shared,
        businessId,
        openingStock: values.openingStock || undefined,
        reorderLevel: values.reorderLevel || undefined,
      });
    },
    onSuccess: ({ product, warning }) => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.categories });
      setSaveError(null);
      if (isEditing && !isCreateTarget) {
        // Editing a product opened via the table's "Edit" action — close +
        // toast, the same as any other single-entity edit modal here.
        showToast({ tone: 'success', message: 'Product updated.' });
        onOpenChange(false);
      } else if (isEditing) {
        // Still inside the just-created continuation session — stay open
        // so Stock/Batches/Image stay reachable without a reopen.
        showToast({ tone: 'success', message: 'Product updated.' });
      } else {
        setCreatedProduct(product);
        reset(defaultValuesFor(product));
        showToast({
          tone: 'success',
          message: 'Product created — add stock, batches, or an image below.',
        });
      }
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  const isBatchTracked = editingProduct?.isBatchTracked ?? false;
  const isStockTracked = editingProduct?.isStockTracked ?? false;
  const isRestaurantLike = isEditing && !isStockTracked && !isBatchTracked;
  const isPlainStockTracked = isEditing && isStockTracked && !isBatchTracked;

  // Stock/Batches open as their own `Modal` (their own Dialog, own
  // header/footer, own internal sub-views) rather than as another section
  // inside this one — same "one modal, nested modals for a related
  // sub-resource" shape `TenantAdminsModal` established. What's different
  // here is this modal's own `open` is gated on neither of them being
  // open: two independently-open Radix Dialogs at the same centered
  // position/size used to render as an actual modal-on-top-of-a-modal (a
  // double-dimmed overlay, a second white panel sitting flush over the
  // first). Closing this one first — Radix unmounts its `Dialog.Content`,
  // not this component, so the `useForm` state underneath survives —
  // means only one dialog is ever on screen, and "Close"/Escape/overlay-
  // click on the Stock or Batches modal comes straight back to this one
  // exactly as left, not all the way out to the products table.
  const formModalOpen = open && !stockModalOpen && !batchesModalOpen;

  // Rendered twice below (paired with the image once editing, alone
  // otherwise) — pulled out once so both spots stay in sync.
  const skuField = (
    <Input
      label="SKU"
      hint="Unique per business — also the Excel import upsert key"
      {...register('sku')}
      errorMessage={errors.sku?.message}
    />
  );

  return (
    <>
      <Modal
        open={formModalOpen}
        onOpenChange={onOpenChange}
        title={isEditing ? `Edit ${editingProduct?.name}` : 'Add product'}
        description={
          isCreateTarget && !isEditing
            ? 'Universal fields only for now — pharmacy/restaurant details and stock/batches unlock right after this saves.'
            : undefined
        }
        size="lg"
        footer={
          <div className="flex flex-1 items-center justify-between gap-2.5">
            <div className="flex gap-2">
              {isPlainStockTracked ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<Boxes size={14} />}
                  onClick={() => setStockModalOpen(true)}
                >
                  Manage stock
                </Button>
              ) : null}
              {isBatchTracked ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<Layers size={14} />}
                  onClick={() => setBatchesModalOpen(true)}
                >
                  Manage batches
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {isEditing ? 'Close' : 'Cancel'}
              </Button>
              <Button form="product-form" type="submit" isLoading={saveMutation.isPending}>
                {isEditing ? 'Save changes' : 'Create product'}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="product-form"
          onSubmit={handleSubmit((values) => saveMutation.mutateAsync(values))}
          className="flex flex-col gap-5"
        >
          {saveError ? <ErrorMessage message={saveError} /> : null}

          {isEditing && editingProduct ? (
            <div className="flex items-start gap-4">
              <ProductImageField product={editingProduct} />
              <div className="min-w-0 flex-1">{skuField}</div>
            </div>
          ) : (
            skuField
          )}

          <Input label="Name" {...register('name')} errorMessage={errors.name?.message} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Input
                label="Category"
                list="product-category-options"
                placeholder="Pick an existing one or type a new one"
                {...register('category')}
                errorMessage={errors.category?.message}
              />
              <datalist id="product-category-options">
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select
                  label="Unit"
                  options={UNIT_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errors.unit?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Input
              label="Selling price"
              hint="e.g. 199.00"
              {...register('sellingPrice')}
              errorMessage={errors.sellingPrice?.message}
            />
            <Input label="MRP" {...register('mrp')} errorMessage={errors.mrp?.message} />
            <Input
              label="Cost price"
              {...register('costPrice')}
              errorMessage={errors.costPrice?.message}
            />
            <Input
              label="GST rate %"
              hint="0–100"
              {...register('gstRate')}
              errorMessage={errors.gstRate?.message}
            />
          </div>

          <Input
            label="Description"
            {...register('description')}
            errorMessage={errors.description?.message}
          />

          {!isEditing ? (
            <div className="grid grid-cols-1 gap-4 rounded-control border border-border p-4 sm:grid-cols-2">
              <div className="col-span-full text-xs font-semibold text-ink-soft">Opening stock</div>
              <Input
                label="Quantity"
                hint="Only applies to a plain stock-tracked product — ignored for restaurant/cafe or pharmacy businesses"
                {...register('openingStock')}
                errorMessage={errors.openingStock?.message}
              />
              <Input
                label="Reorder level"
                hint="Low-stock threshold — leave blank for none"
                {...register('reorderLevel')}
                errorMessage={errors.reorderLevel?.message}
              />
            </div>
          ) : null}

          {isRestaurantLike ? (
            <div className="flex flex-col gap-4 rounded-control border border-border p-4">
              <div className="text-xs font-semibold text-ink-soft">Restaurant / cafe details</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="isVeg"
                  render={({ field }) => (
                    <Select
                      label="Veg / non-veg"
                      options={VEG_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
                <Input label="Kitchen station" {...register('kitchenStation')} />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="isAvailable"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      label="Available on the menu"
                    />
                  )}
                />
                <span className="text-sm text-ink">Available on the menu</span>
              </div>
            </div>
          ) : null}

          {isBatchTracked ? (
            <div className="grid grid-cols-1 gap-4 rounded-control border border-border p-4 sm:grid-cols-2">
              <div className="col-span-full text-xs font-semibold text-ink-soft">
                Pharmacy details
              </div>
              <Input label="Manufacturer" {...register('manufacturer')} />
              <Controller
                control={control}
                name="schedule"
                render={({ field }) => (
                  <Select
                    label="Schedule"
                    options={SCHEDULE_SELECT_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
              <Input label="Composition" className="sm:col-span-2" {...register('composition')} />
            </div>
          ) : null}
        </form>
      </Modal>

      <StockModal
        product={stockModalOpen ? editingProduct : null}
        onOpenChange={setStockModalOpen}
      />
      <BatchesModal
        product={batchesModalOpen ? editingProduct : null}
        onOpenChange={setBatchesModalOpen}
      />
    </>
  );
}
