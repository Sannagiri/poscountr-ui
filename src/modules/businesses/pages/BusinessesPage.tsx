import { useMemo, useState } from 'react';

import type { ListToolbarFilter } from '@/components';
import { Button, ConfirmDialog, ListToolbar, PageHeader, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { BusinessCardGrid } from '../components/BusinessCardGrid';
import { BusinessEditModal } from '../components/BusinessEditModal';
import { LicenseUsageCard } from '../components/LicenseUsageCard';
import { LocationsModal } from '../components/LocationsModal';
import { BUSINESSES_QUERY_KEYS, ENTITY_TYPE_OPTIONS } from '../constants/businesses.constants';
import { useBusinesses } from '../hooks/useBusinesses';
import { useLicenseUsage } from '../hooks/useLicenseUsage';
import { useLocations } from '../hooks/useLocations';
import { businessesService } from '../services/businessesService';
import type { BusinessEntity } from '../types/businesses.types';
import { limitReachedReason } from '../utils/licenseLimit';
import type { BusinessFormValues } from '../validations/businesses.validation';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { business: BusinessEntity; kind: 'deactivate' | 'activate' } | null;

// Opens on Active-only, same as every other status-filtered table — an
// inactive business is a deliberate filter change away, not mixed in by
// default.
const DEFAULT_FILTER_VALUES: Record<string, string> = { isActive: 'true' };

/** Search matches business name, GSTIN, and phone. */
function getBusinessSearchValue(business: BusinessEntity): string {
  return [business.name, business.gstin, business.phone].filter(Boolean).join(' ');
}

/**
 * Tenant Admin's "Businesses" screen (F3) — every business
 * (operating entity) under the account, as a card grid mirroring the
 * Platform Console's Tenants/License Plans pattern (search+filter toolbar,
 * a count pill instead of a table/cards toggle, an Edit modal). Locations
 * are managed nested inside a business's card via a "N locations" button
 * (`LocationsModal`) rather than as a separate page/tab — the confirm-first
 * answer for this screen was "whichever fits the established standards
 * best," and nesting is what `TenantCard`'s "Admins" button → `TenantAdminsModal`
 * already established as this app's pattern for a parent/child list pair.
 *
 * Both businesses and locations fetch in full up front (`useBusinesses`,
 * `useLocations`) — the backend has no per-business locations endpoint, and
 * the page needs the full locations list anyway for each card's location
 * count, so `LocationsModal` filters that same already-fetched list by
 * `businessId` instead of the modal re-fetching per business.
 *
 * "New business" and each inactive card's "Activate" stay visible but
 * disabled (with a `disabledReason` tooltip) once `useLicenseUsage` reports
 * the business-entity cap reached — same treatment `LocationsPage` gives its
 * own "Add location"/"Activate".
 */
export function BusinessesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const businessesQuery = useBusinesses();
  const locationsQuery = useLocations();
  const licenseUsageQuery = useLicenseUsage();
  const businessLimitReason = limitReachedReason(
    licenseUsageQuery.data?.businessEntities,
    'business',
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessEntity | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [locationsModalBusiness, setLocationsModalBusiness] = useState<BusinessEntity | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(DEFAULT_FILTER_VALUES);

  const saveMutation = useMutation({
    mutationFn: async (values: BusinessFormValues): Promise<{ warning: string | null }> => {
      const request = {
        name: values.name,
        entityType: values.entityType,
        gstin: values.gstin || undefined,
        phone: values.phone || undefined,
        state: values.state || undefined,
      };
      if (editingBusiness) {
        await businessesService.updateBusiness(editingBusiness.id, request);
        return { warning: null };
      }
      const result = await businessesService.createBusiness(request);
      return { warning: result.warning };
    },
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.businesses });
      // A new business counts against the business-entity license cap
      // immediately — see the matching comment in `LocationsModal`.
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.licenseUsage });
      const wasEditing = Boolean(editingBusiness);
      setCreateOpen(false);
      setEditingBusiness(undefined);
      setFormError(null);
      if (warning) {
        showToast({ tone: 'warning', message: warning });
      } else {
        showToast({
          tone: 'success',
          message: wasEditing ? 'Business updated.' : 'Business created.',
        });
      }
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>): Promise<string | null> => {
      if (action.kind === 'deactivate') {
        await businessesService.deactivateBusiness(action.business.id);
        return null;
      }
      const result = await businessesService.activateBusiness(action.business.id);
      return result.warning;
    },
    onSuccess: (warning) => {
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.businesses });
      // Same reason as `saveMutation` above — activate/deactivate changes
      // the active count the license cap is measured against.
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.licenseUsage });
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  const filterDefinitions = useMemo(
    () => [
      {
        key: 'isActive',
        label: 'statuses',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
      },
      {
        key: 'entityType',
        label: 'types',
        options: ENTITY_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
    ],
    [],
  );

  const totalBusinesses = useMemo(() => businessesQuery.data ?? [], [businessesQuery.data]);

  const filteredBusinesses = useMemo(() => {
    const searched = filterBySearch(totalBusinesses, searchTerm, getBusinessSearchValue);
    return applyFilterValues(searched, filterDefinitions, filterValues);
  }, [totalBusinesses, searchTerm, filterDefinitions, filterValues]);

  const hasActiveFilters = hasActiveListFilters(searchTerm, filterValues, DEFAULT_FILTER_VALUES);

  function clearAllFilters() {
    setSearchTerm('');
    setFilterValues(DEFAULT_FILTER_VALUES);
  }

  const toolbarFilters: ListToolbarFilter[] = filterDefinitions.map((filter) => ({
    key: filter.key,
    label: filter.label,
    value: filterValues[filter.key] ?? 'all',
    onChange: (value) => setFilterValues((prev) => ({ ...prev, [filter.key]: value })),
    options: filter.options,
  }));

  const locationCountsByBusinessId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const location of locationsQuery.data ?? []) {
      counts.set(location.businessId, (counts.get(location.businessId) ?? 0) + 1);
    }
    return counts;
  }, [locationsQuery.data]);

  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Every operating entity under your account, and their outlets"
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
            disabled={Boolean(businessLimitReason)}
            disabledReason={businessLimitReason}
          >
            New business
          </Button>
        }
      />

      <LicenseUsageCard />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search businesses…"
        filters={toolbarFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAllFilters}
        trailing={
          !businessesQuery.isLoading && !businessesQuery.isError ? (
            <span className="whitespace-nowrap rounded-control border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
              {filteredBusinesses.length} of {totalBusinesses.length}{' '}
              {totalBusinesses.length === 1 ? 'business' : 'businesses'}
            </span>
          ) : undefined
        }
      />

      <BusinessCardGrid
        businesses={filteredBusinesses}
        locationCountsByBusinessId={locationCountsByBusinessId}
        activationBlockedReason={businessLimitReason}
        isLoading={businessesQuery.isLoading}
        errorMessage={businessesQuery.isError ? describeApiError(businessesQuery.error) : null}
        onRetry={() => businessesQuery.refetch()}
        emptyTitle="No businesses yet"
        emptyDescription="Create the first one to get started."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        onEdit={(business) => {
          setFormError(null);
          setEditingBusiness(business);
        }}
        onManageLocations={(business) => setLocationsModalBusiness(business)}
        onToggleStatus={(business) =>
          setPendingToggle({
            business,
            kind: business.isActive ? 'deactivate' : 'activate',
          })
        }
      />

      <BusinessEditModal
        open={createOpen || Boolean(editingBusiness)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingBusiness(undefined);
            setFormError(null);
          }
        }}
        business={editingBusiness}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
        isSubmitting={saveMutation.isPending}
        submitError={formError}
      />

      <LocationsModal
        business={locationsModalBusiness}
        locations={locationsQuery.data ?? []}
        isLoading={locationsQuery.isLoading}
        errorMessage={locationsQuery.isError ? describeApiError(locationsQuery.error) : null}
        onRetry={() => locationsQuery.refetch()}
        onOpenChange={(open) => {
          if (!open) setLocationsModalBusiness(null);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this business?'
            : 'Activate this business?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.business.name} and its locations stop appearing across the app until reactivated.`
            : pendingToggle
              ? `${pendingToggle.business.name} becomes available again immediately.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
