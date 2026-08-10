import { Eye, MapPin, Printer } from 'lucide-react';

import { Badge, Button, EmptyState, ErrorMessage, Loader } from '@/components';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { formatTimestamp } from '@/utils/date';
import { statusLabel, toneForStatus } from '@/utils/status';
import { categoricalColorAt, colors } from '@/styles/colors';

import { ORDER_TYPE_OPTIONS } from '../../constants/billing.constants';
import type { Order, OrderStatus, OrderType } from '../../types/billing.types';

const ORDER_TYPE_LABELS: Record<OrderType, string> = Object.fromEntries(
  ORDER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OrderType, string>;

// Thin left-edge accent per status — a faster "scan the whole list at a
// glance" signal than reading each row's badge text one at a time.
// `delivered` reuses `ink.faint` (no `ink` slot in the categorical/status
// palette) rather than inventing a new hue for one status.
const STATUS_ACCENT_HEX: Record<OrderStatus, string> = {
  pending: colors.warning.DEFAULT,
  kot_fired: colors.accent.DEFAULT,
  preparing: colors.accent.DEFAULT,
  ready: colors.success.DEFAULT,
  delivered: colors.ink.faint,
  completed: colors.success.DEFAULT,
  cancelled: colors.danger.DEFAULT,
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

// Deterministic per-order hue so the same order keeps the same avatar color
// across re-renders/re-sorts, without needing a row index threaded in.
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return categoricalColorAt(Math.abs(hash));
}

export interface OrderListCardsProps {
  orders: Order[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onRowClick: (order: Order) => void;
  onPreview: (order: Order) => void;
  onPrint: (order: Order) => void;
  printingOrderId: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  isFilteredEmpty?: boolean;
  onClearFilters?: () => void;
  batchSize?: number;
}

/**
 * Compact, "modern list" alternative to `DataTable` for the Orders screen —
 * a trial UI (see `OrdersPage`'s view toggle) sitting alongside the existing
 * table rather than replacing it, so the two can be compared side by side
 * before deciding which one stays.
 */
export function OrderListCards({
  orders,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onRowClick,
  onPreview,
  onPrint,
  printingOrderId,
  emptyTitle = 'No orders yet',
  emptyDescription,
  isFilteredEmpty = false,
  onClearFilters,
  batchSize = 30,
}: OrderListCardsProps) {
  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: orders.length,
    batchSize,
    resetKey: orders.length,
  });

  if (isLoading) return <Loader label="Loading…" />;
  if (errorMessage) return <ErrorMessage message={errorMessage} onRetry={onRetry} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        title={isFilteredEmpty ? 'No matches' : emptyTitle}
        description={
          isFilteredEmpty ? 'Try a different search term or clear the filters.' : emptyDescription
        }
        action={
          isFilteredEmpty && onClearFilters ? (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  const visibleOrders = orders.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-1.5">
      {visibleOrders.map((order) => (
        <div
          key={order.id}
          role="button"
          tabIndex={0}
          onClick={() => onRowClick(order)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onRowClick(order);
            }
          }}
          className="group flex cursor-pointer items-center gap-2.5 rounded-xl border-b border-l border-border/70 bg-surface-card px-2.5 py-2 shadow-sm transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_ACCENT_HEX[order.status] }}
            aria-hidden="true"
          />
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColorFor(order.id) }}
            aria-hidden="true"
          >
            {initialsFor(order.customerName || 'Walk-in')}
          </span>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {order.customerName || 'Walk-in'}
            </span>
            <span className="block truncate text-[11px] text-ink-faint">{order.customerPhone}</span>
          </div>

          <div className="hidden min-w-0 flex-1 items-baseline justify-center sm:flex">
            <span className="truncate text-[12px] font-medium text-ink">
              #{order.orderNumber ?? order.tokenNumber ?? '—'}
            </span>
            {/* Collapsed (zero width) by default — grows open on hover
                instead of reserving a permanent second line. */}
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] text-ink-faint opacity-0 transition-all duration-150 group-focus-within:ml-1 group-focus-within:max-w-[100px] group-focus-within:opacity-100 group-hover:ml-1 group-hover:max-w-[100px] group-hover:opacity-100">
              · {ORDER_TYPE_LABELS[order.orderType]}
            </span>
          </div>

          <div className="hidden min-w-0 flex-1 items-baseline justify-center md:flex">
            <span className="inline-flex max-w-full items-center gap-1 truncate text-[12px] text-ink">
              <MapPin size={11} className="shrink-0 text-ink-faint" />
              <span className="truncate">{order.locationName}</span>
            </span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] text-ink-faint opacity-0 transition-all duration-150 group-focus-within:ml-1 group-focus-within:max-w-[140px] group-focus-within:opacity-100 group-hover:ml-1 group-hover:max-w-[140px] group-hover:opacity-100">
              · {formatTimestamp(order.createdAt)}
            </span>
          </div>

          <Badge tone={toneForStatus(order.status)} className="hidden shrink-0 sm:inline-flex">
            {statusLabel(order.status)}
          </Badge>

          <span className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">
            ₹{order.total}
          </span>

          {/* Only blocks bubbling into the row's own onRowClick — the
              buttons inside are the real interactive elements (same
              pattern as `DataTable`'s row-action cell). */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label="Preview bill"
              leadingIcon={<Eye size={14} />}
              onClick={() => onPreview(order)}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Print bill"
              leadingIcon={<Printer size={14} />}
              isLoading={printingOrderId === order.id}
              onClick={() => onPrint(order)}
            />
          </div>
        </div>
      ))}
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-3">
          <Loader size="sm" />
        </div>
      ) : null}
    </div>
  );
}
