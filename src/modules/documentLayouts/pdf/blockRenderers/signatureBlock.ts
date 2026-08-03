import type { jsPDF } from 'jspdf';

import { LINE_MM, RIGHT_EDGE_MM } from '../pdfPrimitives';
import type { RenderBusiness, SignatureZoneConfig, ZonePosition } from './types';

/**
 * The signature card — the Meta Data zone's right column: `"For
 * {businessName}"`, blank space for a physical signature, then `zone.label`
 * (defaults to "Authorized Signatory" in the builder UI). Renders nothing
 * when disabled.
 *
 * Pre-v2, this block bottom-anchored itself to a fixed page position and
 * appended a centered "computer-generated document" disclaimer below it —
 * both dropped when the Meta Data zone moved mid-flow in v2 (see git
 * history for that reasoning).
 *
 * v3: right-aligned flush with `RIGHT_EDGE_MM` — the same right edge the
 * item table and totals block already right-align against — instead of
 * left-aligned at `at.x` (`RIGHT_COLUMN_X_MM`, ~58% across the page), which
 * left it sitting in an awkward, seemingly-arbitrary position within its own
 * card. `at.x`/`at.width` (still passed by `buildDocumentPdf.ts` for
 * `ZonePosition` shape parity with Payment Details' own card) are
 * unused here as a result — every line anchors to `RIGHT_EDGE_MM` instead.
 */
export function drawSignatureCard(
  doc: jsPDF,
  at: ZonePosition,
  zone: SignatureZoneConfig,
  business: RenderBusiness,
  fontSizePt: number,
): number {
  if (!zone.enabled) return at.y;

  let y = at.y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.text('Signature', RIGHT_EDGE_MM, y, { align: 'right' });
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  doc.text(`For ${business.businessName}`, RIGHT_EDGE_MM, y, { align: 'right' });
  y += LINE_MM * 3;
  doc.text(zone.label || 'Authorized Signatory', RIGHT_EDGE_MM, y, { align: 'right' });
  y += LINE_MM + 2;

  return y;
}
