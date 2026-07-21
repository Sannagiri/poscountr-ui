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
 * off these two flags rather than a literal `entity_type` string, since
 * that string isn't available here at all (see `ProductRequest`'s comment
 * for why the create form can't know it upfront either).
 */
export interface Product {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  sku: string;
  category: string;
  unit: Unit;
  barcode: string | null;
  sellingPrice: string;
  mrp: string | null;
  costPrice: string | null;
  gstRate: string;
  hsnCode: string;
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
 * (`manufacturer`/`schedule`/`composition`) fields are accepted here too,
 * but the create *form* only shows the universal fields — before a product
 * exists there's no `is_stock_tracked`/`is_batch_tracked` to gate them on,
 * and neither the frontend nor a `manager` (who can't call the
 * businesses-list endpoint at all) has any other way to know the target
 * business's `entity_type` ahead of time. `ProductFormModal` re-opens in
 * edit mode straight after a successful create, where those flags are now
 * known, so filling in the type-specific fields is still just one step
 * away rather than a dead end.
 */
export interface ProductRequest {
  businessId?: string;
  name: string;
  sku: string;
  category?: string;
  unit?: Unit;
  barcode?: string;
  sellingPrice: string;
  mrp?: string;
  costPrice?: string;
  gstRate?: string;
  hsnCode?: string;
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
