import type { PaymentDetail } from '@/modules/paymentDetails';

import type { A4DocType, RenderContext } from '../pdf/blockRenderers/types';
import type { Align } from '../pdf/pdfPrimitives';
import {
  addressDisplayLines,
  amountInWords,
  CONTENT_WIDTH_MM,
  formatDate,
  formatRate,
  money,
} from '../pdf/pdfPrimitives';
import type { ItemColumns } from '../pdf/tableRenderer';

/**
 * Fixture data for `LayoutPreviewPane`'s live preview — one `RenderContext`
 * per `DocType`, hand-built directly in the shape `buildDocumentPdf` needs
 * rather than fetched from a real `Invoice`/`Quotation`/`PurchaseOrder`,
 * since the editor has to render a preview for a layout that may not even
 * be saved yet.
 *
 * v2 schema dropped `RenderContext.headerNote`/`footerNote`/`signatureLabel`
 * — that free text is now authored directly in `LayoutConfig` (`header_notes`/
 * `footer_notes`/`signature.label`), so it needs no fixture here at all; the
 * live preview exercises it automatically as soon as the config being
 * edited enables those zones, driven by whatever the user types into the
 * canvas's Header Notes/Footer Notes textareas or the Meta Data zone's
 * Signature label input — no fixture wiring required.
 *
 * `RenderContext.paymentDetails` stays populated for *all three* doc types
 * here, unlike the real `build<X>Pdf` thin wrappers
 * (`purchaseOrderPdf.ts` passes `[]` today, since a PO has no assigned
 * payment details in production) — the block palette lets *any* slot go on
 * *any* doc type, though, so the builder's preview has to be able to
 * demonstrate a Payment Details card enabled on a purchase-order layout too,
 * a deliberate fixture-vs-production divergence, not a bug.
 */

interface SampleItem {
  name: string;
  hsnCode: string;
  batchNumber: string;
  quantityLabel: string;
  gstRate: string;
  unitPrice: string;
  lineTotal: string;
}

/**
 * 40 rows (not 3) — comfortably forces the item table to paginate onto a
 * second page at the default font size and A4 page height (~30 rows fit on
 * a single page above the totals block), so the live preview can actually
 * demonstrate the v3 Logo/Footer zones' "repeats on every page" behavior
 * (`buildDocumentPdf.ts`'s second pass) rather than only ever rendering a
 * single-page document.
 */
const SAMPLE_ITEMS: SampleItem[] = Array.from({ length: 40 }, (_, index) => {
  const base = [
    {
      name: 'Wireless Mouse',
      hsnCode: '8471',
      batchNumber: 'B-2201',
      quantityLabel: '2 pcs',
      gstRate: '18',
      unitPrice: '650.00',
      lineTotal: '1300.00',
    },
    {
      name: 'USB-C Cable 1m',
      hsnCode: '8544',
      batchNumber: 'B-2202',
      quantityLabel: '5 pcs',
      gstRate: '18',
      unitPrice: '200.00',
      lineTotal: '1000.00',
    },
    {
      name: 'Laptop Stand (Aluminium)',
      hsnCode: '8473',
      batchNumber: 'B-2203',
      quantityLabel: '1 pcs',
      gstRate: '18',
      unitPrice: '1700.00',
      lineTotal: '1700.00',
    },
  ][index % 3];
  return { ...base, name: `${base.name} #${index + 1}` };
});

/**
 * A tiny (1x1) but valid PNG, stretched to `widthMm x heightMm` by jsPDF's
 * `addImage` regardless of its own pixel size — a placeholder good enough to
 * make the Logo zone's Position/Size controls visibly demonstrable in the
 * live preview (position/size math is exercised the same way a real decoded
 * logo would be; only the pixel content differs). `widthMm`/`heightMm`
 * stand in for what `decodeLogo` would have produced for a landscape logo at
 * the `large` tier — `fitLogoToTier` (`pdfPrimitives.ts`) re-fits this same
 * aspect ratio into whichever tier the Size selector picks, at draw time.
 */
const SAMPLE_LOGO: RenderContext<SampleItem>['logo'] = {
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  widthMm: 38,
  heightMm: 16,
};

/** `SI, Description, HSN, Qty, Tax (%), Rate (Rs.), Amount (Rs.)` — mirrors `invoicePdf.ts`'s own column set. */
function invoiceItemColumns(_items: SampleItem[]): ItemColumns<SampleItem> {
  const fixed = { si: 9, hsn: 20, qty: 22, tax: 15, rate: 24, amount: 28 };
  const nameWidth = CONTENT_WIDTH_MM - Object.values(fixed).reduce((sum, w) => sum + w, 0);
  return {
    headers: ['SI', 'Description', 'HSN', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Amount (Rs.)'],
    aligns: ['center', 'left', 'center', 'right', 'right', 'right', 'right'] as Align[],
    widths: [fixed.si, nameWidth, fixed.hsn, fixed.qty, fixed.tax, fixed.rate, fixed.amount],
    nameColumnIndex: 1,
    cellsFor: (item, index) => [
      String(index + 1),
      item.name,
      item.hsnCode,
      item.quantityLabel,
      formatRate(item.gstRate),
      money(item.unitPrice, { bare: true }),
      money(item.lineTotal, { bare: true }),
    ],
  };
}

/** `SI, Description, Qty, Tax (%), Rate (Rs.), Amount (Rs.)` — mirrors `quotationPdf.ts`'s own column set (no HSN/batch). */
function quotationItemColumns(_items: SampleItem[]): ItemColumns<SampleItem> {
  const fixed = { si: 10, qty: 22, tax: 16, rate: 26, amount: 30 };
  const nameWidth = CONTENT_WIDTH_MM - Object.values(fixed).reduce((sum, w) => sum + w, 0);
  return {
    headers: ['SI', 'Description', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Amount (Rs.)'],
    aligns: ['center', 'left', 'right', 'right', 'right', 'right'] as Align[],
    widths: [fixed.si, nameWidth, fixed.qty, fixed.tax, fixed.rate, fixed.amount],
    nameColumnIndex: 1,
    cellsFor: (item, index) => [
      String(index + 1),
      item.name,
      item.quantityLabel,
      formatRate(item.gstRate),
      money(item.unitPrice, { bare: true }),
      money(item.lineTotal, { bare: true }),
    ],
  };
}

/** `SI, Description, Batch, Qty, Tax (%), Rate (Rs.), Amount (Rs.)` — mirrors `purchaseOrderPdf.ts`'s own column set. */
function purchaseOrderItemColumns(_items: SampleItem[]): ItemColumns<SampleItem> {
  const fixed = { si: 10, batch: 20, qty: 22, tax: 16, rate: 26, amount: 28 };
  const nameWidth = CONTENT_WIDTH_MM - Object.values(fixed).reduce((sum, w) => sum + w, 0);
  return {
    headers: ['SI', 'Description', 'Batch', 'Qty', 'Tax (%)', 'Rate (Rs.)', 'Amount (Rs.)'],
    aligns: ['center', 'left', 'left', 'right', 'right', 'right', 'right'] as Align[],
    widths: [fixed.si, nameWidth, fixed.batch, fixed.qty, fixed.tax, fixed.rate, fixed.amount],
    nameColumnIndex: 1,
    cellsFor: (item, index) => [
      String(index + 1),
      item.name,
      item.batchNumber,
      item.quantityLabel,
      formatRate(item.gstRate),
      money(item.unitPrice, { bare: true }),
      money(item.lineTotal, { bare: true }),
    ],
  };
}

/** The seller — same business/location/logo regardless of doc type, matching every real `build<X>Pdf` wrapper's own "one letterhead" assumption. */
const SAMPLE_BUSINESS: RenderContext<SampleItem>['business'] = {
  businessName: 'Aarvin Retail Store',
  locationName: 'MG Road Outlet',
  addressLines: addressDisplayLines({
    addressLine1: '221B, MG Road',
    city: 'Bengaluru',
    pincode: '560001',
  }),
  phone: '+91 98765 43210',
  gstin: '29ABCDE1234F1Z5',
  state: 'KA',
};

const SAMPLE_CUSTOMER: RenderContext<SampleItem>['party'] = {
  name: 'Rohan Sharma',
  phone: '+91 90000 11122',
  email: 'rohan.sharma@example.com',
  state: 'KA',
};

const SAMPLE_SUPPLIER: RenderContext<SampleItem>['party'] = {
  name: 'Global Components Pvt Ltd',
  phone: '+91 80000 22233',
  gstin: '27AAACG1234F1Z8',
  state: 'MH',
  addressLines: addressDisplayLines({
    addressLine1: 'Plot 45, Andheri Industrial Estate',
    city: 'Mumbai',
    pincode: '400053',
  }),
};

const SAMPLE_PAYMENT_DETAILS: PaymentDetail[] = [
  {
    id: 'sample-bank-1',
    businessId: 'sample-business-1',
    businessName: 'Global Components Pvt Ltd',
    detailType: 'bank',
    label: 'Primary Current Account',
    isActive: true,
    accountHolderName: 'Aarvin Retail Store',
    bankName: 'HDFC Bank',
    accountNumber: '50100234567890',
    ifscCode: 'HDFC0001234',
    branch: 'MG Road Branch',
    upiId: '',
    upiName: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-upi-1',
    businessId: 'sample-business-1',
    businessName: 'Global Components Pvt Ltd',
    detailType: 'upi',
    label: 'Business UPI',
    isActive: true,
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    upiId: 'aarvinretail@okhdfcbank',
    upiName: 'Aarvin Retail Store',
    createdAt: new Date().toISOString(),
  },
];

const TODAY = formatDate(new Date().toISOString());

function buildInvoiceContext(): RenderContext<SampleItem> {
  return {
    docType: 'invoice',
    logo: SAMPLE_LOGO,
    business: SAMPLE_BUSINESS,
    party: { ...SAMPLE_CUSTOMER, gstin: '29PQRSX5678G1Z2' },
    documentMeta: {
      number: 'INV-2026-000123',
      date: TODAY,
      extraLines: ['Order: ORD-000456', 'Place of Supply: KA'],
    },
    items: SAMPLE_ITEMS,
    buildItemColumns: invoiceItemColumns,
    totals: {
      taxableValue: '4000.00',
      isInterstate: false,
      cgst: '360.00',
      sgst: '360.00',
      total: '4720.00',
      amountInWordsText: amountInWords('4720.00'),
    },
    paymentDetails: SAMPLE_PAYMENT_DETAILS,
  };
}

function buildQuotationContext(): RenderContext<SampleItem> {
  return {
    docType: 'quotation',
    logo: SAMPLE_LOGO,
    business: SAMPLE_BUSINESS,
    party: SAMPLE_CUSTOMER,
    documentMeta: {
      number: 'QUO-2026-000045',
      date: TODAY,
      extraLines: ['Status: Awaiting response', 'Valid until: 15 Aug 2026'],
    },
    items: SAMPLE_ITEMS,
    buildItemColumns: quotationItemColumns,
    totals: {
      taxableValueLabel: 'Subtotal',
      taxableValue: '4000.00',
      isInterstate: false,
      extraRows: [{ label: 'Tax', value: money('720.00') }],
      total: '4720.00',
    },
    paymentDetails: SAMPLE_PAYMENT_DETAILS,
  };
}

function buildPurchaseOrderContext(): RenderContext<SampleItem> {
  return {
    docType: 'purchase_order',
    logo: SAMPLE_LOGO,
    business: SAMPLE_BUSINESS,
    party: SAMPLE_SUPPLIER,
    documentMeta: {
      number: 'PO-2026-000078',
      date: TODAY,
      extraLines: ['Payment: On credit', 'Due date: 20 Aug 2026'],
    },
    items: SAMPLE_ITEMS,
    buildItemColumns: purchaseOrderItemColumns,
    totals: {
      taxableValueLabel: 'Subtotal',
      taxableValue: '4000.00',
      isInterstate: true,
      igst: '720.00',
      total: '4720.00',
      trailingRows: [
        { label: 'Amount paid', value: money('2000.00') },
        { label: 'Balance due', value: money('2720.00') },
      ],
    },
    paymentDetails: SAMPLE_PAYMENT_DETAILS,
  };
}

/** One fixture `RenderContext` per `DocType`, built once at module load — `LayoutPreviewPane` looks these up by the tab currently active. */
export const SAMPLE_RENDER_CONTEXTS: Record<A4DocType, RenderContext<SampleItem>> = {
  invoice: buildInvoiceContext(),
  quotation: buildQuotationContext(),
  purchase_order: buildPurchaseOrderContext(),
};
