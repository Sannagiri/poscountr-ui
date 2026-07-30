import { jsPDF } from 'jspdf';

import type { BusinessEntity, Location } from '@/modules/businesses';
import { INDIAN_STATE_OPTIONS } from '@/modules/businesses';
import { formatQuantity } from '@/modules/inventory';
import type { InvoiceSettings } from '@/modules/settings';

import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '../types/purchasing.types';

/**
 * The first (and so far only) A4 jsPDF template in this codebase — everything
 * else (`thermalBillPdf.ts`) renders a 58mm/80mm receipt sized to its own
 * content height. A real A4 document has a fixed page size instead, so long
 * item tables have to actually paginate (`doc.addPage()`), which a thermal
 * receipt never needed.
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
}

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 16;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const TITLE_FONT_SIZE_PT = 20;
const HEADING_FONT_SIZE_PT = 11;
const BODY_FONT_SIZE_PT = 9.5;
const SMALL_FONT_SIZE_PT = 8.5;
const TABLE_FONT_SIZE_PT = 8.5;

const LINE_MM = 4.6;
const TABLE_ROW_MM = 6;

/** jsPDF's built-in Helvetica has no ₹ glyph — spelled out instead, same convention `thermalBillPdf.ts` uses. */
const CURRENCY_PREFIX = 'Rs. ';

// A letterhead-style logo can afford to be a bit bigger than a receipt's —
// still capped on both dimensions so a very wide or very tall source image
// never blows past a reasonable corner-mark size, aspect ratio preserved.
const LOGO_MAX_WIDTH_MM = 38;
const LOGO_MAX_HEIGHT_MM = 22;
// A print document is judged more closely than a thermal receipt — 300dpi
// (a common office-printer resolution) keeps the embedded logo sharp at
// this box size without ballooning the PDF's own size.
const LOGO_TARGET_DPI = 300;
const MM_PER_INCH = 25.4;

const STATE_LABELS: Record<string, string> = Object.fromEntries(
  INDIAN_STATE_OPTIONS.map((option) => [option.value, option.label]),
);

function stateLabel(code: string): string {
  return STATE_LABELS[code] ?? code;
}

/** `Invoice`-style absolute timestamp -> `"22 Jun 2021"`. */
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** A plain `YYYY-MM-DD` field (`dueDate`/`supplierInvoiceDate`) -> `"22 Jun 2021"`, without a timezone-driven off-by-one day. */
function formatPlainDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A structured address as up to three separate display lines — `"Address:
 * <line1>"`, `<line2>` (if present), and `"<city> - <pincode>"` (if either
 * is present) — rather than one long comma-joined line. Used for both the
 * business/location block and the Supplier block. The `Address:` label
 * mirrors this template's existing `Phone:`/`GSTIN:`/`State:` convention;
 * the extra-address and city/pincode lines stay unlabeled, same as the
 * reference layout this was built from.
 */
function addressDisplayLines(
  entity: { addressLine1?: string; addressLine2?: string; city?: string; pincode?: string } | null | undefined,
): string[] {
  if (!entity) return [];
  const lines: string[] = [];
  if (entity.addressLine1) lines.push(`Address: ${entity.addressLine1}`);
  if (entity.addressLine2) lines.push(entity.addressLine2);
  const cityZip = [entity.city, entity.pincode].filter(Boolean).join(' - ');
  if (cityZip) lines.push(cityZip);
  return lines;
}

/** `"5.00"` -> `"5"`, `"12.50"` -> `"12.5"` — same trim `thermalBillPdf.ts`'s own `formatRate` uses. */
function formatRate(rate: string): string {
  const num = Number(rate);
  if (!Number.isFinite(num)) return rate;
  return num.toFixed(2).replace(/\.?0+$/, '') || '0';
}

function money(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value);
  return `${CURRENCY_PREFIX}${Number.isFinite(num) ? num.toFixed(2) : value}`;
}

interface LoadedLogo {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

/** Same decode/downscale pipeline as `thermalBillPdf.ts`'s `decodeLogo` — a same-origin `blob:` URL drawn through a `<canvas>` at print DPI, just a different target box for a top-right corner mark instead of a centered receipt header. */
async function decodeLogo(blob: Blob): Promise<LoadedLogo | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('logo image failed to decode'));
      image.src = objectUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;

    let widthMm = LOGO_MAX_WIDTH_MM;
    let heightMm = widthMm * (img.naturalHeight / img.naturalWidth);
    if (heightMm > LOGO_MAX_HEIGHT_MM) {
      heightMm = LOGO_MAX_HEIGHT_MM;
      widthMm = heightMm * (img.naturalWidth / img.naturalHeight);
    }

    const widthPx = Math.max(1, Math.round((widthMm / MM_PER_INCH) * LOGO_TARGET_DPI));
    const heightPx = Math.max(1, Math.round((heightMm / MM_PER_INCH) * LOGO_TARGET_DPI));
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    return { dataUrl: canvas.toDataURL('image/png'), widthMm, heightMm };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type Align = 'left' | 'center' | 'right';

interface ItemColumns {
  headers: string[];
  aligns: Align[];
  widths: number[];
  nameColumnIndex: number;
  cellsFor: (item: PurchaseOrderItem, index: number) => string[];
}

/** The Batch column only appears when at least one line actually carries a batch number — same "shape follows the data" convention `thermalBillPdf.ts`'s GST%-column toggle uses. */
function buildItemColumns(items: PurchaseOrderItem[]): ItemColumns {
  const hasBatches = items.some((item) => item.batchNumber);

  // Both branches share the same key set (`batch: 0` when unused) so `fixed`
  // stays one consistent object type instead of a union TS can't narrow
  // inside the `if (hasBatches)` branch below purely from the `hasBatches`
  // check having already happened above.
  const fixed = hasBatches
    ? { si: 10, batch: 22, qty: 16, rate: 24, discount: 16, gst: 14, amount: 28 }
    : { si: 10, batch: 0, qty: 18, rate: 26, discount: 18, gst: 16, amount: 30 };
  const fixedSum = Object.values(fixed).reduce((sum, w) => sum + w, 0);
  const nameWidth = CONTENT_WIDTH_MM - fixedSum;

  if (hasBatches) {
    return {
      headers: ['SI', 'Description', 'Batch', 'Qty', 'Rate', 'Disc %', 'GST %', 'Amount'],
      aligns: ['center', 'left', 'left', 'right', 'right', 'right', 'right', 'right'],
      widths: [fixed.si, nameWidth, fixed.batch, fixed.qty, fixed.rate, fixed.discount, fixed.gst, fixed.amount],
      nameColumnIndex: 1,
      cellsFor: (item, index) => [
        String(index + 1),
        item.name,
        item.batchNumber || '—',
        formatQuantity(item.quantity),
        money(item.purchasePrice),
        Number(item.discountPercent) > 0 ? `${formatRate(item.discountPercent)}%` : '—',
        `${formatRate(item.gstRate)}%`,
        money(item.lineTotal),
      ],
    };
  }

  return {
    headers: ['SI', 'Description', 'Qty', 'Rate', 'Disc %', 'GST %', 'Amount'],
    aligns: ['center', 'left', 'right', 'right', 'right', 'right', 'right'],
    widths: [fixed.si, nameWidth, fixed.qty, fixed.rate, fixed.discount, fixed.gst, fixed.amount],
    nameColumnIndex: 1,
    cellsFor: (item, index) => [
      String(index + 1),
      item.name,
      formatQuantity(item.quantity),
      money(item.purchasePrice),
      Number(item.discountPercent) > 0 ? `${formatRate(item.discountPercent)}%` : '—',
      `${formatRate(item.gstRate)}%`,
      money(item.lineTotal),
    ],
  };
}

function drawRow(
  doc: jsPDF,
  y: number,
  cells: string[],
  columns: Pick<ItemColumns, 'widths' | 'aligns'>,
  bold: boolean,
) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  let x = MARGIN_MM;
  cells.forEach((cell, index) => {
    const width = columns.widths[index];
    const align = columns.aligns[index];
    const textX = align === 'right' ? x + width : align === 'center' ? x + width / 2 : x;
    doc.text(cell, textX, y, { align });
    x += width;
  });
  doc.setFont('helvetica', 'normal');
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid in full',
  partial: 'Partially paid',
  credit: 'On credit',
};

/**
 * Renders a purchase order as a formal A4 "PURCHASE ORDER" document — the
 * kind you'd send to the supplier, not a thermal receipt. Async for the same
 * reason `buildThermalBillPdf` is: the logo (if any) has to be fetched and
 * decoded before anything gets drawn.
 */
export async function buildPurchaseOrderPdf(input: PurchaseOrderPdfInput): Promise<Blob> {
  const { purchaseOrder, business, location, supplier } = input;
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rightEdge = PAGE_WIDTH_MM - MARGIN_MM;

  // --- Header: logo (top-right), title (centered, below the logo band so
  // it never overlaps it regardless of how wide the title text renders),
  // then the business letterhead (full width, left-aligned — nothing
  // competes with it on the right up here anymore). ---
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', rightEdge - logo.widthMm, MARGIN_MM, logo.widthMm, logo.heightMm);
  }

  let y = MARGIN_MM + (logo ? logo.heightMm + 6 : 0) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_FONT_SIZE_PT);
  doc.text('PURCHASE ORDER', PAGE_WIDTH_MM / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(HEADING_FONT_SIZE_PT);
  doc.text(business?.name ?? purchaseOrder.locationName, MARGIN_MM, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SMALL_FONT_SIZE_PT);
  if (business?.name) {
    doc.text(purchaseOrder.locationName, MARGIN_MM, y);
    y += LINE_MM;
  }
  for (const addressLine of addressDisplayLines(location)) {
    for (const line of doc.splitTextToSize(addressLine, CONTENT_WIDTH_MM) as string[]) {
      doc.text(line, MARGIN_MM, y);
      y += LINE_MM;
    }
  }
  if (location?.phone) {
    doc.text(`Phone: ${location.phone}`, MARGIN_MM, y);
    y += LINE_MM;
  }
  if (business?.gstin) {
    doc.text(`GSTIN: ${business.gstin}`, MARGIN_MM, y);
    y += LINE_MM;
  }
  if (purchaseOrder.businessState) {
    doc.text(`State: ${stateLabel(purchaseOrder.businessState)}`, MARGIN_MM, y);
    y += LINE_MM;
  }

  y += 4;
  doc.setDrawColor(160);
  doc.line(MARGIN_MM, y, rightEdge, y);
  y += 8;

  // --- Supplier (left) / Purchase order info (right) — a two-column band,
  // the same "who it's for" / "document details" pairing an invoice uses,
  // so the right side isn't left looking sparse next to the Supplier block. ---
  const columnStartY = y;
  let leftY = y;
  let rightY = y;
  const rightColumnX = MARGIN_MM + CONTENT_WIDTH_MM * 0.58;
  const rightColumnWidthMm = CONTENT_WIDTH_MM * 0.42;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(HEADING_FONT_SIZE_PT);
  doc.text('Supplier', MARGIN_MM, leftY);
  leftY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE_PT);
  doc.text(purchaseOrder.supplierName, MARGIN_MM, leftY);
  leftY += LINE_MM;
  if (purchaseOrder.supplierPhone) {
    doc.text(`Phone: ${purchaseOrder.supplierPhone}`, MARGIN_MM, leftY);
    leftY += LINE_MM;
  }
  if (purchaseOrder.supplierGstin) {
    doc.text(`GSTIN: ${purchaseOrder.supplierGstin}`, MARGIN_MM, leftY);
    leftY += LINE_MM;
  }
  if (purchaseOrder.supplierState) {
    doc.text(`State: ${stateLabel(purchaseOrder.supplierState)}`, MARGIN_MM, leftY);
    leftY += LINE_MM;
  }
  for (const addressLine of addressDisplayLines(supplier)) {
    for (const line of doc.splitTextToSize(addressLine, CONTENT_WIDTH_MM * 0.55) as string[]) {
      doc.text(line, MARGIN_MM, leftY);
      leftY += LINE_MM;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(HEADING_FONT_SIZE_PT);
  doc.text('Purchase order info', rightColumnX, rightY);
  rightY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE_PT);
  const poInfoLines = [`PO No: ${purchaseOrder.purchaseNumber ?? '—'}`, `Date: ${formatDate(purchaseOrder.createdAt)}`];
  if (purchaseOrder.paymentStatus) {
    const label = PAYMENT_STATUS_LABELS[purchaseOrder.paymentStatus] ?? purchaseOrder.paymentStatus;
    poInfoLines.push(`Payment: ${label}`);
  }
  if (purchaseOrder.dueDate) {
    poInfoLines.push(`Due date: ${formatPlainDate(purchaseOrder.dueDate)}`);
  }
  for (const infoLine of poInfoLines) {
    for (const line of doc.splitTextToSize(infoLine, rightColumnWidthMm) as string[]) {
      doc.text(line, rightColumnX, rightY);
      rightY += LINE_MM;
    }
  }

  y = Math.max(leftY, rightY, columnStartY) + 6;

  // --- Item table, paginating with doc.addPage() if it overflows the page. ---
  const columns = buildItemColumns(purchaseOrder.items);

  function drawTableHeader(atY: number): number {
    drawRow(doc, atY, columns.headers, columns, true);
    const ruleY = atY + 2;
    doc.setDrawColor(160);
    doc.line(MARGIN_MM, ruleY, rightEdge, ruleY);
    return atY + TABLE_ROW_MM;
  }

  function newPage(): number {
    doc.addPage();
    return drawTableHeader(MARGIN_MM + 4);
  }

  doc.setFontSize(TABLE_FONT_SIZE_PT);
  if (y + TABLE_ROW_MM * 2 > PAGE_HEIGHT_MM - MARGIN_MM) {
    y = newPage();
  } else {
    y = drawTableHeader(y);
  }

  purchaseOrder.items.forEach((item, index) => {
    const cells = columns.cellsFor(item, index);
    const nameLines = doc.splitTextToSize(
      cells[columns.nameColumnIndex],
      columns.widths[columns.nameColumnIndex],
    ) as string[];
    const rowHeight = Math.max(1, nameLines.length) * TABLE_ROW_MM;

    if (y + rowHeight > PAGE_HEIGHT_MM - MARGIN_MM - 4) {
      y = newPage();
      doc.setFontSize(TABLE_FONT_SIZE_PT);
    }

    drawRow(
      doc,
      y,
      [...cells.slice(0, columns.nameColumnIndex), nameLines[0] ?? cells[columns.nameColumnIndex], ...cells.slice(columns.nameColumnIndex + 1)],
      columns,
      false,
    );
    y += TABLE_ROW_MM;
    for (const extra of nameLines.slice(1)) {
      drawRow(
        doc,
        y,
        columns.headers.map((_, i) => (i === columns.nameColumnIndex ? extra : '')),
        columns,
        false,
      );
      y += TABLE_ROW_MM;
    }
  });
  y += 2;
  doc.setDrawColor(160);
  doc.line(MARGIN_MM, y, rightEdge, y);
  y += 8;

  // --- Totals + payment status are kept together on one page — force a
  // page break up front rather than let this summary block split awkwardly
  // across two pages. ---
  const paymentLines = purchaseOrder.paymentStatus ? 1 : 0;
  const actualTotalDiffers =
    purchaseOrder.actualTotal != null && Number(purchaseOrder.actualTotal) !== Number(purchaseOrder.total);
  const summaryLines =
    2 + // subtotal + total
    (purchaseOrder.isInterstate ? 1 : 2) + // IGST, or CGST + SGST
    (actualTotalDiffers ? 1 : 0) +
    (purchaseOrder.paymentStatus ? 2 : 0) + // amount paid + balance due
    paymentLines;
  const summaryHeightMm = summaryLines * LINE_MM + 10;
  if (y + summaryHeightMm > PAGE_HEIGHT_MM - MARGIN_MM) {
    doc.addPage();
    y = MARGIN_MM;
  }

  doc.setFontSize(BODY_FONT_SIZE_PT);
  function totalLine(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, rightEdge - 55, y, { align: 'left' });
    doc.text(value, rightEdge, y, { align: 'right' });
    y += bold ? LINE_MM + 1.2 : LINE_MM;
    doc.setFont('helvetica', 'normal');
  }

  totalLine('Subtotal', money(purchaseOrder.subtotal));
  if (purchaseOrder.isInterstate) {
    totalLine('IGST', money(purchaseOrder.igstAmount));
  } else {
    totalLine('CGST', money(purchaseOrder.cgstAmount));
    totalLine('SGST', money(purchaseOrder.sgstAmount));
  }
  totalLine('Total', money(purchaseOrder.total), true);

  if (actualTotalDiffers && purchaseOrder.actualTotal != null) {
    totalLine('Actual bill amount', money(purchaseOrder.actualTotal));
  }
  if (purchaseOrder.paymentStatus) {
    const amountPaid = Number(purchaseOrder.amountPaid ?? '0');
    const effectiveTotal = Number(purchaseOrder.actualTotal ?? purchaseOrder.total);
    const balanceDue = Math.max(0, effectiveTotal - amountPaid);
    totalLine('Amount paid', money(amountPaid));
    if (balanceDue > 0) {
      totalLine('Balance due', money(balanceDue));
    }
  }
  y += 4;

  if (purchaseOrder.paymentStatus) {
    doc.setFont('helvetica', 'bold');
    let statusText = PAYMENT_STATUS_LABELS[purchaseOrder.paymentStatus] ?? purchaseOrder.paymentStatus;
    if (purchaseOrder.paymentStatus === 'credit' && purchaseOrder.dueDate) {
      statusText += ` — due ${formatPlainDate(purchaseOrder.dueDate)}`;
    }
    doc.text(statusText, rightEdge, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += LINE_MM + 4;
  }

  return doc.output('blob');
}
