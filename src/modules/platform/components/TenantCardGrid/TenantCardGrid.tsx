import { Button, EmptyState, ErrorMessage, Loader } from '@/components';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';

import type { Tenant } from '../../types/platform.types';
import { TenantCard } from './TenantCard';

export interface TenantCardGridProps {
  tenants: Tenant[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onEdit: (tenant: Tenant) => void;
  onManageAdmins: (tenant: Tenant) => void;
  onToggleStatus: (tenant: Tenant) => void;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 24;

/**
 * Card-grid alternative to `TenantsPage`'s table view — same underlying
 * (already search/filtered) `tenants` array, laid out as responsive cards
 * instead of table rows: 1 per row on mobile, 2 from `sm`, 3 from `xl`
 * (the person asked for "at least 3 per row depending on screen size"), and
 * a 4th column on very wide screens. Reveals incrementally while scrolling
 * the page, the same `useInfiniteReveal` mechanism `DataTable` uses, so a
 * large tenant list doesn't render hundreds of cards at once.
 */
export function TenantCardGrid({
  tenants,
  isLoading = false,
  errorMessage = null,
  onRetry,
  emptyTitle = 'No businesses yet',
  emptyDescription,
  hasActiveFilters = false,
  onClearFilters,
  onEdit,
  onManageAdmins,
  onToggleStatus,
  batchSize = DEFAULT_BATCH_SIZE,
}: TenantCardGridProps) {
  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: tenants.length,
    batchSize,
    resetKey: tenants.length,
  });
  const renderedTenants = tenants.slice(0, visibleCount);

  if (isLoading) {
    return <Loader label="Loading businesses…" />;
  }

  if (errorMessage) {
    return <ErrorMessage message={errorMessage} onRetry={onRetry} />;
  }

  if (tenants.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? 'No matches' : emptyTitle}
        description={
          hasActiveFilters ? 'Try a different search term or clear the filters.' : emptyDescription
        }
        action={
          hasActiveFilters && onClearFilters ? (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {renderedTenants.map((tenant) => (
          <TenantCard
            key={tenant.id}
            tenant={tenant}
            onEdit={onEdit}
            onManageAdmins={onManageAdmins}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <Loader size="sm" />
        </div>
      ) : null}
    </div>
  );
}
