import type { BusinessEntity, Location } from '@/modules/businesses';
import type { LayoutConfig } from '@/modules/documentLayouts';
import {
  buildDocumentPdf,
  documentLayoutsService,
  SYSTEM_DEFAULT_LAYOUT_CONFIG,
} from '@/modules/documentLayouts';
import type { RenderContext } from '@/modules/documentLayouts/pdf/blockRenderers/types';
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
import type { PaymentDetail } from '@/modules/paymentDetails';
import type { InvoiceSettings } from '@/modules/settings';

import type { Quotation, QuotationItem } from '../types/quotation.types';

/**
 * Renders a "QUOTATION" document (the offer sent to the customer to accept
 * or decline) — customer info instead of supplier info, quotation
 * number/valid-until instead of PO number/due date. Unlike `PurchaseOrder`
 * (buy-side, its own CGST/SGST/IGST split), a `Quotation` mirrors a sales
 * `Order`'s totals shape — `subtotal`/`taxTotal`/`total` only, no interstate
 * breakdown.
 *
 * Thin wrapper around the data-driven `buildDocumentPdf` orchestrator
 * (`src/modules/documentLayouts/pdf/`) — see `invoicePdf.ts`'s own doc
 * comment for the shared shape every `build<X>Pdf` now follows. Whether
 * Header Notes/Footer Notes/Signature actually render is entirely the
 * resolved layout's own call now (`config.header_notes`/`footer_notes`/
 * `signature`, authored in the layout builder) — this wrapper no longer
 * hardcodes any of it into `RenderContext`.
 */
export interface QuotationPdfInput {
  quotation: Quotation;
  invoiceSettings: InvoiceSettings;
  /** Pre-fetched logo bytes — see `ThermalBillInput.logoBlob`'s doc comment for why the fetch happens in the caller (CORS). Omit or pass `null` to render with no logo. */
  logoBlob?: Blob | null;
  /**
   * Best-effort extra context beyond what's already snapshotted on the
   * quotation itself (`locationName`/`customerName`/`customerPhone`/…).
   * `business`/`location` come from `useBusinesses`/`useLocations`, both
   * `IsTenantAdmin`-gated server-side — a manager viewing this page can't
   * resolve either (same constraint `NewOrderPage`/`usePurchaseOrderBill`
   * already document), so the caller passes `null`/`undefined` for them in
   * that case and this template simply omits whatever it doesn't have
   * rather than blocking the document.
   */
  business?: BusinessEntity | null;
  location?: Location | null;
  /** Assigned to the quotation's location (Feature: Payment Details) — empty array (or omitted) renders no payment-details block. */
  paymentDetails?: PaymentDetail[];
  /**
   * The layout-switcher's on-the-fly choice (`QuotationBillPreviewModal`) —
   * when given, used directly as `config` and the `resolveEffective` network
   * call below is skipped entirely (the modal already has the full config,
   * from `useEffectiveLayout`'s own `alternatives`/`useLayoutTemplate`).
   * Never threaded into `ensurePdfUploaded`'s persistence path — a switcher
   * choice only affects the preview blob, never what gets uploaded once.
   */
  layoutOverride?: LayoutConfig;
}

const CONTENT_WIDTH_MM = 210 - 16 * 2;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting response',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

/**
 * Column order/format shared across every item table in the app (quotations,
 * purchase orders, invoices): `SI, Description, Qty (with unit), Tax (%),
 * Rate (Rs.), [Disc %], Amount (Rs.)`. `Disc %` is omitted entirely when
 * nothing on the document has a discount, same "shape follows the data"
 * precedent `invoicePdf.ts`/`purchaseOrderPdf.ts` also follow. Passed into
 * `RenderContext.buildItemColumns` rather than duplicated into
 * `tableRenderer.ts`, which stays doc-type-agnostic.
 */
function buildItemColumns(items: QuotationItem[]): ItemColumns<QuotationItem> {
  const hasDiscount = items.some((item) => Number(item.discountPercent) > 0);

  const fixed = hasDiscount
    ? { si: 10, qty: 22, tax: 16, rate: 24, discount: 16, amount: 28 }
    : { si: 10, qty: 22, tax: 16, rate: 26, discount: 0, amount: 30 };
  const fixedSum = Object.values(fixed).reduce((sum, w) => sum + w, 0);
  const nameWidth = CONTENT_WIDTH_MM - fixedSum;

  const headers = hasDiscount
    ? ['SI', 'Description', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Disc %', 'Amount (Rs.)']
    : ['SI', 'Description', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Amount (Rs.)'];
  const aligns: Align[] = hasDiscount
    ? ['center', 'left', 'right', 'right', 'right', 'right', 'right']
    : ['center', 'left', 'right', 'right', 'right', 'right'];
  const widths = hasDiscount
    ? [fixed.si, nameWidth, fixed.qty, fixed.tax, fixed.rate, fixed.discount, fixed.amount]
    : [fixed.si, nameWidth, fixed.qty, fixed.tax, fixed.rate, fixed.amount];

  return {
    headers,
    aligns,
    widths,
    nameColumnIndex: 1,
    cellsFor: (item, index) => {
      const cells = [
        String(index + 1),
        item.name,
        // `unit` is `null` for an ad-hoc/external line (no catalog Product
        // behind it) — just the bare quantity then, no unit suffix.
        item.unit
          ? `${formatQuantity(item.quantity, item.unit as Unit)} ${item.unit}`
          : formatQuantity(item.quantity),
        formatRate(item.gstRate),
        money(item.unitPrice, { bare: true }),
      ];
      if (hasDiscount) {
        cells.push(Number(item.discountPercent) > 0 ? formatRate(item.discountPercent) : '—');
      }
      cells.push(money(item.lineTotal, { bare: true }));
      return cells;
    },
  };
}

/** Adapts `Quotation`/`business`/`location`/`paymentDetails` into the doc-type-agnostic `RenderContext` `buildDocumentPdf` needs. */
function toQuotationRenderContext(
  input: QuotationPdfInput,
  logo: RenderContext<QuotationItem>['logo'],
): RenderContext<QuotationItem> {
  const { quotation, business, location } = input;
  const paymentDetails = input.paymentDetails ?? [];

  const extraLines = [`Status: ${STATUS_LABELS[quotation.status] ?? quotation.status}`];
  if (quotation.validUntil)
    extraLines.push(`Valid until: ${formatPlainDate(quotation.validUntil)}`);

  const hasQuotationDiscount = Number(quotation.discountPercent) > 0;

  return {
    docType: 'quotation',
    logo,
    business: {
      businessName: business?.name ?? quotation.locationName,
      // Only shown as its own line when a separate `business` record
      // exists — otherwise `businessName` already fell back to
      // `locationName` above, and repeating it verbatim would look like a
      // duplicate, same original condition.
      locationName: business?.name ? quotation.locationName : undefined,
      addressLines: addressDisplayLines(location),
      phone: location?.phone,
      gstin: business?.gstin ?? undefined,
    },
    party: {
      name: quotation.customerName,
      phone: quotation.customerPhone,
      email: quotation.customerEmail,
      gstin: quotation.customerGstin,
      state: quotation.customerState,
    },
    documentMeta: {
      number: quotation.quotationNumber ?? '—',
      date: formatDate(quotation.createdAt),
      extraLines,
    },
    items: quotation.items,
    buildItemColumns,
    totals: {
      // `tableRenderer.ts`'s totals block hardcodes this first line as
      // "Taxable value" by default — a quotation (like a purchase order)
      // calls it "Subtotal" instead, hence the explicit `taxableValueLabel`
      // override (see `RenderTotals.taxableValueLabel`'s own doc comment).
      taxableValueLabel: 'Subtotal',
      taxableValue: quotation.subtotal,
      isInterstate: false,
      extraRows: [
        ...(hasQuotationDiscount
          ? [
              {
                label: `Discount (${formatRate(quotation.discountPercent)}%)`,
                value: `-${money(quotation.discountAmount)}`,
              },
            ]
          : []),
        { label: 'Tax', value: money(quotation.taxTotal) },
      ],
      total: quotation.total,
    },
    paymentDetails,
  };
}

/**
 * Renders a quotation as a formal A4 "QUOTATION" document — the offer
 * you'd send to the customer, not a thermal receipt. Async for two reasons:
 * the logo (if any) has to be decoded, and the business's effective layout
 * has to be resolved from the backend before anything gets drawn.
 */
export async function buildQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  // A broken layout-fetch (network error, or no auth context in some edge
  // case) should never block someone from generating/previewing a document
  // — fall back to the same hardcoded arrangement this renderer replaced.
  // `layoutOverride` (the preview modal's switcher choice) skips this
  // network call entirely — the caller already resolved the full config.
  const config =
    input.layoutOverride ??
    (await documentLayoutsService
      .resolveEffective({ businessId: input.quotation.businessId, documentType: 'quotation' })
      .then((effective) => effective.config as LayoutConfig)
      .catch(() => SYSTEM_DEFAULT_LAYOUT_CONFIG));

  const context = toQuotationRenderContext(input, logo);
  return buildDocumentPdf({ docType: 'quotation', config, context });
}
