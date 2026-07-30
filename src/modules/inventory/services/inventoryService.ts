import { apiClient, unwrap, unwrapWithMeta } from '@/services/apiClient';

import type { EntityType } from '@/modules/businesses';

import type {
  Batch,
  BatchRequest,
  ImportReport,
  ImportRowError,
  PharmacySchedule,
  Product,
  ProductLocationOverrideRequest,
  ProductLocationOverrideRow,
  ProductRequest,
  ProductStockRow,
  StockAdjustRequest,
  StockItem,
  StockSetRequest,
  Unit,
} from '../types/inventory.types';

/**
 * All calls to `/tenant/products/` (and its stock/batches/image/import
 * sub-routes) live here — components and hooks never call `apiClient`
 * directly (docs/coding-standards.md §14). Every endpoint is
 * `IsTenantAdminOrManager`-gated server-side, with manager-vs-tenant_admin
 * scoping enforced entirely inside the service layer on the backend (see
 * `apps/inventory/services/_scope.py`) — there's no query param for it here,
 * a manager's `listProducts()`/`listCategories()` are just pre-filtered.
 */

interface ProductStockRowRaw {
  location_id: string;
  location_name: string;
  quantity: string;
  reorder_level: string;
}

function mapProductStockRow(raw: ProductStockRowRaw): ProductStockRow {
  return {
    locationId: raw.location_id,
    locationName: raw.location_name,
    quantity: raw.quantity,
    reorderLevel: raw.reorder_level,
  };
}

interface ProductRaw {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  sku: string;
  category: string;
  unit: Unit;
  barcode: string | null;
  selling_price: string;
  mrp: string | null;
  cost_price: string | null;
  gst_rate: string;
  hsn_code: string;
  default_discount_percent: string;
  effective_selling_price: string;
  effective_discount_percent: string;
  description: string;
  image_url: string;
  is_stock_tracked: boolean;
  is_batch_tracked: boolean;
  is_veg: boolean | null;
  kitchen_station: string;
  is_available: boolean;
  manufacturer: string;
  schedule: PharmacySchedule | '';
  composition: string;
  is_active: boolean;
  stock: ProductStockRowRaw[];
  created_at: string;
}

function mapProduct(raw: ProductRaw): Product {
  return {
    id: raw.id,
    businessId: raw.business_id,
    businessName: raw.business_name,
    name: raw.name,
    sku: raw.sku,
    category: raw.category,
    unit: raw.unit,
    barcode: raw.barcode,
    sellingPrice: raw.selling_price,
    mrp: raw.mrp,
    costPrice: raw.cost_price,
    gstRate: raw.gst_rate,
    hsnCode: raw.hsn_code,
    defaultDiscountPercent: raw.default_discount_percent,
    effectiveSellingPrice: raw.effective_selling_price,
    effectiveDiscountPercent: raw.effective_discount_percent,
    description: raw.description,
    imageUrl: raw.image_url,
    isStockTracked: raw.is_stock_tracked,
    isBatchTracked: raw.is_batch_tracked,
    isVeg: raw.is_veg,
    kitchenStation: raw.kitchen_station,
    isAvailable: raw.is_available,
    manufacturer: raw.manufacturer,
    schedule: raw.schedule,
    composition: raw.composition,
    isActive: raw.is_active,
    stock: raw.stock.map(mapProductStockRow),
    createdAt: raw.created_at,
  };
}

/** camelCase request → snake_case body, shared by create (full) and update (partial). Fields the backend ignores outside their relevant flow (e.g. `opening_stock` on an edit PATCH) are harmless to send — the service layer there just doesn't read them — but callers only actually populate what applies (see `ProductRequest`'s own comment). */
function productRequestToBody(request: Partial<ProductRequest>) {
  return {
    business_id: request.businessId,
    name: request.name,
    sku: request.sku,
    category: request.category,
    unit: request.unit,
    barcode: request.barcode,
    selling_price: request.sellingPrice,
    mrp: request.mrp,
    cost_price: request.costPrice,
    gst_rate: request.gstRate,
    hsn_code: request.hsnCode,
    default_discount_percent: request.defaultDiscountPercent,
    description: request.description,
    is_veg: request.isVeg,
    kitchen_station: request.kitchenStation,
    is_available: request.isAvailable,
    manufacturer: request.manufacturer,
    schedule: request.schedule,
    composition: request.composition,
    opening_stock: request.openingStock,
    reorder_level: request.reorderLevel,
    location_id: request.locationId,
  };
}

interface ProductLocationOverrideRowRaw {
  location_id: string;
  location_name: string;
  is_available: boolean;
  selling_price: string | null;
  default_discount_percent: string | null;
  has_override: boolean;
}

function mapProductLocationOverrideRow(raw: ProductLocationOverrideRowRaw): ProductLocationOverrideRow {
  return {
    locationId: raw.location_id,
    locationName: raw.location_name,
    isAvailable: raw.is_available,
    sellingPrice: raw.selling_price,
    defaultDiscountPercent: raw.default_discount_percent,
    hasOverride: raw.has_override,
  };
}

/** Only includes keys actually present on `request` — an explicit `null` still round-trips (clears that override field), an omitted key stays omitted (leaves it unchanged), matching `ProductLocationOverrideInputSerializer`'s partial semantics on the backend. */
function productLocationOverrideRequestToBody(request: ProductLocationOverrideRequest) {
  const body: Record<string, unknown> = {};
  if ('isAvailable' in request) body.is_available = request.isAvailable;
  if ('sellingPrice' in request) body.selling_price = request.sellingPrice;
  if ('defaultDiscountPercent' in request) body.default_discount_percent = request.defaultDiscountPercent;
  return body;
}

interface StockItemRaw {
  id: string;
  product_id: string;
  location_id: string;
  location_name: string;
  quantity: string;
  reorder_level: string;
}

function mapStockItem(raw: StockItemRaw): StockItem {
  return {
    id: raw.id,
    productId: raw.product_id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    quantity: raw.quantity,
    reorderLevel: raw.reorder_level,
  };
}

interface BatchRaw {
  id: string;
  product_id: string;
  location_id: string;
  batch_number: string;
  expiry_date: string;
  mfg_date: string | null;
  quantity: string;
  mrp: string | null;
}

function mapBatch(raw: BatchRaw): Batch {
  return {
    id: raw.id,
    productId: raw.product_id,
    locationId: raw.location_id,
    batchNumber: raw.batch_number,
    expiryDate: raw.expiry_date,
    mfgDate: raw.mfg_date,
    quantity: raw.quantity,
    mrp: raw.mrp,
  };
}

interface ImportReportRaw {
  created: number;
  updated: number;
  errors: ImportRowError[];
  target_location: string | null;
}

function mapImportReport(raw: ImportReportRaw): ImportReport {
  return {
    createdCount: raw.created,
    updatedCount: raw.updated,
    errors: raw.errors,
    targetLocation: raw.target_location,
  };
}

export const inventoryService = {
  /**
   * No pagination — the backend returns everything visible to the actor
   * (manager pre-scoped to their business); filter/search client-side.
   * `locationId` omitted → the raw master catalog. Passed → the effective
   * per-location view (see `Product.effectiveSellingPrice`'s own comment).
   */
  async listProducts(locationId?: string): Promise<Product[]> {
    const body = await unwrap<ProductRaw[]>(
      apiClient.get('/tenant/products/', {
        params: locationId ? { location_id: locationId } : undefined,
      }),
    );
    return body.map(mapProduct);
  },

  /**
   * Gated by `max_products` — a lenient-mode tenant at/over its cap still
   * gets the product created, with a warning in `meta`; a strict-mode
   * tenant gets a 422 `quota_exceeded` instead (surfaces as a normal
   * `ApiError`, `describeApiError` already renders its message).
   */
  async createProduct(
    request: ProductRequest,
  ): Promise<{ product: Product; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<ProductRaw>(
      apiClient.post('/tenant/products/', productRequestToBody(request)),
    );
    return { product: mapProduct(data), warning: (meta.warning as string) ?? null };
  },

  async updateProduct(id: string, request: Partial<ProductRequest>): Promise<Product> {
    const raw = await unwrap<ProductRaw>(
      apiClient.patch(`/tenant/products/${id}/`, productRequestToBody(request)),
    );
    return mapProduct(raw);
  },

  async deactivateProduct(id: string): Promise<Product> {
    const raw = await unwrap<ProductRaw>(apiClient.post(`/tenant/products/${id}/deactivate/`));
    return mapProduct(raw);
  },

  /** Reactivating consumes a seat exactly like a create — same quota gating, same `warning` shape. */
  async activateProduct(id: string): Promise<{ product: Product; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<ProductRaw>(
      apiClient.post(`/tenant/products/${id}/activate/`),
    );
    return { product: mapProduct(data), warning: (meta.warning as string) ?? null };
  },

  /** Distinct non-empty `category` values across the actor's visible products — feeds the "existing or free-text" category field's `<datalist>` suggestions. */
  async listCategories(): Promise<string[]> {
    return unwrap<string[]>(apiClient.get('/tenant/products/categories/'));
  },

  /** One row per active location of the product's business — inherited (master) defaults where no override exists. Powers `ProductLocationsModal`. */
  async listProductLocations(productId: string): Promise<ProductLocationOverrideRow[]> {
    const body = await unwrap<ProductLocationOverrideRowRaw[]>(
      apiClient.get(`/tenant/products/${productId}/locations/`),
    );
    return body.map(mapProductLocationOverrideRow);
  },

  /** Partial upsert of one location's override — see `ProductLocationOverrideRequest`'s own doc for omit-vs-null semantics. */
  async upsertProductLocationOverride(
    productId: string,
    locationId: string,
    request: ProductLocationOverrideRequest,
  ): Promise<ProductLocationOverrideRow> {
    const raw = await unwrap<ProductLocationOverrideRowRaw>(
      apiClient.post(
        `/tenant/products/${productId}/locations/${locationId}/`,
        productLocationOverrideRequestToBody(request),
      ),
    );
    return mapProductLocationOverrideRow(raw);
  },

  /** Removes a location's override entirely — back to fully inheriting the master product. Idempotent. */
  async clearProductLocationOverride(productId: string, locationId: string): Promise<void> {
    await apiClient.delete(`/tenant/products/${productId}/locations/${locationId}/`);
  },

  /** Sets the *absolute* quantity at one location — rejected server-side (400) if the product is batch-tracked; use `upsertBatch` for those instead. */
  async setStock(productId: string, request: StockSetRequest): Promise<StockItem> {
    const raw = await unwrap<StockItemRaw>(
      apiClient.post(`/tenant/products/${productId}/stock/`, {
        quantity: request.quantity,
        reorder_level: request.reorderLevel,
        location_id: request.locationId,
      }),
    );
    return mapStockItem(raw);
  },

  /** Adds `delta` (+/-) to the existing quantity — rejected if the result would go negative, or if the product is batch-tracked. */
  async adjustStock(productId: string, request: StockAdjustRequest): Promise<StockItem> {
    const raw = await unwrap<StockItemRaw>(
      apiClient.post(`/tenant/products/${productId}/stock/adjust/`, {
        delta: request.delta,
        location_id: request.locationId,
      }),
    );
    return mapStockItem(raw);
  },

  /** Every batch for the product across all locations, FEFO order (earliest `expiry_date` first) — matches the order sales actually consume stock in. */
  async listBatches(productId: string): Promise<Batch[]> {
    const body = await unwrap<BatchRaw[]>(apiClient.get(`/tenant/products/${productId}/batches/`));
    return body.map(mapBatch);
  },

  /** Upsert by `(location, batchNumber)` — re-submitting an existing batch number at the same location *replaces* its quantity/expiry/mfg/mrp, it doesn't add to it. Rejected server-side if the product isn't batch-tracked. */
  async upsertBatch(productId: string, request: BatchRequest): Promise<Batch> {
    const raw = await unwrap<BatchRaw>(
      apiClient.post(`/tenant/products/${productId}/batches/`, {
        batch_number: request.batchNumber,
        expiry_date: request.expiryDate,
        quantity: request.quantity,
        mfg_date: request.mfgDate,
        mrp: request.mrp,
        location_id: request.locationId,
      }),
    );
    return mapBatch(raw);
  },

  /** Multipart field name is `image` (not `file`) — the backend's own naming, mirrored here rather than picked freely. Max 5MB, JPEG/PNG/WebP only (enforced server-side; `ProductFormModal` mirrors the same limits for instant feedback before the round-trip). */
  async uploadProductImage(productId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const data = await unwrap<{ image_url: string }>(
      apiClient.post(`/tenant/products/${productId}/image/`, formData),
    );
    return data.image_url;
  },

  async removeProductImage(productId: string): Promise<void> {
    await apiClient.delete(`/tenant/products/${productId}/image/`);
  },

  /**
   * Raw `.xlsx` binary, not the JSON envelope — fetched as a `Blob` and
   * handed to the caller to trigger a browser download (object URL + a
   * throwaway `<a download>` click), same as any other "download this
   * file" flow has to work without a dedicated browser API for it.
   */
  async downloadImportTemplate(entityType: EntityType): Promise<Blob> {
    const response = await apiClient.get<Blob>('/tenant/products/import-template/', {
      params: { entity_type: entityType },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Always resolves with a report even when every row failed — per-row
   * problems land in `report.errors`, they don't reject this promise. This
   * only rejects for a whole-request failure (unreadable/non-`.xlsx` file,
   * a `business_id` that doesn't resolve) — same `ApiError` shape as any
   * other failed call, `describeApiError` already renders it.
   */
  async importProducts(file: File, businessId?: string): Promise<ImportReport> {
    const formData = new FormData();
    formData.append('file', file);
    if (businessId) formData.append('business_id', businessId);
    const raw = await unwrap<ImportReportRaw>(apiClient.post('/tenant/products/import/', formData));
    return mapImportReport(raw);
  },
};
