/**
 * Types mirror the real Django serializers in `apps/inventory/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See `apps/inventory/serializers/
 * {input,output}.py`, `apps/inventory/constants.py` (Unit, PharmacySchedule,
 * `flags_for`), `apps/inventory/models/{product,stock_item,batch}.py`.
 *
 * Decimal fields (`sellingPrice`, `quantity`, …) stay `string` end-to-end —
 * same convention `platform.types.ts`'s `LicenseType.price` already
 * established — since DRF's `DecimalField` serializes as a string to avoid
 * float precision loss, and every one of these is either displayed
 * verbatim or round-tripped through a form `Input` as text anyway.
 */

export type Unit =
  'pcs' | 'kg' | 'g' | 'litre' | 'ml' | 'pack' | 'box' | 'dozen' | 'plate' | 'bottle' | 'meter';

export type PharmacySchedule = 'otc' | 'h' | 'h1' | 'x' | 'g';

/** `stock` = normal catalog item; `service` = a recurring non-stock charge
 * (service/installation/inspection fee, etc.) — always forces
 * `isStockTracked`/`isBatchTracked` to `false` server-side, regardless of
 * the owning business's `entityType`. */
export type ProductType = 'stock' | 'service';

/** One location's on-hand quantity for a product — embedded directly on `Product` (`ProductOutputSerializer.get_stock`), not a separate fetch. */
export interface ProductStockRow {
  locationId: string;
  locationName: string;
  quantity: string;
  reorderLevel: string;
}

/**
 * A catalog product. `isStockTracked`/`isBatchTracked` are computed
 * server-side from the owning business's `entity_type` (`flags_for()`) and
 * never accepted from the client — the frontend gates entity-type-aware UI
 * off these two flags once a product exists. Before creation, `ProductFormModal`
 * derives the same two flags client-side from the target business's own
 * `entityType` (via `useBusinesses`), when that's available — see that
 * component's `flagsForEntityType`.
 */
export interface Product {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  sku: string;
  category: string;
  productType: ProductType;
  unit: Unit;
  barcode: string | null;
  sellingPrice: string;
  mrp: string | null;
  costPrice: string | null;
  gstRate: string;
  hsnCode: string;
  /** Auto-applied to a cart line's discount % when this product is added to an order in `NewOrderPage`; still editable per line there. */
  defaultDiscountPercent: string;
  /**
   * Always present — equals `sellingPrice`/`defaultDiscountPercent` when the
   * product list wasn't fetched for a specific location (`useProducts()`,
   * no arg), or that location's resolved override (falls back to the
   * master value per-field when there's no override, or the override
   * leaves a field unset) when it was (`useProducts(locationId)`). Use
   * these two — not the raw `sellingPrice`/`defaultDiscountPercent` — for
   * anything location-aware (`NewOrderPage`'s cart/estimate).
   */
  effectiveSellingPrice: string;
  effectiveDiscountPercent: string;
  description: string;
  imageUrl: string;
  isStockTracked: boolean;
  isBatchTracked: boolean;
  isVeg: boolean | null;
  kitchenStation: string;
  isAvailable: boolean;
  manufacturer: string;
  schedule: PharmacySchedule | '';
  composition: string;
  isActive: boolean;
  stock: ProductStockRow[];
  createdAt: string;
}

/**
 * `Product` minus server-assigned/derived fields — POST full, PATCH
 * partial. `businessId` only matters on create (a manager's is forced
 * server-side regardless of what's sent; a tenant_admin with more than one
 * business must supply it). `openingStock`/`reorderLevel`/`locationId` are
 * create-only and only take effect for a plain stock-tracked, non-batch
 * product — silently ignored for a restaurant/cafe (not stock-tracked) or
 * pharmacy (batch-tracked; use `BatchRequest` instead) business, per
 * `ProductService.create`.
 *
 * Restaurant (`isVeg`/`kitchenStation`/`isAvailable`) and pharmacy
 * (`manufacturer`/`schedule`/`composition`) fields are accepted here too.
 * `ProductFormModal`'s create form shows the relevant section immediately
 * when the target business's `entityType` is known client-side (the normal
 * tenant_admin path, via `useBusinesses`); a manager creating their own
 * product can't call that endpoint, so those sections stay hidden until
 * the product exists and can be filled in via Edit.
 */
export interface ProductRequest {
  businessId?: string;
  name: string;
  sku: string;
  category?: string;
  productType?: ProductType;
  unit?: Unit;
  barcode?: string;
  sellingPrice: string;
  mrp?: string;
  costPrice?: string;
  gstRate?: string;
  hsnCode?: string;
  defaultDiscountPercent?: string;
  description?: string;
  isVeg?: boolean | null;
  kitchenStation?: string;
  isAvailable?: boolean;
  manufacturer?: string;
  schedule?: PharmacySchedule | '';
  composition?: string;
  openingStock?: string;
  reorderLevel?: string;
  locationId?: string;
}

/**
 * One location's catalog override state for a product — GET
 * `/tenant/products/{id}/locations/`. `sellingPrice`/`defaultDiscountPercent`
 * are `null` when that field isn't overridden (inherits the master
 * `Product` value) — `hasOverride` is `false` when the location has no
 * override row at all (available, fully inherited).
 */
export interface ProductLocationOverrideRow {
  locationId: string;
  locationName: string;
  isAvailable: boolean;
  sellingPrice: string | null;
  defaultDiscountPercent: string | null;
  hasOverride: boolean;
}

/**
 * Partial upsert of one location's override — an omitted key leaves that
 * field unchanged; an explicit `null` on `sellingPrice`/`defaultDiscountPercent`
 * clears it back to "inherit from the master product".
 */
export interface ProductLocationOverrideRequest {
  isAvailable?: boolean;
  sellingPrice?: string | null;
  defaultDiscountPercent?: string | null;
}

/** On-hand stock of one product at one location — the dedicated stock endpoints' response shape (same fields as `ProductStockRow`, plus its own id). */
export interface StockItem {
  id: string;
  productId: string;
  locationId: string;
  locationName: string;
  quantity: string;
  reorderLevel: string;
}

/** Sets the *absolute* quantity (and optionally `reorderLevel`) at one location. Rejected server-side for a batch-tracked product — use `BatchRequest` instead. */
export interface StockSetRequest {
  quantity: string;
  reorderLevel?: string;
  locationId?: string;
}

/** Adds `delta` (positive or negative) to the existing quantity at one location; rejected if the result would go negative, or if the product is batch-tracked. */
export interface StockAdjustRequest {
  delta: string;
  locationId?: string;
}

/** One batch (lot) of a batch-tracked (pharmacy) product at one location. Ordered earliest-`expiryDate`-first everywhere the backend returns it — FEFO order, the same order sales consume stock in. */
export interface Batch {
  id: string;
  productId: string;
  locationId: string;
  batchNumber: string;
  expiryDate: string;
  mfgDate: string | null;
  quantity: string;
  mrp: string | null;
}

/**
 * Upserts a batch — the unique key is `(product, location, batchNumber)`,
 * and re-posting an existing `batchNumber` at the same location *replaces*
 * its quantity/expiry/mfg/mrp rather than adding to it. Rejected
 * server-side if the product isn't batch-tracked.
 */
export interface BatchRequest {
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  mfgDate?: string;
  mrp?: string;
  locationId?: string;
}

/** One row's failure from an Excel import — `row` is the 1-based spreadsheet row number (header is row 1, first data row is 2). */
export interface ImportRowError {
  row: number;
  message: string;
}

/**
 * `POST /tenant/products/import/`'s result — always a 200 success envelope,
 * even when every row failed (per-row problems are caught individually and
 * pushed into `errors`, processing continues; only a whole-request problem
 * like an unreadable file is a real HTTP error). `createdCount + updatedCount`
 * can be less than the number of data rows in the sheet — the gap is
 * `errors.length`. `targetLocation` is `null` when the business has no
 * active location at all (products still import; any opening stock/batch
 * rows for them are silently skipped).
 */
export interface ImportReport {
  createdCount: number;
  updatedCount: number;
  errors: ImportRowError[];
  targetLocation: string | null;
}
