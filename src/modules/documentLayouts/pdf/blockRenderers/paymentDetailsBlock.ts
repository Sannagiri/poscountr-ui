import type { jsPDF } from 'jspdf';

import type { PaymentDetail } from '@/modules/paymentDetails';

import { LINE_MM, paymentDetailLines } from '../pdfPrimitives';
import type { PaymentDetailsZoneConfig, ZonePosition } from './types';

/**
 * The bank/UPI details card — the Meta Data zone's left column (v2 schema).
 * `zone.include` (`'all'` default, `'bank'`, or `'upi'`) narrows `details`
 * by `detailType`. Not a `BlockRenderer` — `payment_details` is a dedicated
 * `LayoutConfig` key, not a draggable block, so `buildDocumentPdf.ts` calls
 * this directly instead of going through `BLOCK_RENDERERS`. Renders nothing
 * when disabled or the filtered list is empty — same "omit entirely when
 * nothing is assigned" rule the pre-v2 renderer followed.
 */
export function drawPaymentDetailsCard(
  doc: jsPDF,
  at: ZonePosition,
  zone: PaymentDetailsZoneConfig,
  paymentDetails: PaymentDetail[],
  fontSizePt: number,
): number {
  if (!zone.enabled) return at.y;
  const details =
    zone.include === 'all'
      ? paymentDetails
      : paymentDetails.filter((d) => d.detailType === zone.include);
  if (details.length === 0) return at.y;

  let y = at.y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.text('Payment Details', at.x, y);
  y += 5.5;

  doc.setFontSize(fontSizePt);
  for (const detail of details) {
    const lines = paymentDetailLines(detail);
    lines.forEach((line, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      doc.text(line, at.x, y);
      y += LINE_MM;
    });
    y += 1.5;
  }
  doc.setFont('helvetica', 'normal');
  y += 2;

  return y;
}
