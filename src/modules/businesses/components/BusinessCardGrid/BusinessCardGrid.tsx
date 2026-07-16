import { Button, EmptyState, ErrorMessage, Loader } from '@/components';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';

import type { BusinessEntity } from '../../types/businesses.types';
import { BusinessCard } from './BusinessCard';

export interface BusinessCardGridProps {
  businesses: BusinessEntity[];
  /** businessId → count of that business's locations (from the page's already-fetched flat locations list). */
  locationCountsByBusinessId: Map<string, number>;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onEdit: (business: BusinessEntity) => void;
  onManageLocations: (business: BusinessEntity) => void;
  onToggleStatus: (business: BusinessEntity) => void;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 24;

/**
 * `TenantCardGrid`'s layout, reused for businesses instead of tenants — same
 * responsive column count and the same incremental `useInfiniteReveal`
 * reveal, so every "manage a list of things" screen in the app behaves and
 * looks the same.
 */
export function BusinessCardGrid({
  businesses,
  locationCountsByBusinessId,
  isLoading = false,
  errorMessage = null,
  onRetry,
  emptyTitle = 'No businesses yet',
  emptyDescription,
  hasActiveFilters = false,
  onClearFilters,
  onEdit,
  onManageLocations,
  onToggleStatus,
  batchSize = DEFAULT_BATCH_SIZE,
}: BusinessCardGridProps) {
  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: businesses.length,
    batchSize,
    resetKey: businesses.length,
  });
  const renderedBusinesses = businesses.slice(0, visibleCount);

  if (isLoading) {
    return <Loader label="Loading businesses…" />;
  }

  if (errorMessage) {
    return <ErrorMessage message={errorMessage} onRetry={onRetry} />;
  }

  if (businesses.length === 0) {
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
        {renderedBusinesses.map((business) => (
          <BusinessCard
            key={business.id}
            business={business}
            locationCount={locationCountsByBusinessId.get(business.id) ?? 0}
            onEdit={onEdit}
            onManageLocations={onManageLocations}
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
