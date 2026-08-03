import type { jsPDF } from 'jspdf';

import { LINE_MM, wrapMultilineText } from '../pdfPrimitives';
import type { NotesZoneConfig, ZonePosition } from './types';

/**
 * Draws one of the v2 schema's two semi-fixed "notes" zones — `header_notes`
 * (full-width, between the party row and the table) and `footer_notes`
 * (full-width, between the table and the Meta Data zone). Both share the
 * exact same `{enabled, text}` shape and rendering (plain wrapped text, same
 * styling convention `notesTermsBlock.ts`'s `plain_text` mode uses), so one
 * function serves both call sites in `buildDocumentPdf.ts` rather than two
 * near-identical files. Not a `BlockRenderer` — these are dedicated
 * `LayoutConfig` keys, not draggable blocks, so `buildDocumentPdf.ts` calls
 * this directly instead of going through `BLOCK_RENDERERS`. Renders nothing
 * (returns `at.y` unchanged) when disabled or empty.
 *
 * Uses `wrapMultilineText` (not a bare `doc.splitTextToSize` pass) so
 * embedded `\n` line breaks the user typed into the zone's textarea render
 * as actual line breaks instead of being collapsed into one wrapped run.
 */
export function drawNotesZone(
  doc: jsPDF,
  at: ZonePosition,
  zone: NotesZoneConfig,
  fontSizePt: number,
): number {
  if (!zone.enabled || !zone.text) return at.y;

  let y = at.y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  for (const line of wrapMultilineText(doc, zone.text, at.width)) {
    doc.text(line, at.x, y);
    y += LINE_MM;
  }
  return y;
}
