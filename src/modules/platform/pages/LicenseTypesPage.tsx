import { useMemo, useState } from 'react';

import type { ListToolbarFilter } from '@/components';
import { Button, ConfirmDialog, ListToolbar, PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { LicenseTypeCardGrid } from '../components/LicenseTypeCardGrid';
import { LicenseTypeModal } from '../components/LicenseTypeModal';
import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { useLicenseTypes } from '../hooks/useLicenseTypes';
import { platformService } from '../services/platformService';
import type { LicenseType } from '../types/platform.types';
import type { LicenseTypeFormValues } from '../validations/platform.validation';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { licenseType: LicenseType; kind: 'deactivate' | 'reactivate' } | null;

// Opens on Active-only, same as every other status-filtered table.
const DEFAULT_FILTER_VALUES: Record<string, string> = { isActive: 'true' };

/** Search matches plan name, code, and description. */
function getLicenseTypeSearchValue(licenseType: LicenseType): string {
  return [licenseType.name, licenseType.code, licenseType.description].filter(Boolean).join(' ');
}

function licenseTypeRequestFromForm(values: LicenseTypeFormValues) {
  return {
    name: values.name,
    code: values.code,
    description: values.description || '',
    price: values.price,
    defaultEnforcementMode: values.defaultEnforcementMode,
    isActive: values.isActive,
    maxTenantAdmins: values.maxTenantAdmins,
    maxManagers: values.maxManagers,
    maxKitchenStaff: values.maxKitchenStaff,
    maxBusinessEntities: values.maxBusinessEntities,
    maxLocations: values.maxLocations,
    maxProducts: values.maxProducts,
  };
}

/**
 * Manage the plans tenants are assigned — same card-grid treatment as
 * `TenantsPage` (its table was retired in favor of cards; this screen never
 * had its own table variant to retire, it's built as cards directly), so
 * Platform Console's two "manage a list of things" screens read
 * consistently instead of one being cards and the other a table. Create/
 * edit share one modal (`LicenseTypeModal`), opened either from "New plan"
 * or a card's "Edit" button — mirrors how `TenantCard`'s "Edit" opens
 * `TenantEditModal`. Deactivate is the backend's soft delete (`DELETE` sets
 * `is_active=False`, doesn't remove the row), so "Reactivate" is just a
 * normal `PATCH is_active=true` rather than a separate endpoint.
 */
export function LicenseTypesPage() {
  const queryClient = useQueryClient();
  const licenseTypesQuery = useLicenseTypes();

  const [modalState, setModalState] = useState<{ open: boolean; editing?: LicenseType }>({
    open: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(DEFAULT_FILTER_VALUES);

  const saveMutation = useMutation({
    mutationFn: (values: LicenseTypeFormValues) =>
      modalState.editing
        ? platformService.updateLicenseType(
            modalState.editing.id,
            licenseTypeRequestFromForm(values),
          )
        : platformService.createLicenseType(licenseTypeRequestFromForm(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.licenseTypes });
      setModalState({ open: false });
      setFormError(null);
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>) => {
      if (action.kind === 'deactivate') {
        await platformService.deleteLicenseType(action.licenseType.id);
        return;
      }
      await platformService.updateLicenseType(action.licenseType.id, { isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.licenseTypes });
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
    ],
    [],
  );

  const totalLicenseTypes = useMemo(() => licenseTypesQuery.data ?? [], [licenseTypesQuery.data]);

  const filteredLicenseTypes = useMemo(() => {
    const searched = filterBySearch(totalLicenseTypes, searchTerm, getLicenseTypeSearchValue);
    return applyFilterValues(searched, filterDefinitions, filterValues);
  }, [totalLicenseTypes, searchTerm, filterDefinitions, filterValues]);

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

  return (
    <div>
      <PageHeader
        title="License plans"
        subtitle="The seat and entity limits enforced for every business on a plan"
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setModalState({ open: true });
            }}
          >
            New plan
          </Button>
        }
      />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search plans…"
        filters={toolbarFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAllFilters}
        trailing={
          !licenseTypesQuery.isLoading && !licenseTypesQuery.isError ? (
            <span className="whitespace-nowrap rounded-control border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
              {filteredLicenseTypes.length} of {totalLicenseTypes.length}{' '}
              {totalLicenseTypes.length === 1 ? 'plan' : 'plans'}
            </span>
          ) : undefined
        }
      />

      <LicenseTypeCardGrid
        licenseTypes={filteredLicenseTypes}
        isLoading={licenseTypesQuery.isLoading}
        errorMessage={licenseTypesQuery.isError ? describeApiError(licenseTypesQuery.error) : null}
        onRetry={() => licenseTypesQuery.refetch()}
        emptyTitle="No license plans yet"
        emptyDescription="Create the first one so it can be assigned to a business."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        onEdit={(licenseType) => {
          setFormError(null);
          setModalState({ open: true, editing: licenseType });
        }}
        onToggleStatus={(licenseType) =>
          setPendingToggle({
            licenseType,
            kind: licenseType.isActive ? 'deactivate' : 'reactivate',
          })
        }
      />

      <LicenseTypeModal
        open={modalState.open}
        onOpenChange={(open) => {
          setModalState((prev) => ({ ...prev, open }));
          if (!open) setFormError(null);
        }}
        licenseType={modalState.editing}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
        isSubmitting={saveMutation.isPending}
        submitError={formError}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate' ? 'Deactivate this plan?' : 'Reactivate this plan?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.licenseType.name} can no longer be assigned to new businesses. Tenants already on it are unaffected.`
            : pendingToggle
              ? `${pendingToggle.licenseType.name} becomes assignable to new businesses again.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Reactivate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
