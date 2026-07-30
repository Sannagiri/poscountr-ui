import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Boxes, ImagePlus, Layers, MapPin, Pencil, X } from 'lucide-react';

import { Button, Checkbox, ErrorMessage, Input, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useAuthStore } from '@/modules/auth';
import type { EntityType } from '@/modules/businesses';
import { useLocations } from '@/modules/businesses';

import {
  ACCEPTED_PRODUCT_IMAGE_TYPES,
  INVENTORY_QUERY_KEYS,
  MAX_PRODUCT_IMAGE_BYTES,
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
import { ProductLocationsModal } from '../ProductLocationsModal';
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
  /**
   * The same target business's `entityType`, when the caller already knows
   * it (the `ChooseBusinessModal` path — `BusinessEntity` carries it
   * directly). Lets the create form show the right entity-specific section
   * immediately instead of only after the product exists. A manager can't
   * call `/tenant/businesses/` at all, so this stays `undefined` for them —
   * the create form falls back to universal fields only, same as before.
   */
  businessEntityType?: EntityType;
  onOpenChange: (open: boolean) => void;
}

const VEG_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-veg' },
];

const SCHEDULE_SELECT_OPTIONS = [{ value: '', label: 'Not set' }, ...PHARMACY_SCHEDULE_OPTIONS];

const NEW_CATEGORY_VALUE = '__new__';

/** Mirrors the backend's `apps/inventory/constants.py::flags_for` — pharmacy → batch-tracked; restaurant/cafe → not stock-tracked (made to order); everything else → plain stock-tracked. */
function flagsForEntityType(
  entityType: EntityType | undefined,
): { isStockTracked: boolean; isBatchTracked: boolean } | null {
  if (!entityType) return null;
  return {
    isBatchTracked: entityType === 'pharmacy',
    isStockTracked: entityType !== 'restaurant' && entityType !== 'cafe',
  };
}

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
      defaultDiscountPercent: '',
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
    defaultDiscountPercent: product.defaultDiscountPercent,
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
 * The create-mode counterpart to `ProductImageField` — that one uploads
 * immediately against an existing `product.id`; this one just stages a
 * `File` locally (with a preview) since no product exists yet to upload
 * against. `ProductFormModal`'s save mutation uploads it right after the
 * product is created, so from the user's side it reads as "the image saved
 * along with everything else," one action, not a two-step follow-up.
 */
function NewProductImagePicker({
  file,
  onSelect,
  onClear,
}: {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setClientError(null);
    if (picked.size > MAX_PRODUCT_IMAGE_BYTES) {
      setClientError('That file is over 5MB — pick a smaller image.');
      return;
    }
    if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(picked.type)) {
      setClientError('Only JPEG, PNG, or WebP images are accepted.');
      return;
    }
    onSelect(picked);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-ink-soft">Image</div>
      <div className="relative inline-flex h-16 w-16 shrink-0">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Selected product"
              className="h-16 w-16 rounded-control border border-border object-cover"
            />
            <button
              type="button"
              aria-label="Replace image"
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-ink-soft shadow-sm transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              aria-label="Remove image"
              onClick={onClear}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-ink-faint shadow-sm transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Upload image"
            onClick={() => inputRef.current?.click()}
            className="flex h-16 w-16 items-center justify-center rounded-control border border-dashed border-border text-ink-faint transition-colors hover:border-border-strong hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <ImagePlus size={20} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {clientError ? <p className="text-xs text-danger">{clientError}</p> : null}
    </div>
  );
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
 * They only ever show once the product exists (`isEditing`) — a stock
 * quantity or a pharmacy batch is a row FK'd to a real `product_id`, so
 * there's no version of either that can be set before creation.
 *
 * The create form shows the same entity-specific section (restaurant/cafe
 * or pharmacy) as the edit form the moment the target business's
 * `entityType` is known client-side — `businessEntityType`, resolved by
 * `ProductsPage` from `ChooseBusinessModal`'s own `BusinessEntity`. That
 * covers the normal tenant_admin path. A manager can't call
 * `/tenant/businesses/` at all, so their own create form still falls back
 * to universal fields only — the entity-specific section, and Stock/
 * Batches, become reachable via Edit right after the product exists.
 *
 * Saving always closes the modal and toasts — create and edit behave the
 * same way here, matching every other single-entity form in the app
 * (`BusinessEditModal`, `LocationsModal`'s edit flow, …). An image picked
 * during create is staged locally (`NewProductImagePicker`) and uploaded
 * right after the product itself is created, inside the same save action —
 * no separate "now go add an image" follow-up step.
 *
 * `editingProduct` reads from the shared products query (by id) rather
 * than trusting the `target` snapshot forever — that snapshot goes stale
 * the moment a nested action (image upload/remove, stock set/adjust, a
 * batch upsert) invalidates the products query, which previously meant the
 * image/stock/batches shown here didn't update until a full page reload.
 *
 * Barcode and HSN code are deliberately not rendered here for now — both
 * stay in `ProductFormValues`/the save payload untouched (still optional,
 * still round-tripped for a product that already has one), this just
 * removes the two input fields from the form until they're wanted again.
 */
export function ProductFormModal({
  target,
  businessId,
  businessEntityType,
  onOpenChange,
}: ProductFormModalProps) {
  const isCreateTarget = target === 'create';
  const open = Boolean(target);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const categoriesQuery = useCategories();

  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const [saveError, setSaveError] = useState<string | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [batchesModalOpen, setBatchesModalOpen] = useState(false);
  const [locationsModalOpen, setLocationsModalOpen] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [categoryMode, setCategoryMode] = useState<'select' | 'new'>('select');

  // Shares its cache with `ProductsPage`'s own `useProducts()` (same query
  // key) — this is a cache read, not a second network fetch, same
  // reasoning `StockModal`/`BatchesModal` already document for reading
  // `product.stock` off an already-fetched product.
  const productsQuery = useProducts();
  const editingTarget = target && target !== 'create' ? target : undefined;
  const liveProduct = editingTarget
    ? productsQuery.data?.find((product) => product.id === editingTarget.id)
    : undefined;
  const editingProduct = liveProduct ?? editingTarget;
  const isEditing = Boolean(editingProduct);

  // `useLocations` is `IsTenantAdmin`-gated server-side (same restriction
  // `ReportsPage`'s Store Performance chart already has) — "Manage
  // locations" is tenant_admin-only for the same reason. Only worth
  // surfacing when the product's business actually has more than one
  // active location; a single-location business gets zero UX change.
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const businessLocationsCount = editingProduct
    ? (locationsQuery.data ?? []).filter((location) => location.businessId === editingProduct.businessId)
        .length
    : 0;
  const showLocationsButton = isEditing && isTenantAdmin && businessLocationsCount > 1;

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
      setSaveError(null);
      setStockModalOpen(false);
      setBatchesModalOpen(false);
      setPendingImageFile(null);
      const initialCategory = target && target !== 'create' ? target.category : '';
      setCategoryMode(
        initialCategory && !(categoriesQuery.data ?? []).includes(initialCategory) ? 'new' : 'select',
      );
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
        defaultDiscountPercent: values.defaultDiscountPercent || undefined,
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

      const result = await inventoryService.createProduct({
        ...shared,
        businessId,
        openingStock: values.openingStock || undefined,
        reorderLevel: values.reorderLevel || undefined,
      });

      if (pendingImageFile) {
        try {
          await inventoryService.uploadProductImage(result.product.id, pendingImageFile);
        } catch (error) {
          return {
            ...result,
            warning:
              result.warning ??
              `Product created, but the image failed to upload (${describeApiError(error)}).`,
          };
        }
      }
      return result;
    },
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.categories });
      setSaveError(null);
      showToast({ tone: 'success', message: isEditing ? 'Product updated.' : 'Product created.' });
      onOpenChange(false);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  const resolvedFlags = isEditing
    ? {
        isStockTracked: editingProduct?.isStockTracked ?? false,
        isBatchTracked: editingProduct?.isBatchTracked ?? false,
      }
    : flagsForEntityType(businessEntityType);
  const isBatchTracked = resolvedFlags?.isBatchTracked ?? false;
  const isRestaurantLike = resolvedFlags
    ? !resolvedFlags.isStockTracked && !resolvedFlags.isBatchTracked
    : false;
  // Opening stock only makes sense pre-creation for a plain stock-tracked
  // product — hidden once we know for certain (restaurant/cafe or
  // pharmacy); shown when unknown too (a manager creating), same lenient
  // fallback as before — the backend silently ignores it either way.
  const showOpeningStock =
    !isEditing && (!resolvedFlags || (resolvedFlags.isStockTracked && !resolvedFlags.isBatchTracked));

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
  const formModalOpen = open && !stockModalOpen && !batchesModalOpen && !locationsModalOpen;

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

  const categoryOptions = [
    { value: '', label: 'No category' },
    ...(categoriesQuery.data ?? []).map((category) => ({ value: category, label: category })),
    { value: NEW_CATEGORY_VALUE, label: '+ Add new category…' },
  ];

  return (
    <>
      <Modal
        open={formModalOpen}
        onOpenChange={onOpenChange}
        title={isEditing ? `Edit ${editingProduct?.name}` : 'Add product'}
        description={
          isCreateTarget && !isEditing && !resolvedFlags
            ? 'Universal fields only for now — pharmacy/restaurant details and stock/batches unlock right after this saves.'
            : undefined
        }
        size="lg"
        footer={
          <div className="flex flex-1 items-center justify-between gap-2.5">
            <div className="flex gap-2">
              {isEditing && !isBatchTracked && editingProduct?.isStockTracked ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<Boxes size={14} />}
                  onClick={() => setStockModalOpen(true)}
                >
                  Manage stock
                </Button>
              ) : null}
              {isEditing && isBatchTracked ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<Layers size={14} />}
                  onClick={() => setBatchesModalOpen(true)}
                >
                  Manage batches
                </Button>
              ) : null}
              {showLocationsButton ? (
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<MapPin size={14} />}
                  onClick={() => setLocationsModalOpen(true)}
                >
                  Manage locations
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

          <div className="flex items-start gap-4">
            {isEditing && editingProduct ? (
              <ProductImageField product={editingProduct} />
            ) : (
              <NewProductImagePicker
                file={pendingImageFile}
                onSelect={setPendingImageFile}
                onClear={() => setPendingImageFile(null)}
              />
            )}
            <div className="min-w-0 flex-1">{skuField}</div>
          </div>

          <Input label="Name" {...register('name')} errorMessage={errors.name?.message} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="product-category" className="text-xs font-semibold text-ink-soft">
                      Category
                    </label>
                    {categoryMode === 'new' ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-accent hover:underline"
                        onClick={() => setCategoryMode('select')}
                      >
                        Choose from list
                      </button>
                    ) : null}
                  </div>
                  {categoryMode === 'new' ? (
                    <Input
                      id="product-category"
                      placeholder="New category name"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      onBlur={field.onBlur}
                      errorMessage={errors.category?.message}
                    />
                  ) : (
                    <Select
                      id="product-category"
                      options={categoryOptions}
                      value={field.value}
                      onChange={(value) => {
                        if (value === NEW_CATEGORY_VALUE) {
                          setCategoryMode('new');
                          field.onChange('');
                        } else {
                          field.onChange(value);
                        }
                      }}
                      onBlur={field.onBlur}
                      errorMessage={errors.category?.message}
                    />
                  )}
                </div>
              )}
            />
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="GST rate %"
              hint="0–100"
              {...register('gstRate')}
              errorMessage={errors.gstRate?.message}
            />
            <Input
              label="Default discount %"
              hint="Auto-applied in the cart"
              {...register('defaultDiscountPercent')}
              errorMessage={errors.defaultDiscountPercent?.message}
            />
          </div>

          <Input
            label="Description"
            {...register('description')}
            errorMessage={errors.description?.message}
          />

          {showOpeningStock ? (
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
      <ProductLocationsModal
        product={locationsModalOpen ? editingProduct : null}
        onOpenChange={setLocationsModalOpen}
      />
    </>
  );
}
