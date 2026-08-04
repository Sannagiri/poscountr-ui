import type { BusinessEntity, Location } from '@/modules/businesses';
import type { LayoutConfig } from '@/modules/documentLayouts';
import {
  buildDocumentPdf,
  documentLayoutsService,
  SYSTEM_DEFAULT_LAYOUT_CONFIG,
} from '@/modules/documentLayouts';
import type {
  RenderContext,
  RenderTotalsRow,
} from '@/modules/documentLayouts/pdf/blockRenderers/types';
import type { Align } from '@/modules/documentLayouts/pdf/pdfPrimitives';
import {
  addressDisplayLines,
  decodeLogo,
  formatDate,
  formatPlainDate,
  formatRate,
  money,
} from '@/modules/documentLayouts/pdf/pdfPrimitives';
import type { ItemColumns } from '@/modules/documentLayouts/pdf/tableRenderer';
import type { Unit } from '@/modules/inventory';
import { formatQuantity } from '@/modules/inventory';
import type { InvoiceSettings } from '@/modules/settings';

import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '../types/purchasing.types';

/**
 * Renders a purchase order as a formal A4 "PURCHASE ORDER" document — the
 * kind you'd send to the supplier, not a thermal receipt.
 *
 * Thin wrapper around the data-driven `buildDocumentPdf` orchestrator
 * (`src/modules/documentLayouts/pdf/`) — see `invoicePdf.ts`'s own doc
 * comment for the shared shape every `build<X>Pdf` now follows. Whether
 * Header Notes/Footer Notes/Signature actually render is entirely the
 * resolved layout's own call now (`config.header_notes`/`footer_notes`/
 * `signature`, authored in the layout builder) — this wrapper no longer
 * hardcodes any of it into `RenderContext`.
 */
export interface PurchaseOrderPdfInput {
  purchaseOrder: PurchaseOrder;
  invoiceSettings: InvoiceSettings;
  /** Pre-fetched logo bytes — see `ThermalBillInput.logoBlob`'s doc comment for why the fetch happens in the caller (CORS). Omit or pass `null` to render with no logo. */
  logoBlob?: Blob | null;
  /**
   * Best-effort extra context beyond what's already snapshotted on the
   * purchase order itself (`locationName`/`businessState`/`supplierName`/
   * `supplierGstin`/`supplierPhone`/`supplierState`). `business`/`location`
   * come from `useBusinesses`/`useLocations`, both `IsTenantAdmin`-gated
   * server-side — a manager viewing this page can't resolve either (same
   * constraint `NewOrderPage` already documents), so the caller passes
   * `null`/`undefined` for them in that case and this template simply omits
   * whatever it doesn't have rather than blocking the document.
   */
  business?: BusinessEntity | null;
  location?: Location | null;
  /** The full supplier record, for its address — best-effort the same way. */
  supplier?: Supplier | null;
  /**
   * The layout-switcher's on-the-fly choice (`PurchaseOrderBillPreviewModal`)
   * — when given, used directly as `config` and the `resolveEffective`
   * network call below is skipped entirely (the modal already has the full
   * config, from `useEffectiveLayout`'s own `alternatives`/
   * `useLayoutTemplate`). Never threaded into `ensurePdfUploaded`'s
   * persistence path — a switcher choice only affects the preview blob,
   * never what gets uploaded once.
   */
  layoutOverride?: LayoutConfig;
}

const CONTENT_WIDTH_MM = 210 - 16 * 2;

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid in full',
  partial: 'Partially paid',
  credit: 'On credit',
};

/**
 * Column order/format shared across every item table in the app (quotations,
 * purchase orders, invoices): `SI, Description, [Batch], Qty (with unit),
 * Tax (%), Rate (Rs.), [Disc %], Amount (Rs.)`. Both `Batch` and `Disc %`
 * are omitted entirely when nothing on the document needs them — `Batch`
 * only appears when at least one line actually carries a batch number,
 * `Disc %` only when at least one line has a discount. Passed into
 * `RenderContext.buildItemColumns` rather than duplicated into
 * `tableRenderer.ts`, which stays doc-type-agnostic.
 */
function buildItemColumns(items: PurchaseOrderItem[]): ItemColumns<PurchaseOrderItem> {
  const hasBatches = items.some((item) => item.batchNumber);
  const hasDiscount = items.some((item) => Number(item.discountPercent) > 0);

  // Every branch shares the same key set (`batch: 0`/`discount: 0` when
  // unused) so `fixed` stays one consistent object type instead of a union
  // TS can't narrow purely from the boolean checks above.
  const fixed = {
    si: 10,
    batch: hasBatches ? 20 : 0,
    qty: 22,
    tax: 16,
    rate: hasDiscount ? 24 : 26,
    discount: hasDiscount ? 16 : 0,
    amount: hasBatches ? 28 : 30,
  };
  const fixedSum = Object.values(fixed).reduce((sum, w) => sum + w, 0);
  const nameWidth = CONTENT_WIDTH_MM - fixedSum;

  const headers = [
    'SI',
    'Description',
    ...(hasBatches ? ['Batch'] : []),
    'Qty',
    'Tax (%)',
    'Rate (Rs.)',
    ...(hasDiscount ? ['Disc %'] : []),
    'Amount (Rs.)',
  ];
  const aligns: Align[] = [
    'center',
    'left',
    ...(hasBatches ? (['left'] as Align[]) : []),
    'right',
    'right',
    'right',
    ...(hasDiscount ? (['right'] as Align[]) : []),
    'right',
  ];
  const widths = [
    fixed.si,
    nameWidth,
    ...(hasBatches ? [fixed.batch] : []),
    fixed.qty,
    fixed.tax,
    fixed.rate,
    ...(hasDiscount ? [fixed.discount] : []),
    fixed.amount,
  ];

  return {
    headers,
    aligns,
    widths,
    nameColumnIndex: 1,
    cellsFor: (item, index) => {
      const cells = [String(index + 1), item.name];
      if (hasBatches) cells.push(item.batchNumber || '—');
      cells.push(
        // `unit` is `null` for an ad-hoc/external line (no catalog Product
        // behind it) — just the bare quantity then, no unit suffix.
        item.unit
          ? `${formatQuantity(item.quantity, item.unit as Unit)} ${item.unit}`
          : formatQuantity(item.quantity),
        formatRate(item.gstRate),
        money(item.purchasePrice, { bare: true }),
      );
      if (hasDiscount) {
        cells.push(Number(item.discountPercent) > 0 ? formatRate(item.discountPercent) : '—');
      }
      cells.push(money(item.lineTotal, { bare: true }));
      return cells;
    },
  };
}

/** Adapts `PurchaseOrder`/`business`/`location`/`supplier` into the doc-type-agnostic `RenderContext` `buildDocumentPdf` needs. */
function toPurchaseOrderRenderContext(
  input: PurchaseOrderPdfInput,
  logo: RenderContext<PurchaseOrderItem>['logo'],
): RenderContext<PurchaseOrderItem> {
  const { purchaseOrder, business, location, supplier } = input;

  const poInfoLines = [
    `PO No: ${purchaseOrder.purchaseNumber ?? '—'}`,
    `Date: ${formatDate(purchaseOrder.createdAt)}`,
  ];
  if (purchaseOrder.paymentStatus) {
    poInfoLines.push(
      `Payment: ${PAYMENT_STATUS_LABELS[purchaseOrder.paymentStatus] ?? purchaseOrder.paymentStatus}`,
    );
  }
  if (purchaseOrder.dueDate)
    poInfoLines.push(`Due date: ${formatPlainDate(purchaseOrder.dueDate)}`);
  // `documentMetaBlock` already renders its own "PO No"/"Date" lines from
  // `documentMeta.number`/`.date` — only the extra payment/due-date lines
  // belong in `extraLines`.
  const extraLines = poInfoLines.slice(2);

  const actualTotalDiffers =
    purchaseOrder.actualTotal != null &&
    Number(purchaseOrder.actualTotal) !== Number(purchaseOrder.total);

  const trailingRows: RenderTotalsRow[] = [];
  if (actualTotalDiffers && purchaseOrder.actualTotal != null) {
    trailingRows.push({ label: 'Actual bill amount', value: money(purchaseOrder.actualTotal) });
  }
  if (purchaseOrder.paymentStatus) {
    const amountPaid = Number(purchaseOrder.amountPaid ?? '0');
    const effectiveTotal = Number(purchaseOrder.actualTotal ?? purchaseOrder.total);
    const balanceDue = Math.max(0, effectiveTotal - amountPaid);
    trailingRows.push({ label: 'Amount paid', value: money(amountPaid) });
    if (balanceDue > 0) trailingRows.push({ label: 'Balance due', value: money(balanceDue) });

    // The bold right-aligned payment-status line (+ due date, for credit)
    // below the totals block — not a label/value pair like the rows above,
    // so it's a trailing row with an empty label (renders nothing at the
    // label position, same visual result as the original's single
    // right-aligned line).
    let statusText =
      PAYMENT_STATUS_LABELS[purchaseOrder.paymentStatus] ?? purchaseOrder.paymentStatus;
    if (purchaseOrder.paymentStatus === 'credit' && purchaseOrder.dueDate) {
      statusText += ` — due ${formatPlainDate(purchaseOrder.dueDate)}`;
    }
    trailingRows.push({ label: '', value: statusText, bold: true });
  }

  return {
    docType: 'purchase_order',
    logo,
    business: {
      businessName: business?.name ?? purchaseOrder.locationName,
      // Only shown as its own line when a separate `business` record
      // exists — otherwise `businessName` already fell back to
      // `locationName` above, and repeating it verbatim would look like a
      // duplicate, same original condition.
      locationName: business?.name ? purchaseOrder.locationName : undefined,
      addressLines: addressDisplayLines(location),
      phone: location?.phone,
      gstin: business?.gstin ?? undefined,
      state: purchaseOrder.businessState,
    },
    party: {
      name: purchaseOrder.supplierName,
      phone: purchaseOrder.supplierPhone,
      gstin: purchaseOrder.supplierGstin,
      state: purchaseOrder.supplierState,
      // Only the Supplier block shows a full postal address today — the
      // full `Supplier` record (`business`/`location` never carry one).
      addressLines: addressDisplayLines(supplier),
    },
    documentMeta: {
      number: purchaseOrder.purchaseNumber ?? '—',
      date: formatDate(purchaseOrder.createdAt),
      extraLines,
    },
    items: purchaseOrder.items,
    buildItemColumns,
    totals: {
      // See `quotationPdf.ts`'s own comment on `taxableValueLabel` — a
      // purchase order calls this line "Subtotal", not "Taxable value".
      taxableValueLabel: 'Subtotal',
      taxableValue: purchaseOrder.subtotal,
      isInterstate: purchaseOrder.isInterstate,
      cgst: purchaseOrder.cgstAmount,
      sgst: purchaseOrder.sgstAmount,
      igst: purchaseOrder.igstAmount,
      total: purchaseOrder.total,
      trailingRows,
    },
    paymentDetails: [],
  };
}

/**
 * Renders a purchase order as a formal A4 "PURCHASE ORDER" document. Async
 * for two reasons: the logo (if any) has to be decoded, and the business's
 * effective layout has to be resolved from the backend before anything
 * gets drawn.
 */
export async function buildPurchaseOrderPdf(input: PurchaseOrderPdfInput): Promise<Blob> {
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  // A broken layout-fetch (network error, or no auth context in some edge
  // case) should never block someone from generating/previewing a document
  // — fall back to the same hardcoded arrangement this renderer replaced.
  // `layoutOverride` (the preview modal's switcher choice) skips this
  // network call entirely — the caller already resolved the full config.
  const config =
    input.layoutOverride ??
    (await documentLayoutsService
      .resolveEffective({
        businessId: input.purchaseOrder.businessId,
        documentType: 'purchase_order',
      })
      .then((effective) => effective.config as LayoutConfig)
      .catch(() => SYSTEM_DEFAULT_LAYOUT_CONFIG));

  const context = toPurchaseOrderRenderContext(input, logo);
  return buildDocumentPdf({ docType: 'purchase_order', config, context });
}
