# reports module

Sales summary (by day / location / business) and GST summary (GSTR-1-style
HSN-wise breakdown), both computed client-side — sales from `useOrders()`
(`@/modules/billing`), GST from real generated `Invoice` rows
(`apps/invoicing/`, `GET /tenant/invoices/`) rather than re-deriving tax
figures from raw order totals. There's still no dedicated backend `reports`
module (see `POSCountr-build-context.md` §9) — this is the interim
client-side-aggregated dashboard the roadmap flagged as an option.

Built as part of **F7 — Reports & Settings**. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D6.
