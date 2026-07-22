import { useMemo, useState } from 'react';

import type { ListToolbarFilter } from '@/components';
import { Button, ConfirmDialog, ListToolbar, PageHeader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';

import { CreateBusinessModal } from '../components/CreateBusinessModal';
import { TenantAdminsModal } from '../components/TenantAdminsModal';
import { TenantCardGrid } from '../components/TenantCardGrid';
import { TenantEditModal } from '../components/TenantEditModal';
import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { useLicenseTypes } from '../hooks/useLicenseTypes';
import { useTenants } from '../hooks/useTenants';
import { platformService } from '../services/platformService';
import type { Tenant } from '../types/platform.types';
import { lifecycleConfirmCopy, nextLifecycleAction } from '../utils/tenantLifecycle';
import type { CreateTenantFormValues } from '../validations/platform.validation';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingAction = { tenant: Tenant; kind: 'suspend' | 'activate' } | null;

/** Search matches business name, display name, slug, and owner email. */
function getTenantSearchValue(tenant: Tenant): string {
  return [tenant.name, tenant.displayName, tenant.slug, tenant.ownerEmail]
    .filter(Boolean)
    .join(' ');
}

/**
 * Ultra Admin's "businesses" screen — every tenant on the platform, as a
 * card grid (a table view existed briefly as a trial; cards won and the
 * table was removed rather than kept as unused dead weight), plus the one
 * action this phase asked for: create a new business (tenant) with its
 * first owner login in a single step. Suspend/activate are included too
 * since they're the natural lifecycle pair once a business exists.
 */
export function TenantsPage() {
  const queryClient = useQueryClient();
  const tenantsQuery = useTenants();
  // Also feeds the create-business modal's license dropdown, prefetched here
  // so it opens instantly instead of showing a loading flash the first time.
  const licenseTypesQuery = useLicenseTypes();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [createdBusinessName, setCreatedBusinessName] = useState<string | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [adminsModalTenantId, setAdminsModalTenantId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: platformService.createTenant,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.tenants });
      setCreateOpen(false);
      setCreateError(null);
      setCreatedBusinessName(variables.name);
    },
    onError: (error) => setCreateError(describeApiError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (action: NonNullable<PendingAction>) =>
      action.kind === 'suspend'
        ? platformService.suspendTenant(action.tenant.id)
        : platformService.activateTenant(action.tenant.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.tenants });
      setPendingAction(null);
    },
  });

  async function handleCreateSubmit(values: CreateTenantFormValues) {
    setCreateError(null);
    await createMutation.mutateAsync({
      name: values.name,
      slug: values.slug,
      licenseTypeId: values.licenseTypeId || undefined,
      adminEmail: values.adminEmail,
      adminPassword: values.adminPassword,
      adminFirstName: values.adminFirstName || undefined,
      adminLastName: values.adminLastName || undefined,
    });
  }

  const filterDefinitions = useMemo(
    () => [
      {
        key: 'status',
        label: 'statuses',
        options: [
          { value: 'trial', label: 'Trial' },
          { value: 'active', label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
        ],
      },
      {
        key: 'licenseTypeName',
        label: 'plans',
        options: (licenseTypesQuery.data ?? []).map((plan) => ({
          value: plan.name,
          label: plan.name,
        })),
      },
    ],
    [licenseTypesQuery.data],
  );

  const pendingActionCopy = pendingAction
    ? lifecycleConfirmCopy(pendingAction.tenant, pendingAction.kind)
    : null;

  const totalTenants = useMemo(() => tenantsQuery.data ?? [], [tenantsQuery.data]);

  const filteredTenants = useMemo(() => {
    const searched = filterBySearch(totalTenants, searchTerm, getTenantSearchValue);
    return applyFilterValues(searched, filterDefinitions, filterValues);
  }, [totalTenants, searchTerm, filterDefinitions, filterValues]);

  const hasActiveFilters = hasActiveListFilters(searchTerm, filterValues);

  function clearAllFilters() {
    setSearchTerm('');
    setFilterValues({});
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
        title="Businesses"
        subtitle="Every tenant on the platform"
        actions={<Button onClick={() => setCreateOpen(true)}>New business</Button>}
      />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search businesses…"
        filters={toolbarFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAllFilters}
        trailing={
          !tenantsQuery.isLoading && !tenantsQuery.isError ? (
            <span className="whitespace-nowrap rounded-control border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
              {filteredTenants.length} of {totalTenants.length}{' '}
              {totalTenants.length === 1 ? 'business' : 'businesses'}
            </span>
          ) : undefined
        }
      />

      <TenantCardGrid
        tenants={filteredTenants}
        isLoading={tenantsQuery.isLoading}
        errorMessage={tenantsQuery.isError ? describeApiError(tenantsQuery.error) : null}
        onRetry={() => tenantsQuery.refetch()}
        emptyTitle="No businesses yet"
        emptyDescription="Create the first one to get started."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        onEdit={(tenant) => setEditingTenantId(tenant.id)}
        onManageAdmins={(tenant) => setAdminsModalTenantId(tenant.id)}
        onToggleStatus={(tenant) =>
          setPendingAction({
            tenant,
            kind: nextLifecycleAction(tenant.status),
          })
        }
      />

      <CreateBusinessModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError(null);
        }}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
        submitError={createError}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingActionCopy?.title ?? 'Update this business?'}
        description={pendingActionCopy?.description}
        confirmText={pendingActionCopy?.confirmText}
        isDestructive={pendingActionCopy?.isDestructive ?? false}
        isLoading={statusMutation.isPending}
        onConfirm={() => pendingAction && statusMutation.mutate(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={createdBusinessName !== null}
        variant="success"
        title="Business created!"
        description={
          createdBusinessName
            ? `Congratulations on growing your platform — ${createdBusinessName} is up and running. Looking forward to many more.`
            : undefined
        }
        confirmText="Great, thanks!"
        isDestructive={false}
        hideCancel
        onConfirm={() => setCreatedBusinessName(null)}
        onCancel={() => setCreatedBusinessName(null)}
      />

      <TenantEditModal
        tenantId={editingTenantId}
        onOpenChange={(open) => {
          if (!open) setEditingTenantId(null);
        }}
      />

      <TenantAdminsModal
        tenantId={adminsModalTenantId}
        onOpenChange={(open) => {
          if (!open) setAdminsModalTenantId(null);
        }}
      />
    </div>
  );
}
