import { LINE_MM, TABLE_ROW_MM, wrapMultilineText } from '../pdfPrimitives';
import type { BlockRenderer, NotesTermsMode, NotesTermsRow } from './types';

const TABLE_ROW_COUNTS: Record<string, number> = {
  table_2row: 2,
  table_3row: 3,
  table_4row: 4,
};

/**
 * `NOTES_TERMS` — one of the 8 remaining draggable blocks, still usable in
 * any of the 9 generic slots (most commonly a `footer_1..4` placeholder).
 * `'plain_text'` mode (this block's default) renders `props.text` — free
 * text authored per-slot in the layout itself, same "authored in the layout,
 * not pulled from per-document settings" rule `header_notes`/`footer_notes`
 * follow (v2 schema dropped `RenderContext.footerNote`, which this block
 * used to read instead). The `table_2row`/`table_3row`/`table_4row` modes
 * render `props.rows` (`{label, value}[]`) padded/truncated to the mode's
 * row count as a small two-column label/value table.
 */
export const notesTermsBlock: BlockRenderer = (doc, at, _ctx, fontSizePt) => {
  const mode = (at.props.mode as NotesTermsMode | undefined) ?? 'plain_text';
  if (mode === 'none') return at.y;

  let y = at.y;

  if (mode === 'plain_text') {
    const text = typeof at.props.text === 'string' ? at.props.text : '';
    if (!text) return y;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSizePt);
    // `wrapMultilineText`, not a bare `doc.splitTextToSize` pass — the
    // Properties panel's textarea lets a business type real line breaks
    // (e.g. one term per line), which a single splitTextToSize call would
    // silently collapse.
    for (const line of wrapMultilineText(doc, text, at.width)) {
      doc.text(line, at.x, y);
      y += LINE_MM;
    }
    y += 4;
    return y;
  }

  const rowCount = TABLE_ROW_COUNTS[mode] ?? 0;
  if (rowCount === 0) return y;

  const configuredRows = (at.props.rows as NotesTermsRow[] | undefined) ?? [];
  const rows: NotesTermsRow[] = Array.from(
    { length: rowCount },
    (_, i) => configuredRows[i] ?? { label: '', value: '' },
  );

  const labelWidth = Math.min(45, at.width * 0.35);
  doc.setDrawColor(160);
  doc.line(at.x, y, at.x + at.width, y);
  y += 2;

  doc.setFontSize(fontSizePt);
  for (const row of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(row.label, at.x, y);
    doc.setFont('helvetica', 'normal');
    for (const line of doc.splitTextToSize(row.value, at.width - labelWidth) as string[]) {
      doc.text(line, at.x + labelWidth, y);
      y += TABLE_ROW_MM;
    }
    if (!row.value) y += TABLE_ROW_MM;
  }
  doc.line(at.x, y, at.x + at.width, y);
  y += 4;

  return y;
};
