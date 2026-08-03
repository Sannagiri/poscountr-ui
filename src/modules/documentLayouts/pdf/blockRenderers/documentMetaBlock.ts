import { LINE_MM } from '../pdfPrimitives';
import type { A4DocType, BlockRenderer } from './types';

/** `invoicePdf.ts`/`quotationPdf.ts`/`purchaseOrderPdf.ts`'s own three headings + number-line labels for the "document details" block. */
const DOCUMENT_META: Record<A4DocType, { heading: string; numberLabel: string }> = {
  invoice: { heading: 'Invoice info', numberLabel: 'Invoice No' },
  quotation: { heading: 'Quotation info', numberLabel: 'Quotation No' },
  purchase_order: { heading: 'Purchase order info', numberLabel: 'PO No' },
};

/**
 * The "document details" block paired with `partyDetailsBlock` — number +
 * date + doc-specific extra lines (order #/place of supply for an invoice,
 * status/valid-until for a quotation, payment/due-date for a purchase
 * order). The heading + number label branch on `ctx.docType`; the extra
 * lines themselves are pre-formatted `"Label: value"` strings supplied by
 * `ctx.documentMeta.extraLines` (a later task's adapter builds those per
 * doc type) rather than this block re-deriving each one's own field set.
 */
export const documentMetaBlock: BlockRenderer = (doc, at, ctx, fontSizePt) => {
  const meta = DOCUMENT_META[ctx.docType];
  let y = at.y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.text(meta.heading, at.x, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  const lines = [
    `${meta.numberLabel}: ${ctx.documentMeta.number}`,
    `Date: ${ctx.documentMeta.date}`,
    ...(ctx.documentMeta.extraLines ?? []),
  ];
  for (const infoLine of lines) {
    for (const line of doc.splitTextToSize(infoLine, at.width) as string[]) {
      doc.text(line, at.x, y);
      y += LINE_MM;
    }
  }

  return y;
};
