import type { jsPDF } from 'jspdf';

import {
  addressDisplayLines,
  LINE_MM,
  MARGIN_MM,
  RIGHT_EDGE_MM,
  stateLabel,
} from '../pdfPrimitives';
import type { BusinessDetailsZoneConfig, RenderBusiness, ZonePosition } from './types';

/**
 * The seller letterhead — v3 schema: `business_details` is now a dedicated,
 * always-left-aligned zone (`LayoutConfig.business_details`), not a
 * draggable block that could end up in `header_left`/`header_right` (both
 * removed — the Logo zone owns that space now). Not a `BlockRenderer` —
 * `buildDocumentPdf.ts` calls this directly, same as `drawNotesZone`/
 * `drawPaymentDetailsCard`/`drawSignatureCard`. Renders once, in the normal
 * top-to-bottom flow (unlike the Logo zone, which repeats on every page) —
 * business name (bold), then location name/address/phone/GSTIN/state, then
 * a horizontal rule. Renders nothing when disabled.
 */
export function drawBusinessDetailsZone(
  doc: jsPDF,
  at: ZonePosition,
  zone: BusinessDetailsZoneConfig,
  business: RenderBusiness,
  fontSizePt: number,
): number {
  if (!zone.enabled) return at.y;

  let y = at.y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.text(business.businessName, at.x, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  if (business.locationName) {
    doc.text(business.locationName, at.x, y);
    y += LINE_MM;
  }
  for (const addressLine of business.addressLines ?? addressDisplayLines(undefined)) {
    for (const line of doc.splitTextToSize(addressLine, at.width) as string[]) {
      doc.text(line, at.x, y);
      y += LINE_MM;
    }
  }
  if (business.phone) {
    doc.text(`Phone: ${business.phone}`, at.x, y);
    y += LINE_MM;
  }
  if (business.gstin) {
    doc.text(`GSTIN: ${business.gstin}`, at.x, y);
    y += LINE_MM;
  }
  if (business.state) {
    doc.text(`State: ${stateLabel(business.state)}`, at.x, y);
    y += LINE_MM;
  }

  y += 4;
  doc.setDrawColor(160);
  doc.line(MARGIN_MM, y, RIGHT_EDGE_MM, y);
  y += 8;

  return y;
}
