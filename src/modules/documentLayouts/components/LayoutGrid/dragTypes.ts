import type { BlockType, SlotKey } from '../../types/documentLayouts.types';

/**
 * `active.data.current`'s shape for every draggable `LayoutGrid` renders —
 * either a fresh palette entry, or an already-placed slot (dragged again to
 * swap with another slot). `LayoutGrid.handleDragEnd` branches on `source`.
 */
export type LayoutDragData =
  | { source: 'palette'; blockType: BlockType }
  | { source: 'slot'; slotKey: SlotKey; blockType: BlockType };

/** `over.data.current`'s shape for every `SlotCell` droppable. */
export interface LayoutDropData {
  slotKey: SlotKey;
}
