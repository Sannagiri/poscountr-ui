import { useEffect, useRef } from 'react';
import { Table2 } from 'lucide-react';

import { Input, Select, Switch } from '@/components';

import { LAYOUT_ZONES } from '../../constants/blockTypeMeta';
import type {
  BusinessDetailsZoneConfig,
  HeaderZoneConfig,
  LayoutConfig,
  PaymentDetailsInclude,
  SlotKey,
} from '../../types/documentLayouts.types';
import { SlotCell } from './SlotCell';

const FOOTER_SLOT_KEYS: SlotKey[] = ['footer_1', 'footer_2', 'footer_3', 'footer_4'];

const PAYMENT_DETAILS_INCLUDE_OPTIONS: { value: PaymentDetailsInclude; label: string }[] = [
  { value: 'all', label: 'All (bank + UPI)' },
  { value: 'bank', label: 'Bank only' },
  { value: 'upi', label: 'UPI only' },
];

const LOGO_POSITION_OPTIONS: { value: HeaderZoneConfig['position']; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const LOGO_SIZE_OPTIONS: { value: HeaderZoneConfig['size']; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export interface LayoutGridProps {
  config: LayoutConfig;
  onConfigChange: (config: LayoutConfig) => void;
  selectedSlot: SlotKey | null;
  onSelectSlot: (slotKey: SlotKey) => void;
  /** Clears the given slot back to `empty` — the delete-icon action on a filled `SlotCell`. */
  onClearSlot: (slotKey: SlotKey) => void;
}

/**
 * The editor's canvas — a simplified CSS-only A4-proportioned mock page,
 * top-to-bottom in the v3 zone order (`.claude/plans/twinkling-strolling-pearl.md`
 * §Architecture revision v3): the Logo zone (enabled + position + size —
 * repeats on every page), the Business Details zone (enabled only, always
 * left-aligned), Title/Party slot rows, the Header Notes text zone, the
 * fixed "Item Table + Totals" placeholder (never a slot, never interactive),
 * the Footer Notes text zone, the Meta Data zone's two cards (Payment
 * Details / Signature), and the `footer_1..4` slot row (also repeats on
 * every page).
 *
 * Drag-and-drop itself (`DndContext`, `useDraggable`/`useDroppable`) lives
 * one level up in `LayoutEditorPage.tsx` now, since the palette moved out to
 * the editor's left sidebar column but still needs to share one `DndContext`
 * with this canvas's `SlotCell`s — `@dnd-kit`'s hooks just need a shared
 * ancestor `DndContext`, not necessarily one this component itself owns.
 */
export function LayoutGrid({
  config,
  onConfigChange,
  selectedSlot,
  onSelectSlot,
  onClearSlot,
}: LayoutGridProps) {
  const slots = config.slots;

  const filledFooterCount = FOOTER_SLOT_KEYS.filter(
    (key) => (slots[key]?.block ?? 'empty') !== 'empty',
  ).length;
  const footerWidthHint =
    filledFooterCount > 0 ? `${Math.round((100 / filledFooterCount) * 10) / 10}%` : undefined;

  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-card">
      <LogoZoneRow
        header={config.header}
        onChange={(header) => onConfigChange({ ...config, header })}
      />
      <BusinessDetailsZoneRow
        zone={config.business_details}
        onChange={(business_details) => onConfigChange({ ...config, business_details })}
      />

      {LAYOUT_ZONES.map((zone) => (
        <ZoneRow
          key={zone.title}
          zone={zone}
          slots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelectSlot}
          onClearSlot={onClearSlot}
        />
      ))}

      <NotesZoneRow
        title="Header Notes"
        hint="Full-width, above the table"
        zone={config.header_notes}
        onChange={(header_notes) => onConfigChange({ ...config, header_notes })}
      />

      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Item table + totals (system-computed)
        </p>
        <div
          className="flex min-h-[64px] items-center justify-center gap-2 rounded-control border-2 border-dashed border-border bg-surface/70 text-ink-faint"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 8px, transparent 8px 16px)',
          }}
        >
          <Table2 size={16} aria-hidden="true" />
          <span className="text-xs font-medium">Always fixed — never draggable</span>
        </div>
      </div>

      <NotesZoneRow
        title="Footer Notes"
        hint="Full-width, below the table"
        zone={config.footer_notes}
        onChange={(footer_notes) => onConfigChange({ ...config, footer_notes })}
      />

      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Meta Data
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-control border border-border bg-surface/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">Payment Details</span>
              <Switch
                size="sm"
                checked={config.payment_details.enabled}
                onCheckedChange={(checked) =>
                  onConfigChange({
                    ...config,
                    payment_details: { ...config.payment_details, enabled: checked },
                  })
                }
                label="Show payment details"
              />
            </div>
            <Select
              value={config.payment_details.include}
              onChange={(value) =>
                onConfigChange({
                  ...config,
                  payment_details: {
                    ...config.payment_details,
                    include: value as PaymentDetailsInclude,
                  },
                })
              }
              options={PAYMENT_DETAILS_INCLUDE_OPTIONS}
              disabled={!config.payment_details.enabled}
            />
          </div>
          <div className="rounded-control border border-border bg-surface/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">Signature</span>
              <Switch
                size="sm"
                checked={config.signature.enabled}
                onCheckedChange={(checked) =>
                  onConfigChange({
                    ...config,
                    signature: { ...config.signature, enabled: checked },
                  })
                }
                label="Show signature"
              />
            </div>
            <Input
              placeholder="Authorized Signatory"
              value={config.signature.label}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  signature: { ...config.signature, label: event.target.value },
                })
              }
              disabled={!config.signature.enabled}
            />
          </div>
        </div>
      </div>

      <div className="mb-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Footer
        </p>
        <div className="flex gap-2">
          {FOOTER_SLOT_KEYS.map((slotKey) => (
            <SlotCell
              key={slotKey}
              slotKey={slotKey}
              slot={slots[slotKey]}
              selected={selectedSlot === slotKey}
              onSelect={onSelectSlot}
              onClear={onClearSlot}
              widthHint={
                (slots[slotKey]?.block ?? 'empty') !== 'empty' ? footerWidthHint : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneRow({
  zone,
  slots,
  selectedSlot,
  onSelectSlot,
  onClearSlot,
}: {
  zone: { title: string; slots: SlotKey[] };
  slots: LayoutConfig['slots'];
  selectedSlot: SlotKey | null;
  onSelectSlot: (slotKey: SlotKey) => void;
  onClearSlot: (slotKey: SlotKey) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {zone.title}
      </p>
      <div className="flex gap-2">
        {zone.slots.map((slotKey) => (
          <SlotCell
            key={slotKey}
            slotKey={slotKey}
            slot={slots[slotKey]}
            selected={selectedSlot === slotKey}
            onSelect={onSelectSlot}
            onClear={onClearSlot}
            fullWidth={zone.slots.length === 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The Logo zone's canvas row (v3) — enabled toggle + position/size selects,
 * presented like the Header Notes/Footer Notes rows below (a dedicated
 * canvas row, not a slot cell) rather than a palette entry, since `logo` is
 * no longer a draggable `BlockType`. Repeats on every page of the rendered
 * document — see `buildDocumentPdf.ts`'s own doc comment.
 */
function LogoZoneRow({
  header,
  onChange,
}: {
  header: HeaderZoneConfig;
  onChange: (header: HeaderZoneConfig) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Logo <span className="normal-case text-ink-faint">— repeats on every page</span>
        </p>
        <Switch
          size="sm"
          checked={header.enabled}
          onCheckedChange={(checked) => onChange({ ...header, enabled: checked })}
          label="Show logo"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={header.position}
          onChange={(value) =>
            onChange({ ...header, position: value as HeaderZoneConfig['position'] })
          }
          options={LOGO_POSITION_OPTIONS}
          disabled={!header.enabled}
        />
        <Select
          value={header.size}
          onChange={(value) => onChange({ ...header, size: value as HeaderZoneConfig['size'] })}
          options={LOGO_SIZE_OPTIONS}
          disabled={!header.enabled}
        />
      </div>
    </div>
  );
}

/**
 * The Business Details zone's canvas row (v3) — enabled toggle only, no
 * position option (always left-aligned, no right-side counterpart, unlike
 * the Logo zone above) — simpler than `LogoZoneRow` on purpose. Renders
 * once, in normal document flow, not repeated per page.
 */
function BusinessDetailsZoneRow({
  zone,
  onChange,
}: {
  zone: BusinessDetailsZoneConfig;
  onChange: (zone: BusinessDetailsZoneConfig) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-control border border-border bg-surface/50 p-3">
      <div>
        <p className="text-xs font-semibold text-ink">Business Details</p>
        <p className="text-[10px] text-ink-faint">One-time, always left-aligned</p>
      </div>
      <Switch
        size="sm"
        checked={zone.enabled}
        onCheckedChange={(checked) => onChange({ enabled: checked })}
        label="Show business details"
      />
    </div>
  );
}

function NotesZoneRow({
  title,
  hint,
  zone,
  onChange,
}: {
  title: string;
  hint: string;
  zone: LayoutConfig['header_notes'];
  onChange: (zone: LayoutConfig['header_notes']) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grows with content instead of a fixed 2-row box that clips longer
  // text behind a scrollbar — a business authoring a multi-line note (e.g.
  // several terms, one per line) should see all of it at once while typing,
  // not just the last-scrolled 2 lines. Re-measures on every keystroke
  // (`zone.text` in the dep array) since `scrollHeight` only reflects the
  // *current* content after the browser has laid it out.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [zone.text]);

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {title} <span className="normal-case text-ink-faint">— {hint}</span>
        </p>
        <Switch
          size="sm"
          checked={zone.enabled}
          onCheckedChange={(checked) => onChange({ ...zone, enabled: checked })}
          label={`Show ${title.toLowerCase()}`}
        />
      </div>
      <textarea
        ref={textareaRef}
        rows={2}
        value={zone.text}
        disabled={!zone.enabled}
        onChange={(event) => onChange({ ...zone, text: event.target.value })}
        placeholder={`${title} text, authored here (not per document)…`}
        className="w-full resize-none overflow-hidden rounded-control border border-border bg-white px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-surface/50 disabled:text-ink-faint"
      />
    </div>
  );
}
