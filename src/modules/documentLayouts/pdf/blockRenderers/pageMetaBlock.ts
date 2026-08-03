import type { Align } from '../pdfPrimitives';
import { formatDate } from '../pdfPrimitives';
import type { BlockRenderer } from './types';

/**
 * "Page X of Y" and/or today's date — brand-new content, no precedent in
 * any original file (none of the three render page numbers or a generation
 * date today). Gated by `at.props.show_page_number`/`at.props.show_date`
 * (both default `false`, so a slot assigned `'page_meta'` with no props
 * renders nothing).
 *
 * Total page count isn't known until the whole document has been drawn, so
 * `buildDocumentPdf.ts` calls this block in a **second pass** after the
 * first full draw: `doc.setPage(i)` for each page `i`, then this block
 * again at the same slot coordinates. `doc.getCurrentPageInfo()` reflects
 * whichever page `setPage` last selected, and `doc.getNumberOfPages()` is
 * only accurate once every page already exists — both true by the time
 * this second pass runs.
 */
export const pageMetaBlock: BlockRenderer = (doc, at, ctx, fontSizePt) => {
  const showPageNumber = at.props.show_page_number === true;
  const showDate = at.props.show_date === true;
  if (!showPageNumber && !showDate) return at.y;

  const parts: string[] = [];
  if (showPageNumber) {
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const totalPages = doc.getNumberOfPages();
    parts.push(`Page ${pageNumber} of ${totalPages}`);
  }
  if (showDate) {
    parts.push(formatDate(new Date().toISOString()));
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  doc.text(parts.join('  |  '), at.x, at.y, { align: at.align as Align });

  // Reference `ctx` to keep the `BlockRenderer` signature honest even though this block needs none of it.
  void ctx;

  return at.y;
};
