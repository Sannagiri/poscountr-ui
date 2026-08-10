import { FileText } from 'lucide-react';

import { Badge, Button, EmptyState, ErrorMessage, Loader } from '@/components';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { formatTimestamp } from '@/utils/date';
import { statusLabel, toneForStatus } from '@/utils/status';
import { categoricalColorAt, colors } from '@/styles/colors';

import type { PurchaseOrder, PurchaseOrderStatus } from '../../types/purchasing.types';

/** Same "thin left-edge accent per status" idea as `OrderListCards`'s own `STATUS_ACCENT_HEX`. */
const STATUS_ACCENT_HEX: Record<PurchaseOrderStatus, string> = {
  pending: colors.warning.DEFAULT,
  completed: colors.success.DEFAULT,
  cancelled: colors.danger.DEFAULT,
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

// Deterministic per-purchase-order hue so the same row keeps the same avatar
// color across re-renders/re-sorts, same trick `OrderListCards` uses.
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return categoricalColorAt(Math.abs(hash));
}

export interface PurchaseOrderListCardsProps {
  purchaseOrders: PurchaseOrder[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onRowClick: (purchaseOrder: PurchaseOrder) => void;
  onPreview: (purchaseOrder: PurchaseOrder) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  isFilteredEmpty?: boolean;
  onClearFilters?: () => void;
  batchSize?: number;
}

/**
 * Compact, colorful list row for Purchase Orders — same "modern list" shape
 * `OrderListCards` established for Orders, adapted for a purchase order's own
 * fields (supplier instead of customer, payment status instead of order
 * type, one document/preview button instead of two).
 */
export function PurchaseOrderListCards({
  purchaseOrders,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onRowClick,
  onPreview,
  emptyTitle = 'No purchase orders yet',
  emptyDescription,
  isFilteredEmpty = false,
  onClearFilters,
  batchSize = 30,
}: PurchaseOrderListCardsProps) {
  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: purchaseOrders.length,
    batchSize,
    resetKey: purchaseOrders.length,
  });

  if (isLoading) return <Loader label="Loading…" />;
  if (errorMessage) return <ErrorMessage message={errorMessage} onRetry={onRetry} />;

  if (purchaseOrders.length === 0) {
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

  const visiblePurchaseOrders = purchaseOrders.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-1.5">
      {visiblePurchaseOrders.map((purchaseOrder) => (
        <div
          key={purchaseOrder.id}
          role="button"
          tabIndex={0}
          onClick={() => onRowClick(purchaseOrder)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onRowClick(purchaseOrder);
            }
          }}
          className="group flex cursor-pointer items-center gap-2.5 rounded-xl border-b border-l border-border/70 bg-surface-card px-2.5 py-2 shadow-sm transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_ACCENT_HEX[purchaseOrder.status] }}
            aria-hidden="true"
          />
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColorFor(purchaseOrder.id) }}
            aria-hidden="true"
          >
            {initialsFor(purchaseOrder.supplierName)}
          </span>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {purchaseOrder.supplierName}
            </span>
            <span className="block truncate text-[11px] text-ink-faint">
              {purchaseOrder.supplierPhone || '—'}
            </span>
          </div>

          <div className="hidden min-w-0 flex-1 items-baseline justify-center sm:flex">
            <span className="truncate text-[12px] font-medium text-ink">
              {purchaseOrder.purchaseNumber ?? '—'}
            </span>
            {purchaseOrder.paymentStatus ? (
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] text-ink-faint opacity-0 transition-all duration-150 group-focus-within:ml-1 group-focus-within:max-w-[100px] group-focus-within:opacity-100 group-hover:ml-1 group-hover:max-w-[100px] group-hover:opacity-100">
                · {statusLabel(purchaseOrder.paymentStatus)}
              </span>
            ) : null}
          </div>

          <div className="hidden min-w-0 flex-1 items-baseline justify-center md:flex">
            <span className="truncate text-[12px] text-ink">{purchaseOrder.locationName}</span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] text-ink-faint opacity-0 transition-all duration-150 group-focus-within:ml-1 group-focus-within:max-w-[140px] group-focus-within:opacity-100 group-hover:ml-1 group-hover:max-w-[140px] group-hover:opacity-100">
              · {formatTimestamp(purchaseOrder.createdAt)}
            </span>
          </div>

          <Badge
            tone={toneForStatus(purchaseOrder.status)}
            className="hidden shrink-0 sm:inline-flex"
          >
            {statusLabel(purchaseOrder.status)}
          </Badge>

          <span className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">
            ₹{purchaseOrder.total}
          </span>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label="Preview document"
              leadingIcon={<FileText size={14} />}
              onClick={() => onPreview(purchaseOrder)}
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
