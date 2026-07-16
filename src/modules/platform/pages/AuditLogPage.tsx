import { useMemo, useState } from 'react';

import type { DataTableColumn, SelectOption } from '@/components';
import { Card, DataTable, PageHeader, Select } from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel } from '@/utils/status';

import { useAuditLogs } from '../hooks/useAuditLogs';
import { useTenants } from '../hooks/useTenants';
import type { AuditLogAction, AuditLogEntry } from '../types/platform.types';

const ALL_VALUE = 'all';

const ACTION_OPTIONS: AuditLogAction[] = [
  'tenant_created',
  'tenant_suspended',
  'tenant_activated',
  'license_assigned',
  'quota_override_set',
  'user_blocked',
  'user_unblocked',
  'impersonation_started',
  'license_type_created',
  'license_type_updated',
  'license_type_deleted',
  'ultra_admin_created',
  'ultra_admin_activated',
  'ultra_admin_deactivated',
  'tenant_admin_added',
];

/** Search matches the action label, reason, and resolved business name. */
function getAuditLogSearchValue(entry: AuditLogEntry, tenantNameById: Map<string, string>): string {
  return [
    statusLabel(entry.action),
    entry.reason,
    entry.targetTenantId ? tenantNameById.get(entry.targetTenantId) : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The platform's append-only action feed — read-only by design (the backend
 * exposes GET only). The business/action filters are server-side
 * (`tenant_id`/`action` are the only params the backend supports, and
 * results are hard-capped at 200 rows with no further pagination), so those
 * two re-query on change rather than going through `DataTable`'s own
 * client-side `filters` prop — they're passed in via `filtersSlot` instead,
 * which renders them inside the table's own toolbar row (next to the search
 * box) rather than as a disconnected row of controls floating above the
 * table they filter. The search box *is* `DataTable`'s built-in one — a
 * client-side text search over whichever up-to-200 rows the server filters
 * already narrowed down to, which is exactly the scope search needs here.
 * Only IDs are exposed for actor/target on the backend — tenant names are
 * resolved here by cross-referencing the already-fetched tenants list rather
 * than showing a raw UUID.
 */
export function AuditLogPage() {
  const [tenantFilter, setTenantFilter] = useState(ALL_VALUE);
  const [actionFilter, setActionFilter] = useState(ALL_VALUE);

  const tenantsQuery = useTenants();
  const auditLogsQuery = useAuditLogs({
    tenantId: tenantFilter === ALL_VALUE ? undefined : tenantFilter,
    action: actionFilter === ALL_VALUE ? undefined : (actionFilter as AuditLogAction),
  });

  const tenantNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of tenantsQuery.data ?? []) {
      map.set(tenant.id, tenant.name);
    }
    return map;
  }, [tenantsQuery.data]);

  const tenantOptions: SelectOption[] = useMemo(
    () => [
      { value: ALL_VALUE, label: 'All businesses' },
      ...(tenantsQuery.data ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })),
    ],
    [tenantsQuery.data],
  );

  const actionOptions: SelectOption[] = useMemo(
    () => [
      { value: ALL_VALUE, label: 'All actions' },
      ...ACTION_OPTIONS.map((action) => ({ value: action, label: statusLabel(action) })),
    ],
    [],
  );

  const columns: DataTableColumn<AuditLogEntry>[] = useMemo(
    () => [
      {
        key: 'action',
        header: 'Action',
        width: '1.6fr',
        render: (row) => statusLabel(row.action),
      },
      {
        key: 'targetTenantId',
        header: 'Business',
        width: '1.6fr',
        render: (row) =>
          row.targetTenantId ? (tenantNameById.get(row.targetTenantId) ?? '—') : '—',
      },
      {
        key: 'actorId',
        header: 'Actor',
        width: '160px',
        render: (row) => (row.actorId ? `${row.actorId.slice(0, 8)}…` : 'System'),
      },
      {
        key: 'reason',
        header: 'Reason',
        width: '2fr',
        render: (row) => row.reason || '—',
      },
      {
        key: 'createdAt',
        header: 'When',
        width: '160px',
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
    ],
    [tenantNameById],
  );

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every platform-level action, newest first — capped at the most recent 200"
      />

      <Card>
        <DataTable
          columns={columns}
          data={auditLogsQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={auditLogsQuery.isLoading}
          errorMessage={auditLogsQuery.isError ? describeApiError(auditLogsQuery.error) : null}
          onRetry={() => auditLogsQuery.refetch()}
          emptyTitle="No matching activity"
          emptyDescription="Try a different business or action filter."
          getSearchValue={(row) => getAuditLogSearchValue(row, tenantNameById)}
          searchPlaceholder="Search action, reason, business…"
          filtersSlot={
            <>
              <Select
                className="w-auto min-w-[10rem]"
                value={tenantFilter}
                onChange={setTenantFilter}
                options={tenantOptions}
              />
              <Select
                className="w-auto min-w-[10rem]"
                value={actionFilter}
                onChange={setActionFilter}
                options={actionOptions}
              />
            </>
          }
        />
      </Card>
    </div>
  );
}
