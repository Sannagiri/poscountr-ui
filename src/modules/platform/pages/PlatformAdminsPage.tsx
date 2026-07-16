import { useMemo, useState } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyableText,
  DataTable,
  ErrorMessage,
  PageHeader,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';

import { CreatePlatformAdminModal } from '../components/CreatePlatformAdminModal';
import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { usePlatformAdmins } from '../hooks/usePlatformAdmins';
import { platformService } from '../services/platformService';
import type { PlatformAdmin } from '../types/platform.types';
import type { AdminAccountFormValues } from '../validations/platform.validation';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { admin: PlatformAdmin; kind: 'activate' | 'deactivate' } | null;
type PendingBulkToggle = { admins: PlatformAdmin[]; kind: 'activate' | 'deactivate' } | null;

/** Search matches name and email. */
function getPlatformAdminSearchValue(admin: PlatformAdmin): string {
  return [admin.firstName, admin.lastName, admin.email].filter(Boolean).join(' ');
}

/**
 * Ultra_admin accounts — the people who can see this Platform Console at
 * all. There's no separate model on the backend for this; it's the same
 * `accounts.User` table filtered to `role=ultra_admin`, so "deactivate" here
 * means blocking a platform admin's own access, not deleting a record.
 * Self-deactivation and deactivating the last active admin are both blocked
 * server-side — this page disables the button proactively for the same
 * cases (the count of *other* active admins is known client-side from the
 * list itself) so the failure is never surprising, but the request would
 * still be safely rejected either way if it slipped through.
 */
export function PlatformAdminsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const adminsQuery = usePlatformAdmins();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [pendingBulkToggle, setPendingBulkToggle] = useState<PendingBulkToggle>(null);

  const createMutation = useMutation({
    mutationFn: platformService.createPlatformAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.platformAdmins });
      setCreateOpen(false);
      setCreateError(null);
    },
    onError: (error) => setCreateError(describeApiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (action: NonNullable<PendingToggle>) =>
      action.kind === 'deactivate'
        ? platformService.deactivatePlatformAdmin(action.admin.id)
        : platformService.activatePlatformAdmin(action.admin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.platformAdmins });
      setPendingToggle(null);
    },
    onError: () => setPendingToggle(null),
  });

  // Same per-row endpoints as the single-row toggle, fired once per eligible
  // admin in the selection. Self and "last active admin" are excluded from
  // a bulk deactivate the same way they're disabled on the single-row
  // action — the backend would reject either case anyway, so filtering them
  // out here avoids a partial-failure surprise.
  const bulkToggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingBulkToggle>) => {
      const eligible = action.admins.filter((admin) => {
        if (action.kind === 'activate') return !admin.isActive;
        const isSelf = admin.id === currentUser?.id;
        const isLastActive = admin.isActive && activeAdminCount <= 1;
        return admin.isActive && !isSelf && !isLastActive;
      });
      await Promise.allSettled(
        eligible.map((admin) =>
          action.kind === 'deactivate'
            ? platformService.deactivatePlatformAdmin(admin.id)
            : platformService.activatePlatformAdmin(admin.id),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.platformAdmins });
      setPendingBulkToggle(null);
    },
    onError: () => setPendingBulkToggle(null),
  });

  async function handleCreateSubmit(values: AdminAccountFormValues) {
    await createMutation.mutateAsync({
      email: values.email,
      password: values.password,
      firstName: values.firstName || undefined,
      lastName: values.lastName || undefined,
    });
  }

  const activeAdminCount = useMemo(
    () => (adminsQuery.data ?? []).filter((admin) => admin.isActive).length,
    [adminsQuery.data],
  );

  const columns: DataTableColumn<PlatformAdmin>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: '1.8fr',
        render: (row) => `${row.firstName} ${row.lastName}`.trim() || '—',
      },
      {
        key: 'email',
        header: 'Email',
        width: '2fr',
        render: (row) =>
          row.email ? (
            <CopyableText value={row.email} copiedMessage="Email copied to clipboard" />
          ) : (
            '—'
          ),
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '110px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Added',
        width: '120px',
        render: (row) => new Date(row.createdAt).toLocaleDateString(),
      },
    ],
    [],
  );

  const rowActions: DataTableRowAction<PlatformAdmin>[] = useMemo(
    () => [
      {
        label: 'Deactivate',
        icon: Ban,
        destructive: true,
        disabled: (row) => {
          const isSelf = row.id === currentUser?.id;
          const isLastActive = row.isActive && activeAdminCount <= 1;
          return !row.isActive || isSelf || isLastActive;
        },
        onSelect: (row) => setPendingToggle({ admin: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        disabled: (row) => row.isActive,
        onSelect: (row) => setPendingToggle({ admin: row, kind: 'activate' }),
      },
    ],
    [activeAdminCount, currentUser?.id],
  );

  const filters: DataTableFilter<PlatformAdmin>[] = useMemo(
    () => [
      {
        key: 'isActive',
        label: 'statuses',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
        getValue: (row) => String(row.isActive),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Platform admins"
        subtitle="Accounts with full access to this Platform Console"
        actions={
          <Button
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            New admin
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          data={adminsQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={adminsQuery.isLoading}
          errorMessage={adminsQuery.isError ? describeApiError(adminsQuery.error) : null}
          onRetry={() => adminsQuery.refetch()}
          emptyTitle="No platform admins yet"
          getSearchValue={getPlatformAdminSearchValue}
          searchPlaceholder="Search admins…"
          filters={filters}
          rowActions={() => rowActions}
          selectable
          bulkActions={(selectedRows) => (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingBulkToggle({ admins: selectedRows, kind: 'deactivate' })}
              >
                Deactivate selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingBulkToggle({ admins: selectedRows, kind: 'activate' })}
              >
                Activate selected
              </Button>
            </>
          )}
        />
      </Card>

      {toggleMutation.isError ? (
        <div className="mt-3">
          <ErrorMessage message={describeApiError(toggleMutation.error)} />
        </div>
      ) : null}

      <CreatePlatformAdminModal
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
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate' ? 'Deactivate this admin?' : 'Activate this admin?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.admin.email ?? 'This admin'} will immediately lose Platform Console access.`
            : pendingToggle
              ? `${pendingToggle.admin.email ?? 'This admin'} regains Platform Console access immediately.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />

      <ConfirmDialog
        open={pendingBulkToggle !== null}
        title={
          pendingBulkToggle?.kind === 'deactivate'
            ? `Deactivate ${pendingBulkToggle.admins.length} selected admin${pendingBulkToggle.admins.length === 1 ? '' : 's'}?`
            : `Activate ${pendingBulkToggle?.admins.length ?? 0} selected admin${pendingBulkToggle?.admins.length === 1 ? '' : 's'}?`
        }
        description={
          pendingBulkToggle?.kind === 'deactivate'
            ? 'Your own account and the last active admin are skipped even if selected — Platform Console always needs at least one active admin.'
            : 'Admins in the selection that are already active are left as-is.'
        }
        confirmText={pendingBulkToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingBulkToggle?.kind === 'deactivate'}
        isLoading={bulkToggleMutation.isPending}
        onConfirm={() => pendingBulkToggle && bulkToggleMutation.mutate(pendingBulkToggle)}
        onCancel={() => setPendingBulkToggle(null)}
      />
    </div>
  );
}
