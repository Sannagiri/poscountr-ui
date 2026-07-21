import { useMemo, useState } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';

import type { DataTableColumn, DataTableRowAction } from '@/components';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyableText,
  DataTable,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';

import { TEAM_QUERY_KEYS } from '../../constants/team.constants';
import { useAdmins } from '../../hooks/useAdmins';
import { teamService } from '../../services/teamService';
import type { TeamMember } from '../../types/team.types';
import type { AddAdminFormValues } from '../../validations/team.validation';
import { AddAdminModal } from '../AddAdminModal';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { member: TeamMember; kind: 'deactivate' | 'activate' } | null;

/** Search matches name and email. */
function getAdminSearchValue(member: TeamMember): string {
  return [`${member.firstName} ${member.lastName}`.trim(), member.email].filter(Boolean).join(' ');
}

/**
 * The acting tenant_admin's peers — every other tenant_admin on this
 * account. Same table shape `PlatformAdminsPage` uses for ultra_admins:
 * this is an account-management list (role, email, status), not an entity
 * with a richer visual identity worth a card. Self-deactivation and
 * deactivating the last active admin are both blocked server-side; this
 * panel disables the button proactively for the same cases (the count of
 * *other* active admins is known client-side from the list itself), same
 * reasoning `PlatformAdminsPage` already uses.
 */
export function AdminsPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const adminsQuery = useAdmins();

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const addMutation = useMutation({
    mutationFn: (values: AddAdminFormValues) =>
      teamService.addAdmin({
        email: values.email,
        password: values.password,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
      }),
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.admins });
      setAddOpen(false);
      setAddError(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => setAddError(describeApiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>): Promise<string | null> => {
      if (action.kind === 'deactivate') {
        await teamService.deactivateAdmin(action.member.id);
        return null;
      }
      const result = await teamService.activateAdmin(action.member.id);
      return result.warning;
    },
    onSuccess: (warning) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.admins });
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  const activeAdminCount = useMemo(
    () => (adminsQuery.data ?? []).filter((admin) => admin.isActive).length,
    [adminsQuery.data],
  );

  const columns: DataTableColumn<TeamMember>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: '1.6fr',
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

  const rowActions: DataTableRowAction<TeamMember>[] = useMemo(
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
        onSelect: (row) => setPendingToggle({ member: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        disabled: (row) => row.isActive,
        onSelect: (row) => setPendingToggle({ member: row, kind: 'activate' }),
      },
    ],
    [activeAdminCount, currentUser?.id],
  );

  return (
    <div>
      <Card>
        <DataTable
          columns={columns}
          data={adminsQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={adminsQuery.isLoading}
          errorMessage={adminsQuery.isError ? describeApiError(adminsQuery.error) : null}
          onRetry={() => adminsQuery.refetch()}
          emptyTitle="No other admins yet"
          emptyDescription="Add another tenant_admin to share access to this account."
          getSearchValue={getAdminSearchValue}
          searchPlaceholder="Search admins…"
          toolbarTrailing={
            <Button
              onClick={() => {
                setAddError(null);
                setAddOpen(true);
              }}
            >
              Add admin
            </Button>
          }
          rowActions={() => rowActions}
        />
      </Card>

      <AddAdminModal
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddError(null);
        }}
        onSubmit={async (values) => {
          await addMutation.mutateAsync(values);
        }}
        isSubmitting={addMutation.isPending}
        submitError={addError}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate' ? 'Deactivate this admin?' : 'Activate this admin?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.member.email ?? 'This admin'} immediately loses access to this account.`
            : pendingToggle
              ? `${pendingToggle.member.email ?? 'This admin'} regains access immediately.`
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
