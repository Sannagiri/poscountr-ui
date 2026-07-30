# Reports dashboard — session handoff

Context for continuing this work in a new session. Read this first, then check
`git status`/`git diff` in both repos (nothing is committed yet — all changes
are working-tree edits) to see exact current state.

## Repos involved

- Backend: `/Users/sannagiriraviteja/Aarvin Technologies/API-POSCountr/poscountr-api`
- Frontend: `/Users/sannagiriraviteja/Aarvin Technologies/API-POSCountr/POSCountr-UI`

## What this whole thread was about

User wanted the Reports page's "Sales summary" tab rebuilt from a plain table
into a real analytics dashboard (KPI tiles w/ deltas, daily trend chart,
category/payment mix, top products, store performance, representative
transactions) — modeled loosely on a reference sample report they shared
(Northstar POS demo CSV/DOCX, no longer needed, was just a field-list
reference). Export (CSV/Word) is explicitly out of scope for now — UI first.

Along the way this expanded into: adding `payment_method` + a full layered
discount model to `Order`/`OrderItem` (they didn't exist before), a new
backend `apps/reports/` aggregation app, and now a round of UI polish
requests on the dashboard itself.

## Fully DONE and verified (do not redo)

1. **`payment_method` + layered discount model** (backend, fully migrated & tested):
   - `apps/billing/constants.py` — `PaymentMethod` choices.
   - `apps/billing/models/order.py` — `Order.payment_method`, `Order.discount_percent` (order-level %, set at creation), `Order.discount_amount` (derived money value of the order-level discount only).
   - `apps/billing/models/order_item.py` — `OrderItem.discount_percent` (per-line %, set when the line is added), `line_total` now nets it in.
   - **Layering**: each line's own `discount_percent` applies first (baked into `line_total`), then `Order.discount_percent` applies on top of the summed (already line-discounted) subtotal. See `OrderService._recompute_totals`/`_upsert_item` in `apps/billing/services/order_service.py` — this is the reference implementation for the math.
   - `payment_method` is captured ONLY at completion (`OrderCompleteInputSerializer`, `OrderService._complete`) — required there. Discounts are captured ONLY at creation/line-add time (`OrderCreateInputSerializer`, `OrderLineInputSerializer`, `OrderItemInputSerializer`) — NOT at completion anymore (this was reworked mid-session after initially building it at completion time — if you see any remaining references to discount-at-completion, that's stale, remove it).
   - `apps/invoicing/services/tax_service.py::compute_tax_split` takes `discount_amount` (the order-level portion) and prorates it across lines before computing CGST/SGST/IGST — this makes GST correctly charged on the post-discount amount. Item-level discounts don't need special handling here since they're already baked into `line_total` before this function runs.
   - `apps/invoicing/models/invoice.py` — `Invoice.discount_amount` snapshot field added.
   - `apps/invoicing/serializers/output.py::get_hsn_summary` — also prorates the discount so the HSN table foots to the invoice's own totals.
   - Migrations: `apps/billing/migrations/0007_...` (payment_method + discount fields), `0008_...` (discount_percent rework), `apps/invoicing/migrations/0004_invoice_discount_amount.py`. All applied to the dev DB already.
   - **Verified**: service-layer smoke test, real HTTP round-trip via curl, and a live browser test all confirmed the math end-to-end (item discount → order discount → tax → invoice → HSN summary all reconcile exactly).

2. **New backend app `apps/reports/`** — `GET /tenant/reports/summary?from=&to=&business_id=&location_id=`:
   - `apps/reports/selectors/dashboard.py` — the aggregation queries (kpi, daily_trend, category_mix, payment_mix, top_products, store_performance, representative_transactions). **Important**: deliberately split into several small `.values().annotate()` queries per section rather than one combined query, to avoid a Django multi-relation-fan-out bug (joining Order→OrderItem in the same aggregate as Order-level sums would inflate the Order-level sums). Read the module docstring before touching this file.
   - `apps/reports/services/dashboard_service.py` — date parsing/validation, manager row-scoping (mirrors `InvoiceService.list_for_actor`).
   - `apps/reports/serializers/output.py`, `apps/reports/views/dashboard.py`, `apps/reports/urls.py`.
   - Registered in `config/settings/base.py` (`LOCAL_APPS`) and `config/urls.py`.
   - Response shape uses `date_from`/`date_to` inside `range` (not `from`/`to` — `from` is a Python keyword, can't be a serializer field name).
   - **Verified**: direct service call, real HTTP curl, and live browser render all matched exactly.

3. **Seed data** (`apps/platform/management/commands/seed_demo_business.py`) — updated for the new discount model (order-level + per-item `discount_percent`, realistic distributions), payment methods (UPI-heavy). Idempotent — re-run any time with `docker exec poscountr-api-web-1 python manage.py seed_demo_business`. Also fixed a real bug found mid-session: the original version didn't advance `OrderSettings.numbering_start` past the seeded block, which would have broken real order-number allocation for the tenant — now fixed via `_reserve_order_numbering_past`.

4. **Two live bugs found & fixed while the user was testing** (`POSCountr-UI/src/modules/billing/pages/NewOrderPage.tsx`):
   - Stale `locationId` from a previously-selected business surviving a business switch (sessionMemory persisted it, nothing cleared it) — now cleared via a `useEffect` before `useAutoSelectSingle` runs.
   - Inactive locations were selectable in the picker — `filteredLocations` now filters `location.isActive`.
   - Also: location picker is now always shown (was hidden when only 1 option) so it's always clear which location an order targets.

5. **Frontend discount UX** — fully rebuilt mid-session per user feedback (originally built at completion time as a flat amount, then reworked to %, then to layered %-at-creation):
   - `NewOrderPage.tsx`: cart has a per-item "Item discount %" input on each line, plus an order-level "Order discount (optional) %" field, both default 0, live "Estimated total" preview. Completion modal now asks ONLY for payment method (no discount — that's already locked in by then).
   - `OrderDetailPage.tsx`: completion modal is payment-method-only too. Items table shows a Discount column. Totals card shows an "Order discount" line when present.
   - `thermalBillPdf.ts`: per-item discount shown inline on the item name (`"Product (-20%)"`), order-level discount shown as its own line before the tax breakdown.
   - Types/service layer: `billing.types.ts`, `billingService.ts` all updated (`discountPercent` on Order/OrderItem, `discountAmount` still there as the derived order-level money value, `complete()` no longer takes a discount param).

6. **Reports dashboard v1 — built and visually verified**:
   - `POSCountr-UI/src/modules/reports/components/`: `KpiTile`, `KpiStrip`, `DailyTrendChart`, `CategoryMixChart`, `PaymentMixChart`, `TopProductsChart`, `StorePerformanceTable`, `TopProductsTable`, `RepresentativeTransactionsTable` — all built, typechecked, linted, and visually confirmed rendering correctly against real seeded data in the browser.
   - `reportsService.ts`/`reports.types.ts`/`useReportsDashboard` hook/`REPORTS_QUERY_KEYS.dashboard` all added.
   - `ReportsPage.tsx` rewired: Sales summary tab now uses the dashboard endpoint (KPI strip with period-over-period deltas computed by calling the endpoint twice — current range + previous equal-length range); GST summary tab is untouched.
   - `recharts` installed as a new dependency.
   - Chart colors: used the dataviz skill's validated 8-hue categorical palette (`src/styles/colors.ts::categoricalPalette`, `categoricalColorAt()`, `paymentMethodColorRole`) — already validated against this app's white card surface via the skill's `validate_palette.js` script, don't need to re-validate unless colors change.
   - KPI tiles got an icon-chip treatment (lucide-react icons in colored circles) using the *existing* `CardHeader` icon-chip pattern already in this codebase — this was per user feedback ("modern, Metronic-style, not the plain reference report look").

## IN PROGRESS — mid-edit when context ran out, pick up here

The user gave 6 concrete pieces of UI feedback after seeing the v1 dashboard live. Tasks 16-20 in the task list track these (task 16 partially done). **None of these are committed to git yet.**

### Task 16 — Compact KPI number formatting (PARTIALLY DONE)
User: *"In the main cards - Shorten the values to K, L, M... instead of showing entire number as 6050000"*

- **Done**: `KpiStrip.tsx` now uses `formatCompactMoney()` (already existed in `reportsFormat.ts` — Indian-style, ₹1.3L / ₹4.2k) instead of `formatMoney()` for Gross sales / Discounts / Net sales / Avg order value. Transactions/Units sold/Cancelled orders left as plain integers (already short).
- **Not done yet**: was about to add a `title` attribute (native browser tooltip) to `KpiTile.tsx`'s value `<p>` showing the exact full figure on hover, for anyone who wants precision. Trivial — add `title={value}` won't work since `value` is already the compact string; need to pass the *full* formatted value separately as a new optional prop, e.g. `fullValue?: string`, and set `title={fullValue}` on the `<p>` in `KpiTile.tsx`. Then in `KpiStrip.tsx` pass both `value={formatCompactMoney(...)}` and `fullValue={formatMoney(...)}` for the money tiles.
- Verify visually after: numbers should read like `₹6.0L` not `₹602055.12`.

### Task 17 — Hover-only donuts, no persistent legend (NOT STARTED)
User: *"I think making Category sales, Payments methods and Store Performance as the pie charts without any notations and on hover we see what is that and in export we make some line and display those"*

Meaning:
- `CategoryMixChart.tsx` and `PaymentMixChart.tsx` currently render a donut **plus** an always-visible `<ul>` legend list (name + revenue + share%) beside it. **Remove the legend list** — just the clean donut, identity/values revealed via the existing `Tooltip`/hover only.
- **Store Performance needs to become a donut too** — right now it's only `StorePerformanceTable.tsx` (a table). Build a new `StorePerformanceChart.tsx` (donut, hover-only, same style as Category/Payment) using the categorical palette. Decide whether to keep `StorePerformanceTable` on-screen too or drop it in favor of the chart — given the user's "not the numbers" philosophy and that detail is moving to the future export, my read is: **drop the table from the live page, show only the donut**. Add it in `ReportsPage.tsx` where `StorePerformanceTable` currently is, same `showStorePerformance` gating condition.
- **Accessibility note for whoever picks this up**: the dataviz skill's validated categorical palette has 3/8 slots that sit below 3:1 contrast on a light surface and are only "legal" with a visible-label relief channel (a persistent legend or table). Removing the legend trades that away — this was an explicit, informed user decision (they want the detail to live in the export instead), not an oversight. Don't silently re-add the legend "to be safe" — that's relitigating a decision already made. If you want a lightweight compromise, a center label on the donut (e.g. total revenue) is fine and doesn't reintroduce the removed per-slice legend.
- "In export we make some line and display those" confirms the textual breakdown belongs in the *future* CSV/Word export deliverable, not this pass — just keep it in mind for when that work starts (it's currently not built at all, see original scope).

### Task 18 — Fix TopProductsChart bar order bug + truncate names (NOT STARTED)
User: *"Top Products - I think we can shorten the name to one line and reverse the order of the display"*

- **Real bug found**: `TopProductsChart.tsx` currently does `const chartData = [...data].reverse()` based on an incorrect assumption that Recharts renders vertical category bars bottom-up by default. Screenshot evidence during this session showed the OPPOSITE: the lowest-revenue item of the top-10 was rendering at the top, highest at the bottom — backwards from the intended "rank 1 at top" leaderboard order. **Fix: remove the `.reverse()` entirely**, just pass `data` as-is (already sorted highest-revenue-first by the backend) directly to the `BarChart`. This should put rank 1 at the top, matching normal expectation, and also directly satisfies "reverse the order of the display" (reversing FROM the current buggy state back to correct).
- **Name truncation**: the `YAxis` category labels (product names) can wrap/overflow. Add single-line truncation — either a custom Recharts `tick` render function that truncates + adds `…`, or simpler: pre-truncate the `name` in the chart's own data mapping (e.g. `name.length > 18 ? name.slice(0, 16) + '…' : name`) before passing to the chart, keeping the full name available via the existing tooltip.

### Task 19 — Two-column Top 10 products list with medals, no scroll (NOT STARTED)
User: *"Top 10 products make it two parts without scrolling - 5 on left and 5 on right for first 3 we show the medals"*

- Rebuild `TopProductsTable.tsx` — currently a generic `DataTable` (scrollable). Replace with a custom two-column grid: rank 1-5 in the left column, rank 6-10 in the right column, laid out so nothing scrolls (e.g. `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2`, each column a simple list of rows, not `DataTable`).
- Ranks 1-3 (all in the left column, since 1-5 go left) get a medal indicator — 🥇🥈🥉 emoji, or a small colored circle with "1"/"2"/"3" in it if the team prefers not to use emoji (check `docs/coding-standards.md` / ask if unsure — this codebase's own convention elsewhere in the app avoids emoji in UI copy per the general "only use emojis if explicitly requested" instruction, so consider a numbered badge/icon instead of literal medal emoji unless the user specifically wants the emoji look).
- Each row: rank/medal, product name (truncate if long, same reasoning as task 18), category, units sold, revenue.

### Task 20 — Business-scoped dashboard + business selector (NOT STARTED)
User: *"Also this reports I want the business driven - Not all the business at once"* + *"To the right side of 'this month' we need the selection option for business"*

- **Root cause confirmed live**: the dashboard currently has no `business_id` filter applied, so for this tenant (which has 3 businesses: "La Rosatta", "RawMaterial Cafe", "lo-rosatta") it blends all of them together — visible in the live test as a stray "Hot Drinks" category that isn't part of La Rosatta's actual menu.
- Add a **Business** `Select` in `ReportsPage.tsx`, positioned to the right of the existing date-preset `Select` (same toolbar row, `flex flex-wrap items-center gap-2.5` div near the top).
- Only show it for `isTenantAdmin` (mirrors the exact pattern already used in `NewOrderPage.tsx` for its business picker — `useBusinesses({ enabled: isTenantAdmin })` from `@/modules/businesses`, check that hook's existing usage there for the convention).
- **No blended "all businesses" option** — always resolve to one concrete business. Auto-select the first business once `useBusinesses()` resolves (similar spirit to `useAutoSelectSingle`, though this always has a selection, not just when there's exactly one option) so the dashboard never renders blended data even before the user consciously picks one.
- Thread the selected `businessId` into `useReportsDashboard`'s filters (`ReportsDashboardFilters.businessId` already exists in the type and the backend already supports the `business_id` query param — no backend change needed, this is frontend-only).
- The `showStorePerformance` gating (`locationsQuery.data?.length ?? 0) > 1`) needs to filter `locationsQuery.data` **by the selected business** first (`location.businessId === selectedBusinessId`) before counting — right now it counts all of the tenant's locations across every business, which would be wrong once the page is business-scoped (e.g. La Rosatta has 1 location, but the tenant has 5 across all businesses).
- For a **manager**: they don't get the business picker (same as `NewOrderPage`), and their data is already scoped server-side to their assigned location regardless of what `business_id` is/isn't sent — no change needed for the manager path.

## Suggested order for the new session

1. Finish task 16's `title`/full-value tooltip (trivial, already mid-edit).
2. Task 18 (bug fix, small, no new components) — do this early since it's a real correctness bug, not just polish.
3. Task 20 (business selector) — do this before 17/19 if possible, since it changes what data is on screen while you're eyeballing the other visual changes (easier to verify 17/19 against clean single-business data).
4. Task 17 (donuts).
5. Task 19 (two-column top products).
6. Full re-verification pass in the browser (see "Dev environment" below), then typecheck + lint.

## Dev environment state (as of context handoff)

- Backend: Docker containers `poscountr-api-web-1` (Django, port 8200) and `poscountr-api-db-1` (Postgres) — already running, don't need to restart. Run Django commands via `docker exec poscountr-api-web-1 python manage.py ...`.
- Frontend: a Vite dev server was started manually via `nohup npm run dev` in `POSCountr-UI` (NOT via the `.claude/launch.json` "ui" config — that attempted to reuse a stale preview and didn't actually launch a fresh process reliably this session). It came up on **port 3201** (3200 was reported busy). Check with `lsof -nP -iTCP:3201 -sTCP:LISTEN` or just try `http://localhost:3201` — if it's not running, start it the same way: `cd POSCountr-UI && nohup npm run dev > /tmp/ui-dev-server.log 2>&1 & disown`, then check the log for the actual port.
- Login for testing: tenant `la-rosatta`, admin `owner@la-rosatta.demo` / `Demo@1234`. The login page's "Continue"/"Log in" buttons were flaky with the browser tool's coordinate-based click in this session (worked eventually after retries) — if this recurs, dispatch a JS click instead: `document.querySelector('button[type="submit"]').click()` via the `javascript_tool`, which worked reliably every time products/buttons didn't respond to coordinate clicks. Also note: this tenant has 3 real businesses now ("La Rosatta" — the seeded demo one — plus "RawMaterial Cafe" and "lo-rosatta", which the user created themselves while testing) — useful to know when eyeballing whether data looks business-scoped correctly.
- Any test orders created while verifying should be cleaned up afterward (see this session's pattern: `docker exec poscountr-api-web-1 python manage.py shell -c "..."` deleting by order id, inside `set_current_tenant_id(...)`/`clear_current_tenant_id()` — required because `Order`/`Invoice` are `TenantModel`s and their default manager is tenant-scoped via a Python thread-local, not just Postgres RLS, which isn't even enabled yet in this codebase).

## Key non-obvious things learned this session (avoid re-learning the hard way)

- **`TenantModel`'s default `.objects` manager is scoped by a Python thread-local (`apps.common.threadlocal`), not just Postgres RLS** (RLS isn't enabled on any table yet in this codebase, despite scaffolding existing for it in `apps/common/db.py`). Any one-off script/shell session touching tenant-scoped models needs `set_current_tenant_id(str(tenant.id))` first, or use `.global_objects` for cross-tenant reads. `Model.objects.create(...)` still works without this (INSERT doesn't go through the filtered queryset), but `.get()`/`.filter()`/`.get_or_create()` do not.
- **`unique_order_number_per_business` is business-wide, not per-day**, even though `OrderSettings.reset_period` defaults to `DAILY` — a literal daily-reset numbering scheme collides with itself across days unless something (the real `OrderNumberingService`'s collision-bump loop, or — for bulk-seeded historical data — a one-time `numbering_start` bump past the seeded range) accounts for it. See `_reserve_order_numbering_past` in the seed command for the pattern.
- **Recharts vertical `BarChart` with `YAxis type="category"` renders the data array top-to-bottom in array order** (index 0 at top) — do NOT reverse the array to try to put the highest value at top if the data is already sorted descending; that inverts it. (This was gotten wrong once this session — see task 18.)
- **The Claude Browser tool's coordinate-based `computer` click is unreliable against this app's custom Select/Button components** in this environment (clicks silently no-op sometimes, especially right after a viewport resize or on the first attempt). A JS `element.click()` via `javascript_tool` worked reliably every time coordinate clicks didn't. For native `<select>` elements hidden under a custom dropdown UI, `form_input` on the underlying native `<select>` (found via `read_page` with `filter: "all"`) works well and is more reliable than trying to click the custom dropdown's rendered options.
- **`apps/reports/` response uses `date_from`/`date_to`**, not `from`/`to`, inside the `range` object — `from` can't be a Python identifier/serializer field name.
