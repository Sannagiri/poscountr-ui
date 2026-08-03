import { PAGE_WIDTH_MM, scaleFontSize, TITLE_FONT_SIZE_PT } from '../pdfPrimitives';
import type { A4DocType, BlockRenderer } from './types';

/** `invoicePdf.ts`/`purchaseOrderPdf.ts`'s own fixed title text; quotation renders none. */
const TITLE_TEXT: Record<A4DocType, string> = {
  invoice: 'TAX INVOICE',
  quotation: '',
  purchase_order: 'PURCHASE ORDER',
};

/**
 * The fixed system title — distinct from `HEADER_NOTES` (free text) and
 * `NOTES_TERMS` (footer free text/table). `props.text` lets a slot override
 * the default per-doc-type label; an empty string (the quotation default,
 * or an explicit override) renders nothing and returns `at.y` unchanged.
 * Always centered on the full page width, matching every original's
 * `PAGE_WIDTH_MM / 2` centering regardless of `at.x`/`at.width` — `title_row`
 * is a full-width slot.
 */
export const titleBlock: BlockRenderer = (doc, at, ctx, fontSizePt) => {
  const text =
    (typeof at.props.text === 'string' ? at.props.text : undefined) ?? TITLE_TEXT[ctx.docType];
  if (!text) return at.y;

  const overrideFontSizePt =
    typeof at.props.fontSizePt === 'number' ? at.props.fontSizePt : undefined;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(overrideFontSizePt ?? scaleFontSize(TITLE_FONT_SIZE_PT, fontSizePt));
  doc.text(text, PAGE_WIDTH_MM / 2, at.y, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  return at.y + 9;
};
