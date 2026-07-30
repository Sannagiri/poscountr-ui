import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Pencil } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';
import type { BusinessEntity } from '@/modules/businesses';
import { ChooseBusinessModal, useBusinesses } from '@/modules/businesses';

import { SupplierFormModal } from '../components/SupplierFormModal';
import { useSuppliers } from '../hooks/useSuppliers';
import { purchasingService } from '../services/purchasingService';
import type { Supplier } from '../types/purchasing.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { supplier: Supplier; kind: 'deactivate' | 'activate' } | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/** Search matches name, phone, email, and GSTIN. */
function getSupplierSearchValue(supplier: Supplier): string {
  return [supplier.name, supplier.phone, supplier.email, supplier.gstin].filter(Boolean).join(' ');
}

/**
 * Every supplier visible to the actor, in one flat table — manager
 * pre-scoped to their own business server-side, tenant_admin sees every
 * business's (same scoping shape `ProductsPage` already established for
 * products). "Add supplier" asks which business first
 * (`ChooseBusinessModal`, reused from `@/modules/businesses`), but only for
 * a tenant_admin — a manager can't call `useBusinesses` at all
 * (`IsTenantAdmin`-gated), and doesn't need to anyway since the backend
 * always forces their own business regardless of what's sent.
 */
export function SuppliersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const suppliersQuery = useSuppliers();
  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });

  const [formTarget, setFormTarget] = useState<Supplier | 'create' | null>(null);
  const [formBusinessId, setFormBusinessId] = useState<string | undefined>(undefined);
  const [businessPickerOpen, setBusinessPickerOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const toggleMutation = useMutation({
    mutationFn: (action: NonNullable<PendingToggle>) =>
      purchasingService.updateSupplier(action.supplier.id, {
        isActive: action.kind === 'activate',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
      setPendingToggle(null);
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  function startAddSupplier() {
    if (isTenantAdmin) {
      setBusinessPickerOpen(true);
    } else {
      // A manager can't call `/tenant/businesses/` at all — the backend
      // forces their own business regardless of what's sent.
      setFormBusinessId(undefined);
      setFormTarget('create');
    }
  }

  const businessFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const business of businessesQuery.data ?? []) seen.set(business.id, business.name);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [businessesQuery.data]);

  const columns: DataTableColumn<Supplier>[] = useMemo(
    () => [
      { key: 'name', header: 'Supplier', width: '1.3fr' },
      { key: 'phone', header: 'Phone', width: '130px', render: (row) => row.phone || '—' },
      { key: 'email', header: 'Email', width: '1fr', render: (row) => row.email || '—' },
      { key: 'gstin', header: 'GSTIN', width: '150px', render: (row) => row.gstin || '—' },
      { key: 'state', header: 'State', width: '90px', render: (row) => row.state || '—' },
      {
        key: 'isActive',
        header: 'Status',
        width: '100px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<Supplier>[] = useMemo(
    () => [
      { key: 'businessId', label: 'Business', options: businessFilterOptions },
      { key: 'isActive', label: 'Status', options: STATUS_FILTER_OPTIONS, defaultValue: 'true' },
    ],
    [businessFilterOptions],
  );

  const rowActions: DataTableRowAction<Supplier>[] = useMemo(
    () => [
      { label: 'Edit', icon: Pencil, onSelect: (row) => setFormTarget(row) },
      {
        label: 'Deactivate',
        icon: Ban,
        destructive: true,
        disabled: (row) => !row.isActive,
        onSelect: (row) => setPendingToggle({ supplier: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        disabled: (row) => row.isActive,
        onSelect: (row) => setPendingToggle({ supplier: row, kind: 'activate' }),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Every vendor you buy stock from, in one place" />

      <Card>
        <DataTable
          columns={columns}
          data={suppliersQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={suppliersQuery.isLoading}
          errorMessage={suppliersQuery.isError ? describeApiError(suppliersQuery.error) : null}
          onRetry={() => suppliersQuery.refetch()}
          emptyTitle="No suppliers yet"
          emptyDescription="Add your first supplier using the button above."
          getSearchValue={getSupplierSearchValue}
          searchPlaceholder="Search suppliers…"
          filters={filters}
          onRowClick={(row) => setFormTarget(row)}
          toolbarTrailing={<Button onClick={startAddSupplier}>Add supplier</Button>}
          rowActions={() => rowActions}
        />
      </Card>

      <ChooseBusinessModal
        open={businessPickerOpen}
        businesses={businessesQuery.data ?? []}
        isLoading={businessesQuery.isLoading}
        title="Add supplier"
        description="Which business is this supplier for?"
        onOpenChange={setBusinessPickerOpen}
        onContinue={(business: BusinessEntity) => {
          setFormBusinessId(business.id);
          setFormTarget('create');
          setBusinessPickerOpen(false);
        }}
      />

      <SupplierFormModal
        target={formTarget}
        businessId={formBusinessId}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={pendingToggle?.kind === 'deactivate' ? 'Deactivate this supplier?' : 'Activate this supplier?'}
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.supplier.name} stops appearing when adding a purchase order.`
            : pendingToggle
              ? `${pendingToggle.supplier.name} becomes available again immediately.`
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
