import type { ChangeEvent } from 'react';

import { Card, CardHeader, Input, Select, Switch } from '@/components';

import { BLOCK_TYPE_META, SLOT_META } from '../../constants/blockTypeMeta';
import {
  BLOCK_TYPES,
  FONT_SIZE_PT_MAX,
  FONT_SIZE_PT_MIN,
} from '../../constants/documentLayouts.constants';
import type {
  BlockType,
  LayoutConfig,
  NotesTermsMode,
  NotesTermsRow,
  SlotKey,
} from '../../types/documentLayouts.types';
import { ColorSwatchPicker } from '../ColorSwatchPicker';

export interface LayoutConfigPanelProps {
  config: LayoutConfig;
  onConfigChange: (config: LayoutConfig) => void;
  selectedSlot: SlotKey | null;
}

const BLOCK_OPTIONS = BLOCK_TYPES.map((blockType) => ({
  value: blockType,
  label: BLOCK_TYPE_META[blockType].label,
}));

const NOTES_TERMS_MODE_OPTIONS: { value: NotesTermsMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'plain_text', label: 'Plain text' },
  { value: 'table_2row', label: 'Table (2 rows)' },
  { value: 'table_3row', label: 'Table (3 rows)' },
  { value: 'table_4row', label: 'Table (4 rows)' },
];

const NOTES_TERMS_ROW_COUNTS: Partial<Record<NotesTermsMode, number>> = {
  table_2row: 2,
  table_3row: 3,
  table_4row: 4,
};

/**
 * The editor's left sidebar: Table Style (color theme, document-wide) +
 * Font Size (document-wide, `LayoutConfig.font_size_pt`) always visible,
 * plus — whenever `selectedSlot` is set — that slot's own block picker and
 * block-specific "Properties". Only `notes_terms`/`page_meta` get extra
 * props controls; every other block type (logo, business/party details,
 * document meta, title, empty) has nothing to configure. `header_notes`/
 * `footer_notes`/`payment_details`/`signature` are no longer slot-driven at
 * all (v2 schema) — they're edited inline in `LayoutGrid`'s canvas instead,
 * so they never appear here.
 */
export function LayoutConfigPanel({
  config,
  onConfigChange,
  selectedSlot,
}: LayoutConfigPanelProps) {
  function setSlotBlock(block: BlockType) {
    if (!selectedSlot) return;
    onConfigChange({ ...config, slots: { ...config.slots, [selectedSlot]: { block } } });
  }

  function setSlotProps(props: Record<string, unknown>) {
    if (!selectedSlot) return;
    const current = config.slots[selectedSlot] ?? { block: 'empty' as BlockType };
    onConfigChange({
      ...config,
      slots: {
        ...config.slots,
        [selectedSlot]: { ...current, props: { ...current.props, ...props } },
      },
    });
  }

  function handleFontSizeChange(event: ChangeEvent<HTMLInputElement>) {
    const parsed = Number(event.target.value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(FONT_SIZE_PT_MAX, Math.max(FONT_SIZE_PT_MIN, parsed));
    onConfigChange({ ...config, font_size_pt: clamped });
  }

  const slotConfig = selectedSlot ? config.slots[selectedSlot] : undefined;
  const block = slotConfig?.block ?? 'empty';
  const blockProps = slotConfig?.props ?? {};

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardHeader title="Table style" subtitle="Item table header + zebra-stripe color" />
        <ColorSwatchPicker
          value={config.table.color_theme}
          onChange={(theme) => onConfigChange({ ...config, table: { color_theme: theme } })}
        />
      </Card>

      <Card>
        <CardHeader title="Font size" subtitle="Base size for the item table + totals text" />
        <Input
          type="number"
          min={FONT_SIZE_PT_MIN}
          max={FONT_SIZE_PT_MAX}
          value={config.font_size_pt}
          onChange={handleFontSizeChange}
          hint={`${FONT_SIZE_PT_MIN}–${FONT_SIZE_PT_MAX}pt`}
        />
      </Card>

      <Card>
        <CardHeader
          title="Properties"
          subtitle={selectedSlot ? SLOT_META[selectedSlot].label : 'Select a slot in the canvas'}
        />
        {selectedSlot ? (
          <div className="flex flex-col gap-4">
            <Select
              label="Block"
              value={block}
              onChange={(value) => setSlotBlock(value as BlockType)}
              options={BLOCK_OPTIONS}
            />
            <BlockPropsEditor block={block} props={blockProps} onChange={setSlotProps} />
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            Select a slot in the canvas to configure its block.
          </p>
        )}
      </Card>
    </div>
  );
}

function BlockPropsEditor({
  block,
  props,
  onChange,
}: {
  block: BlockType;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
}) {
  if (block === 'notes_terms') return <NotesTermsPropsEditor props={props} onChange={onChange} />;
  if (block === 'page_meta') return <PageMetaPropsEditor props={props} onChange={onChange} />;
  return <p className="text-xs text-ink-faint">No additional options for this block.</p>;
}

/**
 * Mode select + either a free-text box (`plain_text`) or a fixed-length
 * label/value rows editor (the three table modes) — mirrors
 * `notesTermsBlock.ts`'s own `TABLE_ROW_COUNTS`. `plain_text`'s text is
 * `props.text`, authored per-slot here — v2 dropped the old
 * `RenderContext.footerNote` this mode used to read, since all free text is
 * now authored directly in the layout, not pulled from per-document
 * settings. Plain `useState`-free direct prop mutation (every keystroke
 * calls `onChange` -> `LayoutEditorPage`'s in-memory `config` state, nothing
 * hits the network until the page's own "Save" button) rather than
 * react-hook-form field arrays — simplest option for a fixed 2-4 row list
 * that never needs add/remove/reorder.
 */
function NotesTermsPropsEditor({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const mode = (props.mode as NotesTermsMode | undefined) ?? 'plain_text';
  const text = (props.text as string | undefined) ?? '';
  const rows = (props.rows as NotesTermsRow[] | undefined) ?? [];
  const rowCount = NOTES_TERMS_ROW_COUNTS[mode] ?? 0;

  function setRowField(index: number, field: keyof NotesTermsRow, fieldValue: string) {
    const nextRows: NotesTermsRow[] = Array.from(
      { length: rowCount },
      (_, i) => rows[i] ?? { label: '', value: '' },
    );
    nextRows[index] = { ...nextRows[index], [field]: fieldValue };
    onChange({ mode, rows: nextRows });
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Mode"
        value={mode}
        onChange={(value) => onChange({ mode: value as NotesTermsMode })}
        options={NOTES_TERMS_MODE_OPTIONS}
      />
      {mode === 'plain_text' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes-terms-text" className="text-xs font-semibold text-ink-soft">
            Text
          </label>
          <textarea
            id="notes-terms-text"
            rows={4}
            value={text}
            onChange={(event) => onChange({ mode, text: event.target.value })}
            placeholder="Terms, thank-you note, etc. — line breaks are preserved."
            className="w-full rounded-control border border-border bg-white px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
      ) : null}
      {rowCount > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-soft">Rows</span>
          {Array.from({ length: rowCount }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed-length by mode, rows never reorder/insert/remove
            <div key={index} className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Label"
                value={rows[index]?.label ?? ''}
                onChange={(event) => setRowField(index, 'label', event.target.value)}
              />
              <Input
                placeholder="Value"
                value={rows[index]?.value ?? ''}
                onChange={(event) => setRowField(index, 'value', event.target.value)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PageMetaPropsEditor({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const showPageNumber = props.show_page_number === true;
  const showDate = props.show_date === true;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface/60 p-3">
        <span className="text-sm font-medium text-ink">Show page number</span>
        <Switch
          checked={showPageNumber}
          onCheckedChange={(checked) => onChange({ show_page_number: checked })}
          label="Show page number"
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface/60 p-3">
        <span className="text-sm font-medium text-ink">Show date</span>
        <Switch
          checked={showDate}
          onCheckedChange={(checked) => onChange({ show_date: checked })}
          label="Show date"
        />
      </div>
    </div>
  );
}
