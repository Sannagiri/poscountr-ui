import { cn } from '@/utils/cn';

import { BLOCK_TYPE_META } from '../../constants/blockTypeMeta';
import type { BlockType } from '../../types/documentLayouts.types';
import type { LayoutDragData } from './dragTypes';

import { useDraggable } from '@dnd-kit/core';

export interface BlockPaletteItemProps {
  blockType: BlockType;
}

/** One draggable palette entry — dropping it on a `SlotCell` assigns that block type to the slot (fresh, no `props`). */
export function BlockPaletteItem({ blockType }: BlockPaletteItemProps) {
  const meta = BLOCK_TYPE_META[blockType];
  const Icon = meta.icon;
  const data: LayoutDragData = { source: 'palette', blockType };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${blockType}`,
    data,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 }
          : undefined
      }
      className={cn(
        'flex cursor-grab items-center gap-1.5 whitespace-nowrap rounded-control border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors',
        'hover:border-border-strong active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        isDragging && 'relative opacity-40',
      )}
    >
      <Icon size={14} className="shrink-0 text-brand" aria-hidden="true" />
      {meta.label}
    </button>
  );
}
