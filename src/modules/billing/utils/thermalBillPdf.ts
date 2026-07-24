import { jsPDF } from 'jspdf';

import { formatQuantity } from '@/modules/inventory';
// Concrete-file import, not the `@/modules/reports` barrel — see the note in
// `billingService.ts` (avoids a billing <-> reports barrel cycle).
import type { Invoice } from '@/modules/reports/types/reports.types';
import type { InvoiceSettings } from '@/modules/settings';

import type { Order } from '../types/billing.types';

export interface ThermalBillInput {
  invoice: Invoice;
  order: Order;
  invoiceSettings: InvoiceSettings;
  /**
   * Pre-fetched logo bytes (via `settingsService.getInvoiceLogoBlob`) — the
   * actual network fetch happens in the caller, since it needs an
   * authenticated request through this app's own API (a direct cross-origin
   * `fetch()` of the public S3 URL fails outright whenever the bucket has
   * no CORS policy for this app's origin). This module only decodes and
   * sizes it. Omit or pass `null` to render the bill with no logo.
   */
  logoBlob?: Blob | null;
}

const MARGIN_MM = 4;
const LINE_HEIGHT_MM = 4.2;
// Asymmetric on purpose — a rule sits close to the text baseline above it, so
// glyph ascenders on the line below need more clearance than the line above
// needs. Measured empirically against jsPDF's own Helvetica metrics at
// FONT_SIZE_PT (see the PDF-rendered check that motivated this): 2.2mm before
// + 3.4mm after is the smallest gap that doesn't visually touch either line.
const RULE_BEFORE_MM = 2.2;
const RULE_AFTER_MM = 3.4;
const RULE_HEIGHT_MM = RULE_BEFORE_MM + RULE_AFTER_MM;
// Extra breathing room right before the Total line — the tax breakdown
// lines above it (Taxable value/CGST/SGST/Round off) stay uniformly spaced
// at LINE_HEIGHT_MM each; this gap is what makes Total read as the one that
// stands out, not just another line in the same list.
const TOTAL_EXTRA_GAP_MM = 1.8;
const FONT_SIZE_PT = 8;
const FONT_SIZE_TITLE_PT = 10;
// The item table gets its own (smaller) size — up to 5 columns (Item/Qty/
// Rate/GST%/Amt) have to fit across a 58mm roll's ~50mm content width; 8pt
// left the numeric columns exactly as wide as their own values with zero
// room for COLUMN_GAP_MM, so "Rate"/"GST%" visibly ran together.
const ROW_FONT_SIZE_PT = 7;
// Reserved blank space before each right-aligned column's boundary (except
// the last column, which already ends at the true right margin) — without
// this a value that exactly fills its column's width sits flush against the
// next column's value with no visual gap between them.
const COLUMN_GAP_MM = 1.3;
/** jsPDF's built-in Helvetica has no ₹ glyph (renders as a broken superscript) — spelled out instead, same convention real thermal-printer firmwares use for the same reason. */
const CURRENCY_PREFIX = 'Rs. ';
// Logo caps — a thermal receipt's logo is a small mark up top, not a banner;
// whichever dimension (width or height) the source image would exceed first
// is the one that drives the scale, so the aspect ratio is always preserved.
const LOGO_MAX_WIDTH_MM = 26;
const LOGO_MAX_HEIGHT_MM = 16;
const LOGO_BOTTOM_GAP_MM = 2.4;
// A logo uploaded for on-screen branding use is routinely 1000px+ wide —
// jsPDF's `addImage` embeds the source pixels as-is regardless of the mm box
// it's drawn into, so without downscaling first, a multi-MB source image
// turns a bill that should be a few KB into several MB. 203dpi (a common
// thermal-printhead resolution) is already sharper than this size ever
// needs on a receipt.
const LOGO_TARGET_DPI = 203;
const MM_PER_INCH = 25.4;

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `"5.00"` -> `"5"`, `"12.50"` -> `"12.5"` — a GST-rate label reads cleaner without trailing zeros. */
function formatRate(rate: string): string {
  const num = Number(rate);
  if (!Number.isFinite(num)) return rate;
  return num.toFixed(2).replace(/\.?0+$/, '') || '0';
}

interface LoadedLogo {
  dataUrl: string;
  format: 'PNG';
  widthMm: number;
  heightMm: number;
}

/**
 * Decodes an already-fetched logo blob into what jsPDF's `addImage` needs —
 * a data URL sized to the mm box it's drawn into (fit within
 * `LOGO_MAX_WIDTH_MM` x `LOGO_MAX_HEIGHT_MM`, aspect ratio preserved), not
 * just *displayed* at that size while carrying the full source resolution.
 * Draws through a `<canvas>` at `LOGO_TARGET_DPI` to actually downscale the
 * pixels — `img.src` is a same-origin `blob:` URL (the blob came from this
 * app's own API, not a raw cross-origin fetch), so this canvas read never
 * hits the tainted-canvas restriction. Returns `null` on any failure — a
 * missing/broken logo should degrade the bill to no-logo, never block it.
 */
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

    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', widthMm, heightMm };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type Align = 'left' | 'center' | 'right';

/** One line of text, or several if it wraps at the given content width — always measured against the real page width, since wrap points differ between 58mm and 80mm. */
type Block =
  | { kind: 'text'; lines: string[]; bold?: boolean; align?: Align; gapBeforeMm?: number }
  | { kind: 'rule' }
  | { kind: 'row'; cells: string[]; widths: number[]; aligns: Align[]; bold?: boolean }
  | { kind: 'image'; logo: LoadedLogo };

interface ItemColumns {
  headers: string[];
  aligns: Align[];
  widths: number[];
  /** Index of the "Item" column — the only one that wraps instead of getting cut off. */
  nameColumnIndex: number;
  /** Per-item cell values, in the same column order as `headers`. */
  cellsFor: (item: Order['items'][number]) => string[];
}

/**
 * Item-table shape depends on whether every line shares one GST rate:
 * uniform -> Item/Qty/Rate/Amt (rate% is stated once in the totals block);
 * mixed -> an extra GST% column per line, and totals show plain amounts.
 * Column shares are tuned against `ROW_FONT_SIZE_PT` + `COLUMN_GAP_MM` so the
 * numeric columns' own widest realistic value still fits with room to spare
 * — see the measured-width check that motivated these specific fractions.
 */
function buildItemColumns(order: Order, contentWidthMm: number): ItemColumns {
  const rates = new Set(order.items.map((item) => item.gstRate));
  const isUniformRate = rates.size <= 1;

  if (isUniformRate) {
    const widths = [0.4, 0.17, 0.19, 0.24].map((share) => contentWidthMm * share);
    return {
      headers: ['Item', 'Qty', 'Rate', 'Amt'],
      aligns: ['left', 'right', 'right', 'right'],
      widths,
      nameColumnIndex: 0,
      cellsFor: (item) => [item.name, formatQuantity(item.quantity), item.unitPrice, item.lineTotal],
    };
  }

  const widths = [0.26, 0.16, 0.19, 0.16, 0.23].map((share) => contentWidthMm * share);
  return {
    headers: ['Item', 'Qty', 'Rate', 'GST%', 'Amt'],
    aligns: ['left', 'right', 'right', 'right', 'right'],
    widths,
    nameColumnIndex: 0,
    cellsFor: (item) => [
      item.name,
      formatQuantity(item.quantity),
      item.unitPrice,
      formatRate(item.gstRate),
      item.lineTotal,
    ],
  };
}

function buildBlocks(measure: jsPDF, contentWidthMm: number, input: ThermalBillInput, logo: LoadedLogo | null): Block[] {
  const { invoice, order, invoiceSettings } = input;
  const blocks: Block[] = [];

  const wrap = (text: string, widthMm: number = contentWidthMm) =>
    measure.splitTextToSize(text, widthMm) as string[];

  // Top of the bill: logo, then the header note — nothing else. Business
  // name/address/GSTIN intentionally don't appear here (the logo already
  // carries the business's identity); they're still fully present on the
  // stored `Invoice` row itself for GST/audit purposes, just not printed.
  if (logo) blocks.push({ kind: 'image', logo });
  if (invoiceSettings.headerNote) {
    blocks.push({ kind: 'text', lines: wrap(invoiceSettings.headerNote), align: 'center' });
  }
  blocks.push({ kind: 'rule' });

  // Middle section: invoice/order meta, items, totals.
  blocks.push({ kind: 'text', lines: wrap(`Bill No: ${invoice.invoiceNumber}`) });
  blocks.push({ kind: 'text', lines: wrap(`Date: ${formatDate(invoice.issuedAt)}`) });
  if (order.orderNumber) blocks.push({ kind: 'text', lines: wrap(`Order: ${order.orderNumber}`) });
  if (order.tokenNumber) blocks.push({ kind: 'text', lines: wrap(`Token: #${order.tokenNumber}`) });
  blocks.push({ kind: 'text', lines: wrap(`Customer: ${invoice.customerName || 'Walk-in'}`) });
  if (invoice.customerPhone) blocks.push({ kind: 'text', lines: wrap(invoice.customerPhone) });
  if (invoiceSettings.showCustomerGstin && invoice.customerGstin) {
    blocks.push({ kind: 'text', lines: wrap(`Customer GSTIN: ${invoice.customerGstin}`) });
  }
  blocks.push({ kind: 'rule' });

  const columns = buildItemColumns(order, contentWidthMm);
  blocks.push({ kind: 'row', cells: columns.headers, widths: columns.widths, aligns: columns.aligns, bold: true });
  blocks.push({ kind: 'rule' });
  const rates = new Set(order.items.map((item) => item.gstRate));
  const isUniformRate = rates.size <= 1;
  for (const item of order.items) {
    const cells = columns.cellsFor(item);
    const nameLines = wrap(cells[columns.nameColumnIndex], columns.widths[columns.nameColumnIndex]);
    blocks.push({
      kind: 'row',
      cells: [nameLines[0] ?? cells[0], ...cells.slice(1)],
      widths: columns.widths,
      aligns: columns.aligns,
    });
    for (const extra of nameLines.slice(1)) {
      blocks.push({
        kind: 'row',
        cells: [extra, ...cells.slice(1).map(() => '')],
        widths: columns.widths,
        aligns: columns.aligns,
      });
    }
  }
  blocks.push({ kind: 'rule' });

  // Totals — always the invoice's own snapshot, never re-derived here. The
  // rate is only stated here (CGST @2.5%) when every line shares one GST
  // rate; a mixed-rate order already carries each line's rate in its own
  // "GST%" column above, so the totals here stay plain.
  blocks.push({ kind: 'text', lines: [`Taxable value: ${invoice.taxableValue}`], align: 'right' });
  const uniformRate = isUniformRate ? formatRate(order.items[0]?.gstRate ?? '0') : null;
  if (invoice.isInterstate) {
    const label = uniformRate ? `IGST @${uniformRate}%` : 'IGST';
    blocks.push({ kind: 'text', lines: [`${label}: ${invoice.igstAmount}`], align: 'right' });
  } else {
    const half = uniformRate ? formatRate(String(Number(uniformRate) / 2)) : null;
    const cgstLabel = half ? `CGST @${half}%` : 'CGST';
    const sgstLabel = half ? `SGST @${half}%` : 'SGST';
    blocks.push({ kind: 'text', lines: [`${cgstLabel}: ${invoice.cgstAmount}`], align: 'right' });
    blocks.push({ kind: 'text', lines: [`${sgstLabel}: ${invoice.sgstAmount}`], align: 'right' });
  }
  if (Number(invoice.roundOff) !== 0) {
    blocks.push({ kind: 'text', lines: [`Round off: ${invoice.roundOff}`], align: 'right' });
  }
  blocks.push({
    kind: 'text',
    lines: [`Total: ${CURRENCY_PREFIX}${invoice.total}`],
    bold: true,
    align: 'right',
    gapBeforeMm: TOTAL_EXTRA_GAP_MM,
  });
  blocks.push({ kind: 'rule' });

  // Bottom of the bill: footer note only.
  if (invoiceSettings.footerNote) {
    blocks.push({ kind: 'text', lines: wrap(invoiceSettings.footerNote), align: 'center' });
  }
  blocks.push({ kind: 'text', lines: ['This is a computer-generated GST invoice.'], align: 'center' });

  return blocks;
}

function blockHeightMm(block: Block): number {
  if (block.kind === 'rule') return RULE_HEIGHT_MM;
  if (block.kind === 'row') return LINE_HEIGHT_MM;
  if (block.kind === 'image') return block.logo.heightMm + LOGO_BOTTOM_GAP_MM;
  return block.lines.length * LINE_HEIGHT_MM + (block.gapBeforeMm ?? 0);
}

/**
 * Renders the given order's GST invoice as a receipt-shaped PDF sized for
 * `invoiceSettings.paperWidth` (58mm/80mm thermal roll). Height is computed
 * from the actual content — not a fixed A4-like page — since item-name
 * wrapping and line counts differ between the two widths. Async because the
 * logo (if any) has to be fetched and decoded before the page height (which
 * depends on the logo's rendered size) can even be computed.
 */
export async function buildThermalBillPdf(input: ThermalBillInput): Promise<Blob> {
  const widthMm = input.invoiceSettings.paperWidth === '58mm' ? 58 : 80;
  const contentWidthMm = widthMm - 2 * MARGIN_MM;
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  // First pass against a throwaway doc of the real width, purely to measure
  // wrapped line counts — jsPDF can't report those without a page to wrap against.
  const measure = new jsPDF({ unit: 'mm', format: [widthMm, 297] });
  measure.setFontSize(FONT_SIZE_PT);
  const blocks = buildBlocks(measure, contentWidthMm, input, logo);
  const contentHeightMm = blocks.reduce((sum, block) => sum + blockHeightMm(block), 0);
  const heightMm = MARGIN_MM * 2 + contentHeightMm;

  const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] });
  doc.setFontSize(FONT_SIZE_PT);
  let y = MARGIN_MM;

  for (const block of blocks) {
    if (block.kind === 'image') {
      const x = (widthMm - block.logo.widthMm) / 2;
      doc.addImage(block.logo.dataUrl, block.logo.format, x, y, block.logo.widthMm, block.logo.heightMm);
      y += block.logo.heightMm + LOGO_BOTTOM_GAP_MM;
      continue;
    }
    if (block.kind === 'rule') {
      y += RULE_BEFORE_MM;
      doc.setLineDashPattern([0.5, 0.5], 0);
      doc.line(MARGIN_MM, y, widthMm - MARGIN_MM, y);
      y += RULE_AFTER_MM;
      continue;
    }
    if (block.kind === 'row') {
      doc.setFontSize(ROW_FONT_SIZE_PT);
      doc.setFont('helvetica', block.bold ? 'bold' : 'normal');
      let x = MARGIN_MM;
      block.cells.forEach((cell, index) => {
        const width = block.widths[index];
        const align = block.aligns[index];
        const isLastColumn = index === block.cells.length - 1;
        const gap = align === 'right' && !isLastColumn ? COLUMN_GAP_MM : 0;
        const textX = align === 'right' ? x + width - gap : align === 'center' ? x + width / 2 : x;
        doc.text(cell, textX, y, { align });
        x += width;
      });
      doc.setFontSize(FONT_SIZE_PT);
      doc.setFont('helvetica', 'normal');
      y += LINE_HEIGHT_MM;
      continue;
    }
    y += block.gapBeforeMm ?? 0;
    doc.setFontSize(block.bold && block.lines.length === 1 ? FONT_SIZE_TITLE_PT : FONT_SIZE_PT);
    doc.setFont('helvetica', block.bold ? 'bold' : 'normal');
    for (const line of block.lines) {
      const align = block.align ?? 'left';
      const x = align === 'center' ? widthMm / 2 : align === 'right' ? widthMm - MARGIN_MM : MARGIN_MM;
      doc.text(line, x, y, { align });
      y += LINE_HEIGHT_MM;
    }
    doc.setFontSize(FONT_SIZE_PT);
    doc.setFont('helvetica', 'normal');
  }

  return doc.output('blob');
}
