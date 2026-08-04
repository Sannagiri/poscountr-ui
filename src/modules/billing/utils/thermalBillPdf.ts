import { jsPDF } from 'jspdf';

import type {
  ThermalHeaderZoneConfig,
  ThermalLayoutConfig,
} from '@/modules/documentLayouts/pdf/blockRenderers/types';
import { addressDisplayLines, stateLabel } from '@/modules/documentLayouts/pdf/pdfPrimitives';
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
  /** The business's effective (or manually resolved) Thermal Bill layout — drives the Logo zone's enable/size, Header Notes, and Footer text; everything else on the receipt (item table, totals, numbering) stays fixed/computed exactly as before layouts existed for this doc type. */
  config: ThermalLayoutConfig;
  /** Mirrors `OrderSettings.kotReceiptEnabled` — when true, a second page (same print job, own tear-off) is appended: a kitchen-only ticket with the order/token number and item/quantity list, no prices or branding, for a business that runs the kitchen off a manual paper ticket rather than the digital KDS board. */
  includeKotSlip?: boolean;
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
// Reserved blank space before each right-aligned column's boundary (except
// the last column, which already ends at the true right margin) — without
// this a value that exactly fills its column's width sits flush against the
// next column's value with no visual gap between them.
const COLUMN_GAP_MM = 1.3;
/** jsPDF's built-in Helvetica has no ₹ glyph (renders as a broken superscript) — spelled out instead, same convention real thermal-printer firmwares use for the same reason. */
const CURRENCY_PREFIX = 'Rs. ';
// Logo caps per `config.header.size` — a thermal receipt's logo is a small
// mark up top, not a banner, so even "large" stays modest. Whichever
// dimension (width or height) the source image would exceed first is the
// one that drives the scale, so the aspect ratio is always preserved.
// `medium` matches this renderer's own pre-layout-builder hardcoded box
// (26x16mm) so an existing business's receipt doesn't visibly change size
// just from adopting the default layout.
const LOGO_SIZE_MM: Record<
  ThermalHeaderZoneConfig['size'],
  { maxWidthMm: number; maxHeightMm: number }
> = {
  small: { maxWidthMm: 18, maxHeightMm: 11 },
  medium: { maxWidthMm: 26, maxHeightMm: 16 },
  large: { maxWidthMm: 34, maxHeightMm: 21 },
};
const LOGO_BOTTOM_GAP_MM = 2.4;
// Extra clearance below a dotted rule for whichever line starts the very
// next section (right after the top rule, and right after the pre-totals
// rule) — the rule's own RULE_AFTER_MM already puts *some* space there, but
// those two specific lines (Bill No / Taxable value) sit close enough to
// read as touching the dots above them; every other post-rule line (item
// rows, column headers) doesn't have this problem since a table row's own
// baseline sits lower within its line height.
const SECTION_TOP_GAP_MM = 1.6;
// Breathing room above the KOT slip's own "KOT" heading — its page has no
// logo/business-details zone above the title the way the customer bill's
// page can, so without this the heading sits flush against the physical top
// edge of the tear-off.
const KOT_TOP_GAP_MM = 3;
// A logo uploaded for on-screen branding use is routinely 1000px+ wide —
// jsPDF's `addImage` embeds the source pixels as-is regardless of the mm box
// it's drawn into, so without downscaling first, a multi-MB source image
// turns a bill that should be a few KB into several MB. 203dpi (a common
// thermal-printhead resolution) is already sharper than this size ever
// needs on a receipt. Always decoded at the `large` tier's box for print
// quality regardless of the configured size — `fitLogoToTier` below re-fits
// into whichever tier is actually selected at draw time, same two-step
// pattern the A4 renderer's `pdfPrimitives.ts`/`logoBlock.ts` already use,
// so a re-decode is never needed just to change the Size setting.
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

/** Business name, GSTIN, location name/address, and state as the Business Details zone's centered lines — read off `Invoice`'s own denormalized business/location fields (same source `invoicePdf.ts`'s A4 letterhead reads), never a separate fetch. */
function businessDetailsLines(invoice: Invoice): string[] {
  const lines = [invoice.businessName];
  if (invoice.businessGstin) lines.push(`GSTIN: ${invoice.businessGstin}`);
  if (invoice.locationName) lines.push(invoice.locationName);
  lines.push(
    ...addressDisplayLines({
      addressLine1: invoice.locationAddressLine1,
      addressLine2: invoice.locationAddressLine2,
      city: invoice.locationCity,
      pincode: invoice.locationPincode,
    }),
  );
  if (invoice.businessState) lines.push(stateLabel(invoice.businessState));
  return lines;
}

interface LoadedLogo {
  dataUrl: string;
  format: 'PNG';
  /** Natural (undistorted) aspect ratio, decoded once at the `large` tier's box — `fitLogoToTier` rescales this into whichever tier is actually configured at draw time. */
  naturalWidthMm: number;
  naturalHeightMm: number;
}

/** Fits `logo`'s own natural aspect ratio into `size`'s max box — same "cap width, then cap height if still too tall" algorithm `decodeLogo` itself used against the fixed `large` box, reused here against whichever tier is actually configured. */
function fitLogoToTier(
  logo: LoadedLogo,
  size: ThermalHeaderZoneConfig['size'],
): { widthMm: number; heightMm: number } {
  const box = LOGO_SIZE_MM[size];
  const aspect = logo.naturalWidthMm / logo.naturalHeightMm;
  let widthMm = box.maxWidthMm;
  let heightMm = widthMm / aspect;
  if (heightMm > box.maxHeightMm) {
    heightMm = box.maxHeightMm;
    widthMm = heightMm * aspect;
  }
  return { widthMm, heightMm };
}

/**
 * Decodes an already-fetched logo blob into what jsPDF's `addImage` needs —
 * a data URL sized to the `large` tier's box (aspect ratio preserved), not
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

    const largeBox = LOGO_SIZE_MM.large;
    let widthMm = largeBox.maxWidthMm;
    let heightMm = widthMm * (img.naturalHeight / img.naturalWidth);
    if (heightMm > largeBox.maxHeightMm) {
      heightMm = largeBox.maxHeightMm;
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

    return {
      dataUrl: canvas.toDataURL('image/png'),
      format: 'PNG',
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * jsPDF's own `_addPage`/constructor silently SWAPS a custom `[width, height]`
 * array when it disagrees with the requested orientation — `'p'` (jsPDF's
 * default) swaps to `[height, width]` whenever `width > height`, and `'l'`
 * does the same whenever `height > width`. A receipt's actual page is always
 * `widthMm` (58/80, the fixed roll width) by `heightMm` (from content) — for
 * a short KOT slip `heightMm` can end up SMALLER than `widthMm`, and jsPDF's
 * default `'p'` would then swap the two, silently rendering everything at
 * the wrong width. Picking whichever orientation's swap condition is false
 * for the actual `width`/`height` given keeps the array exactly as passed,
 * regardless of which side happens to be larger.
 */
function orientationFor(widthMm: number, heightMm: number): 'p' | 'l' {
  return widthMm <= heightMm ? 'p' : 'l';
}

type Align = 'left' | 'center' | 'right';

/** One line of text, or several if it wraps at the given content width — always measured against the real page width, since wrap points differ between 58mm and 80mm. */
type Block =
  | { kind: 'text'; lines: string[]; bold?: boolean; align?: Align; gapBeforeMm?: number }
  | { kind: 'rule' }
  | { kind: 'row'; cells: string[]; widths: number[]; aligns: Align[]; bold?: boolean }
  | { kind: 'image'; logo: LoadedLogo; widthMm: number; heightMm: number };

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
 * Column shares are tuned against the row font size + `COLUMN_GAP_MM` so the
 * numeric columns' own widest realistic value still fits with room to spare
 * — see the measured-width check that motivated these specific fractions.
 */
/** `"Margherita Pizza"` -> `"Margherita Pizza (-20%)"` when the line carries its own discount — `lineTotal` already nets it in, this just explains why qty × rate doesn't match Amt at a glance. */
function itemNameWithDiscount(item: Order['items'][number]): string {
  const percent = Number(item.discountPercent);
  return percent > 0 ? `${item.name} (-${formatRate(item.discountPercent)}%)` : item.name;
}

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
      cellsFor: (item) => [
        itemNameWithDiscount(item),
        formatQuantity(item.quantity),
        item.unitPrice,
        item.lineTotal,
      ],
    };
  }

  const widths = [0.26, 0.16, 0.19, 0.16, 0.23].map((share) => contentWidthMm * share);
  return {
    headers: ['Item', 'Qty', 'Rate', 'GST%', 'Amt'],
    aligns: ['left', 'right', 'right', 'right', 'right'],
    widths,
    nameColumnIndex: 0,
    cellsFor: (item) => [
      itemNameWithDiscount(item),
      formatQuantity(item.quantity),
      item.unitPrice,
      formatRate(item.gstRate),
      item.lineTotal,
    ],
  };
}

function buildBlocks(
  measure: jsPDF,
  contentWidthMm: number,
  input: ThermalBillInput,
  logo: LoadedLogo | null,
): Block[] {
  const { invoice, order, config } = input;
  const blocks: Block[] = [];

  const wrap = (text: string, widthMm: number = contentWidthMm) =>
    measure.splitTextToSize(text, widthMm) as string[];

  // Top of the bill: logo, then Business Details (only when its position is
  // `'top'` — `'footer'` renders it at the bottom instead, `'none'` never
  // renders it; the two positions are mutually exclusive, never both), then
  // Header Notes.
  if (logo && config.header.enabled) {
    const { widthMm, heightMm } = fitLogoToTier(logo, config.header.size);
    blocks.push({ kind: 'image', logo, widthMm, heightMm });
  }
  if (config.business_details?.position === 'top') {
    blocks.push({ kind: 'text', lines: businessDetailsLines(invoice), align: 'center' });
  }
  if (config.header_notes.enabled && config.header_notes.text) {
    blocks.push({ kind: 'text', lines: wrap(config.header_notes.text), align: 'center' });
  }
  blocks.push({ kind: 'rule' });

  // Middle section: invoice/order meta, items, totals.
  blocks.push({
    kind: 'text',
    lines: wrap(`Bill No: ${invoice.invoiceNumber}`),
    gapBeforeMm: SECTION_TOP_GAP_MM,
  });
  blocks.push({ kind: 'text', lines: wrap(`Date: ${formatDate(invoice.issuedAt)}`) });
  if (order.orderNumber) blocks.push({ kind: 'text', lines: wrap(`Order: ${order.orderNumber}`) });
  if (order.tokenNumber) blocks.push({ kind: 'text', lines: wrap(`Token: #${order.tokenNumber}`) });
  blocks.push({ kind: 'text', lines: wrap(`Customer: ${invoice.customerName || 'Walk-in'}`) });
  if (invoice.customerPhone) blocks.push({ kind: 'text', lines: wrap(invoice.customerPhone) });
  if (input.invoiceSettings.showCustomerGstin && invoice.customerGstin) {
    blocks.push({ kind: 'text', lines: wrap(`Customer GSTIN: ${invoice.customerGstin}`) });
  }
  blocks.push({ kind: 'rule' });

  const columns = buildItemColumns(order, contentWidthMm);
  blocks.push({
    kind: 'row',
    cells: columns.headers,
    widths: columns.widths,
    aligns: columns.aligns,
    bold: true,
  });
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
  if (Number(invoice.discountAmount) > 0) {
    blocks.push({
      kind: 'text',
      lines: [`Order discount: -${invoice.discountAmount}`],
      align: 'right',
      gapBeforeMm: SECTION_TOP_GAP_MM,
    });
    blocks.push({
      kind: 'text',
      lines: [`Taxable value: ${invoice.taxableValue}`],
      align: 'right',
    });
  } else {
    blocks.push({
      kind: 'text',
      lines: [`Taxable value: ${invoice.taxableValue}`],
      align: 'right',
      gapBeforeMm: SECTION_TOP_GAP_MM,
    });
  }
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

  // Bottom of the bill: the single Footer zone (no footer_1..4 split — a
  // receipt is one column wide), then Business Details when its position is
  // `'footer'` (mutually exclusive with the `'top'` placement above).
  if (config.footer_notes.enabled && config.footer_notes.text) {
    blocks.push({ kind: 'text', lines: wrap(config.footer_notes.text), align: 'center' });
  }
  if (config.business_details?.position === 'footer') {
    blocks.push({ kind: 'text', lines: businessDetailsLines(invoice), align: 'center' });
  }

  return blocks;
}

/**
 * Blocks for the kitchen-only KOT slip — order/token/customer identity + a
 * plain Item/Qty list, deliberately carrying none of the customer bill's
 * money fields (price, tax, discount, total) or branding (logo, business
 * details, header/footer notes): the kitchen only ever needs to know who
 * it's for, what to cook, and how many, not what it costs. "Duplicate" right
 * under the "KOT" heading marks it as the kitchen's own copy, distinct from
 * the customer's bill on the page before it. Reuses `wrap`'s own measured
 * word-wrap so the Item column wraps identically to the customer bill's own
 * item rows.
 */
function buildKotBlocks(measure: jsPDF, contentWidthMm: number, input: ThermalBillInput): Block[] {
  const { invoice, order } = input;
  const blocks: Block[] = [];

  const wrap = (text: string, widthMm: number = contentWidthMm) =>
    measure.splitTextToSize(text, widthMm) as string[];

  blocks.push({
    kind: 'text',
    lines: ['KOT'],
    bold: true,
    align: 'center',
    gapBeforeMm: KOT_TOP_GAP_MM,
  });
  blocks.push({ kind: 'text', lines: ['Duplicate'], align: 'center' });
  blocks.push({ kind: 'rule' });

  blocks.push({
    kind: 'text',
    lines: wrap(`Date: ${formatDate(invoice.issuedAt)}`),
    gapBeforeMm: SECTION_TOP_GAP_MM,
  });
  if (order.orderNumber) blocks.push({ kind: 'text', lines: wrap(`Order: ${order.orderNumber}`) });
  if (order.tokenNumber) blocks.push({ kind: 'text', lines: wrap(`Token: #${order.tokenNumber}`) });
  if (order.tableNumber) blocks.push({ kind: 'text', lines: wrap(`Table: ${order.tableNumber}`) });
  blocks.push({ kind: 'text', lines: wrap(`Customer: ${invoice.customerName || 'Walk-in'}`) });
  if (invoice.customerPhone) blocks.push({ kind: 'text', lines: wrap(invoice.customerPhone) });
  blocks.push({ kind: 'rule' });

  const nameColumnWidthMm = contentWidthMm * 0.72;
  const qtyColumnWidthMm = contentWidthMm * 0.28;
  blocks.push({
    kind: 'row',
    cells: ['Item', 'Qty'],
    widths: [nameColumnWidthMm, qtyColumnWidthMm],
    aligns: ['left', 'right'],
    bold: true,
  });
  blocks.push({ kind: 'rule' });
  for (const item of order.items) {
    const nameLines = wrap(item.name, nameColumnWidthMm);
    blocks.push({
      kind: 'row',
      cells: [nameLines[0] ?? item.name, formatQuantity(item.quantity)],
      widths: [nameColumnWidthMm, qtyColumnWidthMm],
      aligns: ['left', 'right'],
    });
    for (const extra of nameLines.slice(1)) {
      blocks.push({
        kind: 'row',
        cells: [extra, ''],
        widths: [nameColumnWidthMm, qtyColumnWidthMm],
        aligns: ['left', 'right'],
      });
    }
  }

  return blocks;
}

function blockHeightMm(block: Block): number {
  if (block.kind === 'rule') return RULE_HEIGHT_MM;
  if (block.kind === 'row') return LINE_HEIGHT_MM;
  if (block.kind === 'image') return block.heightMm + LOGO_BOTTOM_GAP_MM;
  return block.lines.length * LINE_HEIGHT_MM + (block.gapBeforeMm ?? 0);
}

function contentHeightMm(blocks: Block[]): number {
  return blocks.reduce((sum, block) => sum + blockHeightMm(block), 0);
}

/** Draws `blocks` onto `doc`'s current (already-sized) page, top to bottom from `MARGIN_MM` — shared by the customer bill's page and the KOT slip's own page, so both read from the exact same block-drawing rules (rule dashes, row columns, text alignment/gaps). */
function renderBlocksOnPage(
  doc: jsPDF,
  blocks: Block[],
  widthMm: number,
  fontSizePt: number,
  rowFontSizePt: number,
  titleFontSizePt: number,
): void {
  doc.setFontSize(fontSizePt);
  let y = MARGIN_MM;

  for (const block of blocks) {
    if (block.kind === 'image') {
      const x = (widthMm - block.widthMm) / 2;
      doc.addImage(block.logo.dataUrl, block.logo.format, x, y, block.widthMm, block.heightMm);
      y += block.heightMm + LOGO_BOTTOM_GAP_MM;
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
      doc.setFontSize(rowFontSizePt);
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
      doc.setFontSize(fontSizePt);
      doc.setFont('helvetica', 'normal');
      y += LINE_HEIGHT_MM;
      continue;
    }
    y += block.gapBeforeMm ?? 0;
    doc.setFontSize(block.bold && block.lines.length === 1 ? titleFontSizePt : fontSizePt);
    doc.setFont('helvetica', block.bold ? 'bold' : 'normal');
    for (const line of block.lines) {
      const align = block.align ?? 'left';
      const x =
        align === 'center' ? widthMm / 2 : align === 'right' ? widthMm - MARGIN_MM : MARGIN_MM;
      doc.text(line, x, y, { align });
      y += LINE_HEIGHT_MM;
    }
    doc.setFontSize(fontSizePt);
    doc.setFont('helvetica', 'normal');
  }
}

/**
 * Renders the given order's GST invoice as a receipt-shaped PDF sized for
 * `invoiceSettings.paperWidth` (58mm/80mm thermal roll). Height is computed
 * from the actual content — not a fixed A4-like page — since item-name
 * wrapping and line counts differ between the two widths. Async because the
 * logo (if any) has to be fetched and decoded before the page height (which
 * depends on the logo's rendered size) can even be computed.
 *
 * Every font size is derived from `config.font_size_pt` (the layout's own
 * base size, same setting the A4 builder exposes) rather than a fixed
 * constant — body/meta/notes text renders at exactly that size, matching
 * `tableRenderer.ts`'s own "literal, not scaled" policy so the whole receipt
 * reads as one consistent size, not a mismatched patchwork. The item table
 * stays 1pt smaller (a real column-width constraint: up to 5 columns must
 * fit a 58mm roll's ~50mm content width) and the bold Total line 2pt larger
 * (a receipt convention, matches the A4 title's own "one deliberate
 * exception" treatment) — both still scale together with the base setting,
 * they just keep their own relative offset from it.
 */
export async function buildThermalBillPdf(input: ThermalBillInput): Promise<Blob> {
  const widthMm = input.invoiceSettings.paperWidth === '58mm' ? 58 : 80;
  const contentWidthMm = widthMm - 2 * MARGIN_MM;
  const logo = input.logoBlob ? await decodeLogo(input.logoBlob) : null;

  const fontSizePt = input.config.font_size_pt;
  const rowFontSizePt = fontSizePt - 1;
  const titleFontSizePt = fontSizePt + 2;

  // First pass against a throwaway doc of the real width, purely to measure
  // wrapped line counts — jsPDF can't report those without a page to wrap against.
  const measure = new jsPDF({ unit: 'mm', format: [widthMm, 297] });
  measure.setFontSize(fontSizePt);
  const blocks = buildBlocks(measure, contentWidthMm, input, logo);
  const heightMm = MARGIN_MM * 2 + contentHeightMm(blocks);

  const doc = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: orientationFor(widthMm, heightMm),
  });
  renderBlocksOnPage(doc, blocks, widthMm, fontSizePt, rowFontSizePt, titleFontSizePt);

  // Second tear-off in the same print job — a business with `kotReceiptEnabled`
  // wants the kitchen ticket printed right after the customer bill, not as a
  // separate manual print action. Same page size as the bill page above —
  // this was briefly sized to its own (shorter) content instead to save
  // paper, but a real print pipeline that doesn't recognize this custom
  // small page size (falls back to a standard sheet like Letter, then
  // "fit to paper" scales each page independently) stretches two
  // differently-sized pages by two different factors, so the KOT page came
  // out visibly misaligned with the bill instead of matching it. Matching
  // dimensions removes that inconsistency regardless of how any given
  // print pipeline handles a non-native page size.
  if (input.includeKotSlip) {
    const kotBlocks = buildKotBlocks(measure, contentWidthMm, input);
    doc.addPage([widthMm, heightMm], orientationFor(widthMm, heightMm));
    renderBlocksOnPage(doc, kotBlocks, widthMm, fontSizePt, rowFontSizePt, titleFontSizePt);
  }

  return doc.output('blob');
}
