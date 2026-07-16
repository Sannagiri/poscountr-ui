import { Button, EmptyState, ErrorMessage, Loader } from '@/components';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';

import type { LicenseType } from '../../types/platform.types';
import { LicenseTypeCard } from './LicenseTypeCard';

export interface LicenseTypeCardGridProps {
  licenseTypes: LicenseType[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onEdit: (licenseType: LicenseType) => void;
  onToggleStatus: (licenseType: LicenseType) => void;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 24;

/**
 * `TenantCardGrid`'s layout, reused for license plans instead of tenants —
 * same responsive column count (1 on mobile, 2 from `sm`, 3 from `xl`, 4 on
 * very wide screens) and the same incremental `useInfiniteReveal` reveal, so
 * both of Platform Console's "manage a list of things" screens behave and
 * look the same rather than one being cards and the other a table.
 */
export function LicenseTypeCardGrid({
  licenseTypes,
  isLoading = false,
  errorMessage = null,
  onRetry,
  emptyTitle = 'No license plans yet',
  emptyDescription,
  hasActiveFilters = false,
  onClearFilters,
  onEdit,
  onToggleStatus,
  batchSize = DEFAULT_BATCH_SIZE,
}: LicenseTypeCardGridProps) {
  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: licenseTypes.length,
    batchSize,
    resetKey: licenseTypes.length,
  });
  const renderedLicenseTypes = licenseTypes.slice(0, visibleCount);

  if (isLoading) {
    return <Loader label="Loading license plans…" />;
  }

  if (errorMessage) {
    return <ErrorMessage message={errorMessage} onRetry={onRetry} />;
  }

  if (licenseTypes.length === 0) {
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
        {renderedLicenseTypes.map((licenseType) => (
          <LicenseTypeCard
            key={licenseType.id}
            licenseType={licenseType}
            onEdit={onEdit}
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
