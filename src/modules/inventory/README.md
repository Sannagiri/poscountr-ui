# inventory module

Tenant Admin + Manager's "Products" screen (F5). See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D4.

## Built (F5)

- **Products** (`/inventory`) — every product visible to the actor (manager
  scoped to their own business server-side, tenant_admin sees everything),
  as a flat table: search, category/business/status/low-stock filters, a row
  click or "Edit" action opens `ProductFormModal`. Deactivate/Activate follow
  the same per-page mutation + `ConfirmDialog` pattern every other list
  screen in the app already uses.
- **Product create/edit** (`ProductFormModal`) — one modal for both. Create
  only shows universal fields (name, SKU, category, unit, barcode, pricing,
  GST, HSN, description, optional opening stock/reorder) since there's no
  `entity_type` available client-side before a product exists — neither the
  frontend nor a manager (who can't call `/tenant/businesses/` at all) has
  any way to know it upfront. A successful create swaps the same modal
  instance straight into editing that new product, where its
  `isStockTracked`/`isBatchTracked` flags (computed server-side from the
  business's `entity_type`) are now known, so restaurant fields (veg,
  kitchen station, availability), pharmacy fields (manufacturer, schedule,
  composition), and the Stock/Batches/Image management buttons all appear
  immediately rather than needing a second trip back.
- **Stock** (`StockModal`) — per-location on-hand quantity for a plain
  stock-tracked (non-pharmacy) product: a table of existing locations'
  stock, "Set" (absolute) and "Adjust" (+/-) per row, plus "Add stock at
  another location." Reads `product.stock` (embedded on every product
  response) rather than a separate fetch.
- **Batches** (`BatchesModal`) — pharmacy-only, FEFO order (earliest expiry
  first, matching the order sales actually consume stock in). Add/edit is
  one upsert form — re-using an existing batch number at the same location
  replaces its quantity/expiry rather than adding a second row. "Next" and
  "Expiring soon"/"Expired" badges are client-side-only (the backend
  computes no such flag itself).
- **Image** (`ProductImageField`, inline in `ProductFormModal`) — a plain
  file-picker button (not drag-and-drop, per this phase's confirm-first
  choice) + thumbnail preview + remove. Mirrors the backend's own ≤5MB
  JPEG/PNG/WebP limits client-side for instant feedback.
- **Categories** — a `<datalist>`-backed `Input` (existing suggestions +
  free text), not a fixed `Select` — categories are free text on the
  backend, not a separate model.
- **Excel import** (`ImportProductsModal`) — entity-type template download
  (raw `.xlsx` blob, not the JSON envelope) + upload + a report Modal
  (summary strip + scrollable per-row error table), per this phase's
  confirm-first choice. Always resolves with a report even when every row
  failed — per-row problems don't stop the rest of the file from importing.
- **Low stock** — a row's own quantity vs. its `reorderLevel`; a row only
  counts as low once a threshold is actually set (`reorderLevel > 0`), so a
  brand-new product with no threshold configured doesn't render as low
  stock from the moment it's created. Surfaced as a per-row badge, a
  DataTable filter, and a summary banner atop the Products page — per this
  phase's confirm-first choice. The backend computes no `is_low_stock` flag
  itself; this is entirely client-side over already-fetched data.

## Deliberately out of scope for this pass

- **Proactive product-quota usage** — `TenantLicenseUsageView`
  (`GET /tenant/license/usage/`) only covers `business_entities`/
  `locations`; it doesn't include `max_products`. Product creation/
  reactivation still surfaces the backend's own reactive `meta.warning`
  (lenient mode) / 422 `quota_exceeded` (strict mode) via the normal toast/
  error path — same as every quota-gated create before the proactive
  license-usage panel existed for businesses/locations. Adding products to
  that endpoint would be a small, self-contained backend follow-up if a
  proactive banner is wanted here too.
- **Server-side filters** — the planning doc's own D4 table promised
  `category`/`business`/`location`/`low-stock` query params on
  `GET /tenant/products/`; none are actually implemented
  (`ProductListCreateView.get` takes none). Every filter here runs
  client-side over the one full list instead.
