import type { jsPDF } from 'jspdf';

import {
  fitLogoToTier,
  type LoadedLogo,
  MARGIN_MM,
  PAGE_WIDTH_MM,
  RIGHT_EDGE_MM,
} from '../pdfPrimitives';
import type { HeaderZoneConfig } from './types';

/**
 * The Logo zone (v3 schema) — not a `BlockRenderer` (it's a dedicated
 * `LayoutConfig.header` key, not a draggable palette entry; `header_left`/
 * `header_right` no longer exist), and unlike every other zone this module
 * draws, it **repeats on every page** of a multi-page document, like a
 * running page header. `buildDocumentPdf.ts`'s second pass calls this once
 * per page via `doc.setPage(i)` — the identical technique `pageMetaBlock.ts`
 * already used for "Page X of Y" (total page count isn't known until every
 * page exists, so neither can be drawn correctly on a first pass).
 *
 * The already-decoded `logo` (`decodeLogo` always rasterizes at the `large`
 * tier's box for print quality, regardless of the configured display size)
 * is re-fit into whichever tier `header.size` currently picks via
 * `fitLogoToTier`, at draw time — see that function's own doc comment for
 * why (in short: no re-decode needed just to change size, so the layout
 * editor's live preview responds to the Size selector instantly).
 */
export function drawLogoZone(doc: jsPDF, header: HeaderZoneConfig, logo: LoadedLogo | null): void {
  if (!header.enabled || !logo) return;

  const { widthMm, heightMm } = fitLogoToTier(logo.widthMm, logo.heightMm, header.size);
  const x =
    header.position === 'right'
      ? RIGHT_EDGE_MM - widthMm
      : header.position === 'center'
        ? (PAGE_WIDTH_MM - widthMm) / 2
        : MARGIN_MM;

  doc.addImage(logo.dataUrl, 'PNG', x, MARGIN_MM, widthMm, heightMm);
}

/**
 * How much vertical space the Logo zone's own band reserves before whatever
 * renders below it (`title_row`, then Business Details) in the normal flow
 * — `0` when disabled or there's no logo to show, so a business with no
 * logo yet loses no space to an empty band. Also reused as the extra top
 * margin `tableRenderer.ts` reserves on a paginated item table's
 * continuation pages, since the Logo zone would otherwise redraw on top of
 * a fresh page's table header.
 */
export function logoZoneHeightMm(header: HeaderZoneConfig, logo: LoadedLogo | null): number {
  if (!header.enabled || !logo) return 0;
  return fitLogoToTier(logo.widthMm, logo.heightMm, header.size).heightMm;
}
