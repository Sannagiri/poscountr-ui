import { X } from 'lucide-react';

import { cn } from '@/utils/cn';

import { BLOCK_TYPE_META, SLOT_META } from '../../constants/blockTypeMeta';
import type { LayoutConfig, SlotKey } from '../../types/documentLayouts.types';
import type { LayoutDragData, LayoutDropData } from './dragTypes';

import { useDraggable, useDroppable } from '@dnd-kit/core';

export interface SlotCellProps {
  slotKey: SlotKey;
  slot: LayoutConfig['slots'][SlotKey];
  selected: boolean;
  onSelect: (slotKey: SlotKey) => void;
  /** Clears this slot back to `empty` directly — the hover/selected delete icon's action, replacing the old "pick Empty from the block dropdown" flow. */
  onClear: (slotKey: SlotKey) => void;
  /** `title_row` spans the full width of its own zone row (it's the only single-slot zone) — every other slot shares its row with a sibling. */
  fullWidth?: boolean;
  /** A `"50%"`-style badge reflecting this footer slot's current auto-computed render width (see `buildDocumentPdf.ts`'s footer fill-count distribution) — `undefined` for non-footer slots, which never auto-size. */
  widthHint?: string;
}

/**
 * One of the 9 generic slots — always a `useDroppable` target (any
 * `BlockPaletteItem` or another `SlotCell` can be dropped here); also a
 * `useDraggable` source itself whenever it's already holding a non-`empty`
 * block, so dragging one filled slot onto another swaps their two blocks
 * (`LayoutGrid.handleDragEnd`'s `source: 'slot'` branch) — the literal
 * "drag PO details into the supplier slot instead" interaction the plan
 * calls out. An `empty` slot is drop-only (nothing to drag out of it).
 *
 * A filled slot also shows a small delete (X) icon in its corner on
 * hover/focus/selection — clicking it clears the slot to `empty` directly,
 * replacing the old "pick Empty from the block dropdown" flow.
 */
export function SlotCell({
  slotKey,
  slot,
  selected,
  onSelect,
  onClear,
  fullWidth,
  widthHint,
}: SlotCellProps) {
  const block = slot?.block ?? 'empty';
  const isEmpty = block === 'empty';
  const meta = BLOCK_TYPE_META[block];
  const Icon = meta.icon;

  const dropData: LayoutDropData = { slotKey };
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-drop:${slotKey}`,
    data: dropData,
  });

  const dragData: LayoutDragData = { source: 'slot', slotKey, blockType: block };
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: `slot-drag:${slotKey}`, data: dragData, disabled: isEmpty });

  function setRefs(node: HTMLElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  return (
    <div className={cn('group relative', fullWidth ? 'w-full' : 'flex-1')}>
      <button
        type="button"
        ref={setRefs}
        {...(isEmpty ? {} : listeners)}
        {...(isEmpty ? {} : attributes)}
        onClick={() => onSelect(slotKey)}
        style={
          transform
            ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
            : undefined
        }
        className={cn(
          'flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 rounded-control border-2 border-dashed px-2 py-2 text-center transition-colors',
          isEmpty
            ? 'border-border bg-surface/50 text-ink-faint hover:border-border-strong'
            : 'cursor-grab border-solid border-border-strong bg-white text-ink shadow-sm active:cursor-grabbing',
          isOver && 'border-brand bg-brand/5',
          selected && 'outline outline-2 outline-offset-1 outline-brand',
          isDragging && 'relative opacity-40',
        )}
      >
        <Icon size={15} className={isEmpty ? 'text-ink-faint' : 'text-brand'} aria-hidden="true" />
        <span className="text-[10px] font-semibold leading-tight">{meta.label}</span>
        <span className="text-[9px] leading-tight text-ink-faint">{SLOT_META[slotKey].label}</span>
      </button>

      {widthHint ? (
        <span className="pointer-events-none absolute -top-2 left-1.5 rounded-full border border-border bg-white px-1.5 py-0.5 text-[9px] font-semibold text-ink-soft shadow-sm">
          {widthHint}
        </span>
      ) : null}

      {!isEmpty ? (
        <button
          type="button"
          aria-label={`Clear ${SLOT_META[slotKey].label}`}
          onClick={(event) => {
            event.stopPropagation();
            onClear(slotKey);
          }}
          className={cn(
            'absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-ink-faint shadow-sm transition-opacity',
            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
            'hover:border-danger hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            selected && 'opacity-100',
          )}
        >
          <X size={11} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
