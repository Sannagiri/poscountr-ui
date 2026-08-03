import type { jsPDF } from 'jspdf';

import type { RenderContext } from './blockRenderers/types';
import {
  type Align,
  amountInWords,
  CONTENT_WIDTH_MM,
  drawRow,
  LINE_MM,
  MARGIN_MM,
  money,
  PAGE_HEIGHT_MM,
  RIGHT_EDGE_MM,
  TABLE_ROW_MM,
} from './pdfPrimitives';

/**
 * The item table (paginating) + totals/tax-summary/amount-in-words below
 * it — the plan's "static zone" (`.claude/plans/twinkling-strolling-pearl.md`
 * §Architecture): always rendered from real transactional data, never a
 * slot, not user-arranged. Consolidates `buildItemColumns`/`drawTableHeader`/
 * `newPage`/`totalLine` from all three original `build<X>Pdf` files, minus
 * each one's own doc-specific column set (that's supplied by the caller via
 * `RenderContext.buildItemColumns` instead of being hardcoded here).
 *
 * v2 schema: `table.color_theme` now means real zebra striping (a solid-
 * filled header row + alternating body-row background fills), not just a
 * border/text-color accent, and the whole table's base font size follows
 * `LayoutConfig.font_size_pt` (default 8, matching `DEFAULT_FONT_SIZE_PT` in
 * `constants/documentLayouts.constants.ts` — not imported directly here to
 * avoid a `pdf/` <-> `constants/` <-> `types/` import cycle, since
 * `documentLayouts.constants.ts` itself re-exports types that originate in
 * this module's own sibling `buildDocumentPdf.ts`).
 */

export interface ItemColumns<TItem> {
  headers: string[];
  aligns: Align[];
  widths: number[];
  nameColumnIndex: number;
  cellsFor: (item: TItem, index: number) => string[];
}

/** Mirrors `constants/documentLayouts.constants.ts`'s `DEFAULT_FONT_SIZE_PT` — see this file's own doc comment for why it isn't imported directly. */
const DEFAULT_FONT_SIZE_PT = 8;

/**
 * Per-theme fill/text colors for real zebra striping — a solid header-row
 * fill (`headerFill`, with `headerText` chosen for contrast against it),
 * then body rows alternate white / `rowTint` (a light tint of the same
 * theme color). `mono`'s gray gets the same treatment as every other theme
 * now (v2 dropped the old "mono = plain gray rule, no fill" special case —
 * that was v1's reproduction of the pre-layout-builder hardcoded output;
 * v2's whole point is that every theme, including mono, gets real zebra
 * fills). `rule` still draws the thin top/bottom content rules.
 *
 * `none` (v3) is the one deliberate exception — an all-white `headerFill`/
 * `rowTint` for a business that wants a plain black-on-white table with no
 * color at all, still drawn through the exact same fill-rect calls as every
 * other theme (nothing paints, since the fill color matches the page
 * background) rather than a separate "skip the fill" code path.
 */
const TABLE_COLOR_THEMES: Record<
  string,
  {
    headerFill: [number, number, number];
    headerText: [number, number, number];
    rowTint: [number, number, number];
    rule: [number, number, number];
  }
> = {
  // `headerFill`/`rowTint` are plain white — same as the page background —
  // so the existing fill-rect draw calls below run unchanged but paint
  // nothing visible; no separate "skip the fill" branch needed. Black
  // header text + a light gray rule keep the table's structure legible
  // without any actual color.
  none: {
    headerFill: [255, 255, 255],
    headerText: [0, 0, 0],
    rowTint: [255, 255, 255],
    rule: [200, 200, 200],
  },
  mono: {
    headerFill: [130, 130, 130],
    headerText: [255, 255, 255],
    rowTint: [237, 237, 237],
    rule: [160, 160, 160],
  },
  slate: {
    headerFill: [71, 85, 105],
    headerText: [255, 255, 255],
    rowTint: [241, 245, 249],
    rule: [100, 116, 139],
  },
  blue: {
    headerFill: [37, 99, 235],
    headerText: [255, 255, 255],
    rowTint: [219, 234, 254],
    rule: [59, 130, 246],
  },
  green: {
    headerFill: [22, 163, 74],
    headerText: [255, 255, 255],
    rowTint: [220, 252, 231],
    rule: [34, 197, 94],
  },
  amber: {
    headerFill: [180, 100, 5],
    headerText: [255, 255, 255],
    rowTint: [254, 243, 199],
    rule: [217, 119, 6],
  },
};

function resolveTheme(colorTheme: string) {
  return TABLE_COLOR_THEMES[colorTheme] ?? TABLE_COLOR_THEMES.mono;
}

/** How far above a row's text baseline its background fill rect starts — tuned for the table's own font sizes, not exact ascent metrics (jsPDF doesn't expose per-font metrics cheaply). */
const FILL_TOP_OFFSET_MM = 4.3;

/**
 * Draws the paginating item table starting at `startY`, then the totals
 * summary immediately below it, and returns the final cursor `y`. Doc-type
 * agnostic: everything doc-specific (columns, tax split shape) comes off
 * `ctx`. `fontSizePt` (`LayoutConfig.font_size_pt`) is used *literally* —
 * table body/header text, the totals block's label/value text, and the
 * "Amount in words" line all render at exactly `fontSizePt`, not a scaled
 * derivative — v3 dropped the old "totals 1.5pt bigger, words line 1pt
 * smaller" proportional offsets specifically because a business comparing
 * the table against the totals/words text right below it could see they
 * didn't match "the setting". The totals block's bold `Total` line and the
 * italicized "Amount in words" line still read as visually distinct from
 * the rest via weight/style, not size. Every other block renderer
 * (`blockRenderers/*.ts`) does the same — `fontSizePt` directly, no
 * `scaleFontSize` — except `titleBlock.ts`'s big document title, which
 * stays its own deliberately-larger scaled size.
 *
 * `topReserveMm` (v3): extra top margin every *continuation* page (one
 * forced by pagination, not the first page) leaves below `MARGIN_MM` before
 * drawing its own table header — `buildDocumentPdf.ts` passes
 * `logoZoneHeightMm(config.header, ...) + 6` here so the Logo zone's
 * per-page running header (drawn in its own second pass, after every page
 * already exists) never lands on top of a continuation page's table header
 * row. `0` (the default) reproduces the pre-v3 behavior for a layout with
 * no logo/a disabled Logo zone.
 *
 * `bottomReserveMm` (v3): extra space reserved above `PAGE_HEIGHT_MM -
 * MARGIN_MM` on *every* page before triggering a page break — `buildDocumentPdf.ts`
 * passes `FOOTER_BAND_HEIGHT_MM` whenever `footer_1..4` has at least one
 * filled slot, since that row is now pinned to a fixed band at the bottom
 * of every page (see that file's own doc comment) rather than wherever the
 * content flow happens to end; without this, table rows/totals text would
 * print straight through the footer band on any page that fills up.
 */
export function drawItemsTableAndTotals<TItem>(
  doc: jsPDF,
  startY: number,
  ctx: RenderContext<TItem>,
  colorTheme: string,
  fontSizePt: number = DEFAULT_FONT_SIZE_PT,
  topReserveMm: number = 0,
  bottomReserveMm: number = 0,
): number {
  const theme = resolveTheme(colorTheme);
  const columns = ctx.buildItemColumns(ctx.items);
  let y = startY;

  const tableFontSize = fontSizePt;
  const totalsFontSize = fontSizePt;
  const wordsFontSize = fontSizePt;

  function setRuleColor() {
    doc.setDrawColor(theme.rule[0], theme.rule[1], theme.rule[2]);
  }

  function drawTableHeader(atY: number): number {
    doc.setFillColor(theme.headerFill[0], theme.headerFill[1], theme.headerFill[2]);
    doc.rect(MARGIN_MM, atY - FILL_TOP_OFFSET_MM, CONTENT_WIDTH_MM, TABLE_ROW_MM, 'F');
    doc.setTextColor(theme.headerText[0], theme.headerText[1], theme.headerText[2]);
    drawRow(doc, atY, columns.headers, columns, true);
    doc.setTextColor(0, 0, 0);
    return atY + TABLE_ROW_MM;
  }

  function newPage(): number {
    doc.addPage();
    return drawTableHeader(MARGIN_MM + 4 + topReserveMm);
  }

  const bottomLimitMm = PAGE_HEIGHT_MM - MARGIN_MM - bottomReserveMm;

  doc.setFontSize(tableFontSize);
  if (y + TABLE_ROW_MM * 2 > bottomLimitMm) {
    y = newPage();
  } else {
    y = drawTableHeader(y);
  }

  // Persists across page breaks (not reset per page) so the stripe pattern
  // stays continuous when an item table spans multiple pages.
  let zebraIndex = 0;

  ctx.items.forEach((item, index) => {
    const cells = columns.cellsFor(item, index);
    const nameLines = doc.splitTextToSize(
      cells[columns.nameColumnIndex],
      columns.widths[columns.nameColumnIndex],
    ) as string[];
    const rowHeight = Math.max(1, nameLines.length) * TABLE_ROW_MM;

    if (y + rowHeight > bottomLimitMm - 4) {
      y = newPage();
      doc.setFontSize(tableFontSize);
    }

    // Odd rows (0-indexed) get the tinted fill; even rows stay plain white
    // (nothing to draw — the page background already is white).
    if (zebraIndex % 2 === 1) {
      doc.setFillColor(theme.rowTint[0], theme.rowTint[1], theme.rowTint[2]);
      doc.rect(MARGIN_MM, y - FILL_TOP_OFFSET_MM, CONTENT_WIDTH_MM, rowHeight, 'F');
    }
    zebraIndex += 1;

    drawRow(
      doc,
      y,
      [
        ...cells.slice(0, columns.nameColumnIndex),
        nameLines[0] ?? cells[columns.nameColumnIndex],
        ...cells.slice(columns.nameColumnIndex + 1),
      ],
      columns,
      false,
    );
    y += TABLE_ROW_MM;
    for (const extra of nameLines.slice(1)) {
      drawRow(
        doc,
        y,
        columns.headers.map((_, i) => (i === columns.nameColumnIndex ? extra : '')),
        columns,
        false,
      );
      y += TABLE_ROW_MM;
    }
  });
  y += 2;
  setRuleColor();
  doc.line(MARGIN_MM, y, RIGHT_EDGE_MM, y);
  doc.setDrawColor(160);
  y += 8;

  // --- Totals ---------------------------------------------------------
  const totals = ctx.totals;
  const taxLineCount = totals.isInterstate
    ? totals.igst !== undefined
      ? 1
      : 0
    : totals.cgst !== undefined || totals.sgst !== undefined
      ? 2
      : 0;
  const extraRowCount = totals.extraRows?.length ?? 0;
  const trailingRowCount = totals.trailingRows?.length ?? 0;
  const hasRoundOff = totals.roundOff !== undefined && Number(totals.roundOff) !== 0;
  const wordsLines = totals.amountInWordsText
    ? (doc.splitTextToSize(totals.amountInWordsText, CONTENT_WIDTH_MM * 0.6) as string[])
    : [];
  const summaryLines =
    1 + taxLineCount + extraRowCount + (hasRoundOff ? 1 : 0) + 1 + trailingRowCount;
  const summaryHeightMm = summaryLines * LINE_MM + wordsLines.length * LINE_MM + 14;
  if (y + summaryHeightMm > bottomLimitMm) {
    doc.addPage();
    y = MARGIN_MM + topReserveMm;
  }

  doc.setFontSize(totalsFontSize);
  function totalLine(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, RIGHT_EDGE_MM - 60, y, { align: 'left' });
    doc.text(value, RIGHT_EDGE_MM, y, { align: 'right' });
    y += bold ? LINE_MM + 1.2 : LINE_MM;
    doc.setFont('helvetica', 'normal');
  }

  totalLine(totals.taxableValueLabel ?? 'Taxable value', money(totals.taxableValue));
  if (totals.isInterstate) {
    if (totals.igst !== undefined) totalLine('IGST', money(totals.igst));
  } else {
    if (totals.cgst !== undefined) totalLine('CGST', money(totals.cgst));
    if (totals.sgst !== undefined) totalLine('SGST', money(totals.sgst));
  }
  for (const row of totals.extraRows ?? []) {
    totalLine(row.label, row.value, row.bold);
  }
  if (hasRoundOff && totals.roundOff !== undefined) {
    totalLine('Round off', money(totals.roundOff));
  }
  totalLine('Total', money(totals.total), true);
  for (const row of totals.trailingRows ?? []) {
    totalLine(row.label, row.value, row.bold);
  }
  y += 2;

  if (totals.amountInWordsText) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(wordsFontSize);
    doc.text('Amount in words:', MARGIN_MM, y);
    y += LINE_MM;
    for (const line of wordsLines) {
      doc.text(line, MARGIN_MM, y);
      y += LINE_MM;
    }
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  return y;
}

/** Re-exported so a future adapter (`invoicePdf.ts`'s thin wrapper) can build `totals.amountInWordsText` without importing `pdfPrimitives.ts` directly. */
export { amountInWords };
