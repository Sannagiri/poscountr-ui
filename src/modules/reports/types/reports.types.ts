/**
 * Types mirror the real Django serializers in `apps/invoicing/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See `apps/invoicing/serializers/
 * output.py` (`InvoiceOutputSerializer`, `InvoiceHsnLineOutputSerializer`),
 * `apps/invoicing/models/invoice.py`.
 *
 * Decimal fields stay `string` end-to-end, same convention
 * `billing.types.ts`/`inventory.types.ts` already established — DRF's
 * `DecimalField` serializes as a string to avoid float precision loss.
 * Reports pages that need to sum/average these convert with `Number(...)`
 * at the point of aggregation, never earlier.
 */

/** One HSN-wise summary row (grouped from an invoice's order items, computed on read — never persisted). */
export interface InvoiceHsnLine {
  /** May be `''` — not every product has an HSN code set yet. */
  hsnCode: string;
  gstRate: string;
  taxableValue: string;
  taxAmount: string;
}

/**
 * A GST invoice generated from one completed order — money/tax-split/
 * customer fields are snapshotted at generation time (see the backend's
 * own doc comment on `Invoice`), never re-derived from the live order.
 */
export interface Invoice {
  id: string;
  orderId: string;
  businessId: string;
  locationId: string;
  /** Denormalized from the business/location the invoice was generated for — lets the client-rendered bill PDF (`thermalBillPdf.ts`) skip a separate business/location fetch, which matters since those list endpoints are tenant_admin-only while invoice reads are tenant_admin-or-manager. */
  businessName: string;
  businessGstin: string | null;
  locationName: string;
  locationAddressLine1: string;
  locationAddressLine2: string;
  locationCity: string;
  locationPincode: string;
  invoiceNumber: string;
  /** e.g. `'2026-27'`. */
  financialYear: string;
  sequenceNumber: number;
  issuedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  customerState: string;
  businessState: string;
  /** `true` -> IGST; `false` -> CGST + SGST. */
  isInterstate: boolean;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOff: string;
  total: string;
  /** `''` until the frontend-rendered PDF has been uploaded. */
  pdfUrl: string;
  pdfUploadedAt: string | null;
  hsnSummary: InvoiceHsnLine[];
}

/** `GET /tenant/invoices/` query params — all optional narrowing filters. */
export interface InvoiceListFilters {
  businessId?: string;
  locationId?: string;
  financialYear?: string;
}
