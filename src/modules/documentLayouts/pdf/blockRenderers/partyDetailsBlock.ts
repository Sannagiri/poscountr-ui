import { LINE_MM, stateLabel } from '../pdfPrimitives';
import type { A4DocType, BlockRenderer } from './types';

/** `invoicePdf.ts`/`quotationPdf.ts`/`purchaseOrderPdf.ts`'s own three headings for the "who it's for" block. */
const PARTY_HEADINGS: Record<A4DocType, string> = {
  invoice: 'Bill To',
  quotation: 'Quoted to',
  purchase_order: 'Supplier',
};

/**
 * The "who it's for" block — customer (invoice/quotation) or supplier
 * (purchase order). The heading branches on `ctx.docType`; everything else
 * reads off the generic `ctx.party` fields, so this one renderer covers all
 * three documents without knowing which one it is beyond the heading text.
 */
export const partyDetailsBlock: BlockRenderer = (doc, at, ctx, fontSizePt) => {
  const party = ctx.party;
  let y = at.y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.text(PARTY_HEADINGS[ctx.docType], at.x, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  doc.text(party.name, at.x, y);
  y += LINE_MM;
  if (party.phone) {
    doc.text(`Phone: ${party.phone}`, at.x, y);
    y += LINE_MM;
  }
  if (party.email) {
    doc.text(`Email: ${party.email}`, at.x, y);
    y += LINE_MM;
  }
  if (party.gstin) {
    doc.text(`GSTIN: ${party.gstin}`, at.x, y);
    y += LINE_MM;
  }
  if (party.state) {
    doc.text(`State: ${stateLabel(party.state)}`, at.x, y);
    y += LINE_MM;
  }
  for (const addressLine of party.addressLines ?? []) {
    for (const line of doc.splitTextToSize(addressLine, at.width) as string[]) {
      doc.text(line, at.x, y);
      y += LINE_MM;
    }
  }

  return y;
};
