import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/utils/cn';

import type { Table, TableSize } from '../../types/tables.types';

export interface TableLayoutCanvasProps {
  tables: Table[];
  /**
   * `edit` — chips are draggable (`onPositionChange` fires on drag-end) and
   * a plain click opens the edit form (`onTableClick`). `select` — chips
   * are static; a tap always calls `onTableClick`, colored by occupancy.
   */
  mode: 'edit' | 'select';
  onTableClick?: (table: Table) => void;
  onPositionChange?: (tableId: string, posX: number, posY: number) => void;
  className?: string;
}

const SIZE_PX: Record<TableSize, number> = { small: 56, medium: 72, large: 88 };

// A pointer move shorter than this reads as a click/tap, not a drag —
// otherwise every plain click would jitter the position by a pixel or two
// and immediately fire a spurious reposition save.
const DRAG_THRESHOLD_PX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A location's floor plan — free-form canvas, table chips positioned by
 * `posX`/`posY` (0–100% of this box, not pixels, so the layout still makes
 * sense at any canvas size). Dragging is hand-rolled with pointer events
 * rather than a drag-and-drop library — this app already hand-rolls its
 * other custom-interaction components (`DataTable` is a hand-built CSS-grid
 * table, not a table library) and a single free-form canvas doesn't need
 * more than pointer capture + percentage math.
 */
export function TableLayoutCanvas({
  tables,
  mode,
  onTableClick,
  onPositionChange,
  className,
}: TableLayoutCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-[420px] w-full overflow-hidden rounded-control border border-border bg-surface/40',
        className,
      )}
      // A plain inline style, not a Tailwind arbitrary class — `theme()`
      // inside a `bg-[...]` arbitrary value silently fails to resolve a
      // nested color token like `border` (it isn't a flat CSS variable),
      // so the grid never painted. A literal rgba here always renders,
      // and it's purely decorative (a visual reference grid), not a
      // themed color that needs to track dark mode.
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(15, 23, 42, 0.06) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(15, 23, 42, 0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {tables.map((table) => (
        <TableChip
          key={table.id}
          table={table}
          mode={mode}
          containerRef={containerRef}
          onTableClick={onTableClick}
          onPositionChange={onPositionChange}
        />
      ))}
    </div>
  );
}

interface TableChipProps {
  table: Table;
  mode: 'edit' | 'select';
  containerRef: RefObject<HTMLDivElement | null>;
  onTableClick?: (table: Table) => void;
  onPositionChange?: (tableId: string, posX: number, posY: number) => void;
}

function TableChip({ table, mode, containerRef, onTableClick, onPositionChange }: TableChipProps) {
  const [pos, setPos] = useState({ x: table.posX, y: table.posY });
  const dragRef = useRef<{ startClientX: number; startClientY: number; dragging: boolean } | null>(
    null,
  );

  // Follow the server value (e.g. after a select-mode occupancy poll)
  // whenever this chip isn't actively being dragged.
  useEffect(() => {
    if (!dragRef.current) setPos({ x: table.posX, y: table.posY });
  }, [table.posX, table.posY]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startClientX: event.clientX, startClientY: event.clientY, dragging: false };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container || mode !== 'edit') return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.dragging = true;
    const rect = container.getBoundingClientRect();
    setPos({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.dragging && mode === 'edit') {
      onPositionChange?.(table.id, pos.x, pos.y);
    } else {
      onTableClick?.(table);
    }
  }

  const sizePx = SIZE_PX[table.size];
  const occupied = Boolean(table.currentOrder);

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: sizePx, height: sizePx }}
      className={cn(
        'absolute flex -translate-x-1/2 -translate-y-1/2 touch-none select-none flex-col items-center justify-center gap-0.5 border-2 text-center transition-colors',
        table.shape === 'round' ? 'rounded-full' : 'rounded-control',
        mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        occupied
          ? 'border-warning-text bg-warning-bg text-warning-text'
          : 'border-border bg-white text-ink hover:border-brand/40 hover:bg-brand/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
      )}
    >
      <span className="text-xs font-bold leading-none">{table.name}</span>
      <span className="text-[10px] leading-none opacity-80">{table.seats} seats</span>
      {occupied && table.currentOrder ? (
        <span className="text-[10px] font-semibold leading-none">
          {table.currentOrder.orderNumber ?? '—'}
        </span>
      ) : null}
    </button>
  );
}
