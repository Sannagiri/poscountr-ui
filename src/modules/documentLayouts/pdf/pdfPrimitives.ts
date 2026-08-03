import type { jsPDF } from 'jspdf';

import { INDIAN_STATE_OPTIONS } from '@/modules/businesses';
import type { PaymentDetail } from '@/modules/paymentDetails';

/**
 * Shared drawing primitives for every A4 jsPDF document in this app —
 * consolidated verbatim from `invoicePdf.ts`/`quotationPdf.ts`/
 * `purchaseOrderPdf.ts`, which each defined an identical (or near-identical)
 * copy of everything in this file. Nothing in here is doc-type-aware; that
 * lives in `blockRenderers/`, `tableRenderer.ts`, and `buildDocumentPdf.ts`.
 *
 * Values picked as "canonical" where the three originals disagreed slightly
 * (documented per-constant below) match `invoicePdf.ts`, since that's this
 * groundwork step's pixel-exact reproduction target (see the plan's
 * Validation section) — `quotationPdf.ts`/`purchaseOrderPdf.ts` aren't
 * rewired to this renderer until a later step.
 */

// --- Page geometry -----------------------------------------------------

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MARGIN_MM = 16;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
/** Right content edge — `PAGE_WIDTH_MM - MARGIN_MM`, computed once since every block needs it. */
export const RIGHT_EDGE_MM = PAGE_WIDTH_MM - MARGIN_MM;
/** Where the two-column bands (party/document-meta, pre-table, post-table) split — matches every original's `CONTENT_WIDTH_MM * 0.58`/`0.42`. */
export const RIGHT_COLUMN_X_MM = MARGIN_MM + CONTENT_WIDTH_MM * 0.58;
export const RIGHT_COLUMN_WIDTH_MM = CONTENT_WIDTH_MM * 0.42;

// --- Typography ----------------------------------------------------------

/** Canonical title size — matches `invoicePdf.ts` (18pt); `purchaseOrderPdf.ts`'s hardcoded title used 20pt, a divergence noted in this task's report. */
export const TITLE_FONT_SIZE_PT = 18;
export const HEADING_FONT_SIZE_PT = 11;
export const BODY_FONT_SIZE_PT = 9.5;
export const SMALL_FONT_SIZE_PT = 8.5;
/** Canonical table body size — matches `invoicePdf.ts` (8pt); `quotationPdf.ts`/`purchaseOrderPdf.ts` used 8.5pt, a divergence noted in this task's report. */
export const TABLE_FONT_SIZE_PT = 8;

/** Mirrors `constants/documentLayouts.constants.ts`'s `DEFAULT_FONT_SIZE_PT` — duplicated here (not imported) to avoid a `pdf/` <-> `constants/` <-> `types/` import cycle, same reasoning `tableRenderer.ts` already documented for its own copy. Every block renderer scales its own base size off this via `scaleFontSize` so the whole document responds to `LayoutConfig.font_size_pt` together, not just the item table. */
export const DEFAULT_FONT_SIZE_PT = 8;

/** `basePt` (one of this file's own `*_FONT_SIZE_PT` constants) scaled by how far `fontSizePt` (`LayoutConfig.font_size_pt`) sits from `DEFAULT_FONT_SIZE_PT` — keeps every block's relative type hierarchy (title > heading > body > small) intact while making the whole document grow/shrink together from the single layout-wide setting. */
export function scaleFontSize(basePt: number, fontSizePt: number): number {
  return basePt * (fontSizePt / DEFAULT_FONT_SIZE_PT);
}

export const LINE_MM = 4.6;
export const TABLE_ROW_MM = 6;

/** Height of the running footer band (`footer_1..4`) reserved at the bottom of every page — anchored like a Word document footer (fixed offset from the page bottom) rather than wherever the main content flow happens to end, so it never lands on top of table rows on a continuation page. Sized for a couple of wrapped lines (a short `notes_terms` block, `page_meta`, or similar) plus top/bottom padding within the band. */
export const FOOTER_BAND_HEIGHT_MM = 20;

/** jsPDF's built-in Helvetica has no ₹ glyph — spelled out instead, same convention every PDF template in this app uses. */
export const CURRENCY_PREFIX = 'Rs. ';

// --- Logo ------------------------------------------------------------

/** `LayoutConfig.header.size` — mirrors `LOGO_SIZES` (`apps/document_layouts/constants.py`). */
export type LogoSize = 'small' | 'medium' | 'large';

/**
 * Max width/height box per `LayoutConfig.header.size` tier — `large` is the
 * same 38x22 box `decodeLogo` has always fit into (kept fixed for decode
 * quality regardless of the configured display size); `small`/`medium` are
 * this task's own reasonable picks, proportionally smaller at the same
 * ~1.73 aspect-ratio cap (`24/14 ≈ 31/18 ≈ 38/22`). `fitLogoToTier` below
 * re-fits an already-decoded logo's own natural aspect ratio into whichever
 * tier at DRAW time, so a re-decode is never needed just to change size.
 */
export const LOGO_SIZE_MM: Record<LogoSize, { maxWidthMm: number; maxHeightMm: number }> = {
  small: { maxWidthMm: 24, maxHeightMm: 14 },
  medium: { maxWidthMm: 31, maxHeightMm: 18 },
  large: { maxWidthMm: 38, maxHeightMm: 22 },
};

export const LOGO_MAX_WIDTH_MM = LOGO_SIZE_MM.large.maxWidthMm;
export const LOGO_MAX_HEIGHT_MM = LOGO_SIZE_MM.large.maxHeightMm;
/** A print document is judged more closely than a thermal receipt — 300dpi (a common office-printer resolution) keeps the embedded logo sharp at this box size without ballooning the PDF's own size. */
export const LOGO_TARGET_DPI = 300;
export const MM_PER_INCH = 25.4;

export interface LoadedLogo {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

/**
 * Fits a `naturalWidthMm x naturalHeightMm` box's own aspect ratio into
 * `tier`'s max box — the same "cap width, then cap height if it's still too
 * tall" algorithm `decodeLogo` itself uses for its own fixed `large` box,
 * just reused at render time (`blockRenderers/logoBlock.ts`'s `drawLogoZone`/
 * `logoZoneHeightMm`) against whichever tier `LayoutConfig.header.size`
 * currently picks — decode itself always rasterizes at the `large` tier
 * for print quality, so this is what actually makes the Size selector's
 * three tiers visually differ, in production and in the layout editor's
 * live preview (a single static fixture logo, decoded/loaded once) alike.
 */
export function fitLogoToTier(
  naturalWidthMm: number,
  naturalHeightMm: number,
  tier: LogoSize,
): { widthMm: number; heightMm: number } {
  const box = LOGO_SIZE_MM[tier];
  const aspect = naturalWidthMm / naturalHeightMm;
  let widthMm = box.maxWidthMm;
  let heightMm = widthMm / aspect;
  if (heightMm > box.maxHeightMm) {
    heightMm = box.maxHeightMm;
    widthMm = heightMm * aspect;
  }
  return { widthMm, heightMm };
}

/** Same decode/downscale pipeline every original `decodeLogo` used — a same-origin `blob:` URL drawn through a `<canvas>` at print DPI. */
export async function decodeLogo(blob: Blob): Promise<LoadedLogo | null> {
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

// --- State labels ------------------------------------------------------

export const STATE_LABELS: Record<string, string> = Object.fromEntries(
  INDIAN_STATE_OPTIONS.map((option) => [option.value, option.label]),
);

export function stateLabel(code: string): string {
  return STATE_LABELS[code] ?? code;
}

// --- Formatting ----------------------------------------------------------

/** An absolute timestamp -> `"22 Jun 2021"`. */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** A plain `YYYY-MM-DD` field (e.g. `validUntil`/`dueDate`) -> `"22 Jun 2021"`, without a timezone-driven off-by-one day. Not read off `invoicePdf.ts` (it has no plain-date field) but identical in `quotationPdf.ts`/`purchaseOrderPdf.ts`. */
export function formatPlainDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** `"5.00"` -> `"5"`, `"12.50"` -> `"12.5"` — same trim every original `formatRate` uses. */
export function formatRate(rate: string): string {
  const num = Number(rate);
  if (!Number.isFinite(num)) return rate;
  return num.toFixed(2).replace(/\.?0+$/, '') || '0';
}

/** `bare: true` omits the `"Rs. "` prefix — for a table cell whose column header already carries "(Rs.)" once. */
export function money(value: string | number, options?: { bare?: boolean }): string {
  const num = typeof value === 'number' ? value : Number(value);
  const formatted = Number.isFinite(num) ? num.toFixed(2) : String(value);
  return options?.bare ? formatted : `${CURRENCY_PREFIX}${formatted}`;
}

/**
 * A structured address as up to three separate display lines — `"Address:
 * <line1>"`, `<line2>` (if present), and `"<city> - <pincode>"` (if either
 * is present) — rather than one long comma-joined line. `invoicePdf.ts`
 * reads this off `Invoice`'s own denormalized `locationAddressLine1/2/City/
 * Pincode`; `quotationPdf.ts`/`purchaseOrderPdf.ts` read it off a separate
 * `Location`/`Supplier`. Both shapes reduce to the same four optional
 * fields, so callers adapt their own source object to `AddressLike` (a
 * future task's `RenderContext`-building adapter does this for
 * `invoicePdf.ts`'s callers) rather than this function branching on doc type.
 */
export interface AddressLike {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  pincode?: string;
}

export function addressDisplayLines(entity: AddressLike | null | undefined): string[] {
  if (!entity) return [];
  const lines: string[] = [];
  if (entity.addressLine1) lines.push(`Address: ${entity.addressLine1}`);
  if (entity.addressLine2) lines.push(entity.addressLine2);
  const cityZip = [entity.city, entity.pincode].filter(Boolean).join(' - ');
  if (cityZip) lines.push(cityZip);
  return lines;
}

// --- Amount in words (Indian numbering) -----------------------------------

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** `0`-`99` -> words, e.g. `42` -> `"Forty Two"`. */
export function twoDigitWords(num: number): string {
  if (num < 20) return ONES[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

/** `0`-`999` -> words, e.g. `450` -> `"Four Hundred Fifty"`. */
export function threeDigitWords(num: number): string {
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitWords(rest));
  return parts.join(' ') || 'Zero';
}

/**
 * Indian numbering (lakh/crore groupings, not Western thousand/million) — a
 * non-negative integer -> words, e.g. `1234567` -> `"Twelve Lakh Thirty Four
 * Thousand Five Hundred Sixty Seven"`.
 */
export function numberToIndianWords(value: number): string {
  if (value === 0) return 'Zero';
  let num = Math.floor(value);

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(' ');
}

/** A total's rupee part (ignoring paise unless nonzero) -> `"Rupees Four Hundred Fifty Only"`, ending in "Only" per GST-invoice convention. */
export function amountInWords(total: string): string {
  const num = Number(total);
  const rupees = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - rupees) * 100);
  const rupeeWords = numberToIndianWords(rupees);
  if (paise > 0) {
    return `Rupees ${rupeeWords} and ${twoDigitWords(paise)} Paise Only`;
  }
  return `Rupees ${rupeeWords} Only`;
}

// --- Multi-line text -----------------------------------------------------

/**
 * Word-wraps `text` to `maxWidthMm`, respecting embedded `\n` line breaks as
 * hard breaks rather than collapsing them — `doc.splitTextToSize(text, w)`
 * alone treats the whole string as one continuous run and does not reliably
 * preserve intentional blank/line breaks a user typed into a textarea
 * (`header_notes`/`footer_notes`/`notes_terms`'s plain-text mode). Splits on
 * `\n` first into paragraphs, then word-wraps each paragraph independently,
 * preserving empty lines (`''`) as their own blank output line.
 */
export function wrapMultilineText(doc: jsPDF, text: string, maxWidthMm: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    lines.push(...(doc.splitTextToSize(paragraph, maxWidthMm) as string[]));
  }
  return lines;
}

// --- Table row drawing -----------------------------------------------------

export type Align = 'left' | 'center' | 'right';

/**
 * Draws one row of pre-computed cell strings at fixed column x-offsets —
 * used both for the item-table header/body rows (`tableRenderer.ts`) and
 * for the totals summary's aligned label/value pairs. Identical across all
 * three originals.
 */
export function drawRow(
  doc: jsPDF,
  y: number,
  cells: string[],
  columns: { widths: number[]; aligns: Align[] },
  bold: boolean,
  startX: number = MARGIN_MM,
) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  let x = startX;
  cells.forEach((cell, index) => {
    const width = columns.widths[index];
    const align = columns.aligns[index];
    const textX = align === 'right' ? x + width : align === 'center' ? x + width / 2 : x;
    doc.text(cell, textX, y, { align });
    x += width;
  });
  doc.setFont('helvetica', 'normal');
}

// --- Payment details ---------------------------------------------------

/** One payment detail's own two/three lines — shared by the Payment Details block's `bank` and `upi` rendering, same as every original's `paymentDetailLines`. */
export function paymentDetailLines(detail: PaymentDetail): string[] {
  if (detail.detailType === 'bank') {
    const lines = [
      detail.label,
      `Bank: ${detail.bankName}`,
      `A/C: ${detail.accountNumber}`,
      `IFSC: ${detail.ifscCode}`,
    ];
    if (detail.branch) lines.push(`Branch: ${detail.branch}`);
    return lines;
  }
  const lines = [detail.label, `UPI: ${detail.upiId}`];
  if (detail.upiName) lines.push(detail.upiName);
  return lines;
}
