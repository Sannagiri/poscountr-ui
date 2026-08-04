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
  formatRate,
  money,
} from '@/modules/documentLayouts/pdf/pdfPrimitives';
import { amountInWords, type ItemColumns } from '@/modules/documentLayouts/pdf/tableRenderer';
import type { Unit } from '@/modules/inventory';
import { formatQuantity } from '@/modules/inventory';
import type { PaymentDetail } from '@/modules/paymentDetails';
// Concrete-file import, not the `@/modules/reports` barrel — see the note in
// `billingService.ts` (avoids a billing <-> reports barrel cycle).
import type { Invoice } from '@/modules/reports/types/reports.types';
import type { InvoiceSettings } from '@/modules/settings';

import type { Order, OrderItem } from '../types/billing.types';

/**
 * The A4 "TAX INVOICE" template for a completed order, rendered when
 * `invoiceSettings.paperWidth === 'a4'` — the formal document non-food
 * businesses (retail/pharmacy/grocery/other) get instead of
 * `thermalBillPdf.ts`'s 58mm/80mm receipt.
 *
 * Thin wrapper around the data-driven `buildDocumentPdf` orchestrator
 * (`src/modules/documentLayouts/pdf/`): resolves this business's effective
 * layout, adapts `Invoice`/`Order`/`InvoiceSettings` into a `RenderContext`,
 * and hands both to `buildDocumentPdf`. Everything doc-type-specific that
 * couldn't move into the shared renderer — `buildItemColumns` (the HSN
 * column is invoice-only) and this mapping function itself — stays local.
 * The exported signature is unchanged, so `useOrderBill.ts` needs no changes.
 */
export interface InvoicePdfInput {
  invoice: Invoice;
  order: Order;
  invoiceSettings: InvoiceSettings;
  /** Pre-fetched logo bytes — see `ThermalBillInput.logoBlob`'s doc comment for why the fetch happens in the caller (CORS). Omit or pass `null` to render with no logo. */
  logoBlob?: Blob | null;
  /** Assigned to the order's location (Feature: Payment Details) — empty array renders no payment-details block. */
  paymentDetails: PaymentDetail[];
  /**
   * The layout-switcher's on-the-fly choice (`OrderBillPreviewModal`) — when
   * given, used directly as `config` and the `resolveEffective` network call
   * below is skipped entirely (the modal already has the full config, from
   * `useEffectiveLayout`'s own `alternatives`/`useLayoutTemplate`). Never
   * threaded into `ensureBillUploaded`'s persistence path — a switcher
   * choice only affects the preview blob, never what gets uploaded once.
   */
  layoutOverride?: LayoutConfig;
}

const CONTENT_WIDTH_MM = 210 - 16 * 2;

/**
 * Same shared column convention `quotationPdf.ts`/`purchaseOrderPdf.ts`
 * establish (`SI, Description, Qty, Tax (%), Rate (Rs.), [Disc %], Amount
 * (Rs.)`), plus this document's own extra `HSN` column right after
 * Description — GST-mandatory on a formal tax invoice, absent from a
 * quotation/purchase order. `Disc %` is still omitted entirely when nothing
 * on the order has a discount, same "shape follows the data" rule. Passed
 * into `RenderContext.buildItemColumns` rather than duplicated into
 * `tableRenderer.ts`, which stays doc-type-agnostic.
 */
function buildItemColumns(items: OrderItem[]): ItemColumns<OrderItem> {
  const hasDiscount = items.some((item) => Number(item.discountPercent) > 0);

  const fixed = hasDiscount
    ? { si: 9, hsn: 18, qty: 20, tax: 14, rate: 22, discount: 14, amount: 26 }
    : { si: 9, hsn: 20, qty: 22, tax: 15, rate: 24, discount: 0, amount: 28 };
  const fixedSum = Object.values(fixed).reduce((sum, w) => sum + w, 0);
  const nameWidth = CONTENT_WIDTH_MM - fixedSum;

  const headers = hasDiscount
    ? ['SI', 'Description', 'HSN', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Disc %', 'Amount (Rs.)']
    : ['SI', 'Description', 'HSN', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Amount (Rs.)'];
  const aligns: Align[] = hasDiscount
    ? ['center', 'left', 'center', 'right', 'right', 'right', 'right', 'right']
    : ['center', 'left', 'center', 'right', 'right', 'right', 'right'];
  const widths = hasDiscount
    ? [
        fixed.si,
        nameWidth,
        fixed.hsn,
        fixed.qty,
        fixed.tax,
        fixed.rate,
        fixed.discount,
        fixed.amount,
      ]
    : [fixed.si, nameWidth, fixed.hsn, fixed.qty, fixed.tax, fixed.rate, fixed.amount];

  return {
    headers,
    aligns,
    widths,
    nameColumnIndex: 1,
    cellsFor: (item, index) => {
      const cells = [
        String(index + 1),
        item.name,
        item.hsnCode || '—',
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

/** Adapts `Invoice`/`Order`/`InvoiceSettings`/`paymentDetails` into the doc-type-agnostic `RenderContext` `buildDocumentPdf` needs. */
function toInvoiceRenderContext(
  input: InvoicePdfInput,
  logo: RenderContext<OrderItem>['logo'],
): RenderContext<OrderItem> {
  const { invoice, order, invoiceSettings, paymentDetails } = input;

  const extraLines: string[] = [];
  if (order.orderNumber) extraLines.push(`Order: ${order.orderNumber}`);
  // GST-mandatory — stated explicitly rather than only implied by the
  // CGST/SGST-vs-IGST split further down.
  if (invoice.customerState) extraLines.push(`Place of Supply: ${invoice.customerState}`);

  return {
    docType: 'invoice',
    logo,
    business: {
      businessName: invoice.businessName,
      locationName: invoice.locationName,
      addressLines: addressDisplayLines({
        addressLine1: invoice.locationAddressLine1,
        addressLine2: invoice.locationAddressLine2,
        city: invoice.locationCity,
        pincode: invoice.locationPincode,
      }),
      gstin: invoice.businessGstin,
      state: invoice.businessState,
    },
    party: {
      name: invoice.customerName || 'Walk-in',
      phone: invoice.customerPhone,
      email: invoice.customerEmail,
      gstin: invoiceSettings.showCustomerGstin ? invoice.customerGstin : undefined,
      state: invoice.customerState,
    },
    documentMeta: {
      number: invoice.invoiceNumber,
      date: formatDate(invoice.issuedAt),
      extraLines,
    },
    items: order.items,
    buildItemColumns,
    totals: {
      taxableValue: invoice.taxableValue,
      isInterstate: invoice.isInterstate,
      cgst: invoice.cgstAmount,
      sgst: invoice.sgstAmount,
      igst: invoice.igstAmount,
      roundOff: invoice.roundOff,
      total: invoice.total,
      amountInWordsText: amountInWords(invoice.total),
    },
    paymentDetails,
  };
}

/**
 * Renders a completed order's invoice as a formal A4 "TAX INVOICE" document
 * — the GST-compliant document a non-food business hands to (or emails) its
 * customer, in place of `thermalBillPdf.ts`'s receipt. Async for two
 * reasons: the logo (if any) has to be decoded, and the business's
 * effective layout has to be resolved from the backend before anything
 * gets drawn.
 */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Blob> {
  // `decodeLogo` always rasterizes at a fixed high-quality box regardless of
  // `config.header.size` — the resolved layout's Size tier only matters at
  // *draw* time (`fitLogoToTier`, called from `blockRenderers/logoBlock.ts`'s
  // `drawLogoZone`/`logoZoneHeightMm`), not decode time — so decoding the
  // logo doesn't need to wait on the layout resolving first.
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  // Three rungs, in priority order: `layoutOverride` (the preview modal's
  // switcher choice, when the caller already resolved a full config — never
  // persisted, affects this one render only), then this invoice's own
  // *permanent* pin (`invoice.layoutTemplateId`, set via the same switcher's
  // "save" action — see `OrderBillPreviewModal.tsx`), then the business's
  // current default. A broken layout-fetch (network error, no auth context,
  // or a pinned template that's since been deleted/deactivated) never blocks
  // generating/previewing a document — falls through to the next rung, and
  // ultimately the same hardcoded arrangement this renderer replaced.
  const config =
    input.layoutOverride ??
    (await resolvePinnedLayoutConfig(input.invoice.layoutTemplateId)) ??
    (await documentLayoutsService
      .resolveEffective({ businessId: input.invoice.businessId, documentType: 'invoice' })
      .then((effective) => effective.config as LayoutConfig)
      .catch(() => SYSTEM_DEFAULT_LAYOUT_CONFIG));

  const context = toInvoiceRenderContext(input, logo);
  return buildDocumentPdf({ docType: 'invoice', config, context });
}

/** This invoice's own permanently pinned layout, if it still exists and is active — `null` (never throws) when unpinned, deleted, or deactivated, so the caller falls through to the business's current default instead of failing the whole render. */
async function resolvePinnedLayoutConfig(
  layoutTemplateId: string | null,
): Promise<LayoutConfig | null> {
  if (!layoutTemplateId) return null;
  try {
    const template = await documentLayoutsService.get(layoutTemplateId);
    return template.isActive ? (template.config as LayoutConfig) : null;
  } catch {
    return null;
  }
}
