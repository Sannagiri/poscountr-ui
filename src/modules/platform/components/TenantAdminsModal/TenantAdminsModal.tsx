import { useState } from 'react';
import { ShieldOff, UserCheck } from 'lucide-react';

import {
  Badge,
  Button,
  ConfirmDialog,
  CopyableText,
  DropdownMenu,
  EmptyState,
  ErrorMessage,
  Loader,
  Modal,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { PLATFORM_QUERY_KEYS } from '../../constants/platform.constants';
import { useTenant } from '../../hooks/useTenant';
import { useTenantAdmins } from '../../hooks/useTenantAdmins';
import { platformService } from '../../services/platformService';
import type { TenantAdmin } from '../../types/platform.types';
import type { AdminAccountFormValues } from '../../validations/platform.validation';
import { AddTenantAdminModal } from '../AddTenantAdminModal';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface TenantAdminsModalProps {
  /** `null` (or `undefined`) closes the modal — a truthy id opens it for that tenant. */
  tenantId: string | null | undefined;
  onOpenChange: (open: boolean) => void;
}

type PendingAccessChange = { admin: TenantAdmin; kind: 'block' | 'unblock' } | null;

/**
 * All of one business's admin accounts, in a focused modal of its own —
 * opened directly from a "Admins" chip (on a `TenantCard`, or from
 * `TenantEditModal`'s summary line) rather than being buried inside a
 * bigger edit screen, since "add/manage admins" is its own task separate
 * from editing the business's own fields.
 *
 * There's no "delete a tenant admin" endpoint on the backend (only list/add
 * — see `platformService.listTenantAdmins`/`addTenantAdmin`), so "remove
 * access" here is a block (`POST /platform/users/{id}/block/`), the real,
 * backend-supported equivalent: it kills their sessions and prevents login
 * without pretending to hard-delete an account this UI has no authority to
 * delete. "Restore access" is the matching unblock call.
 */
export function TenantAdminsModal({ tenantId, onOpenChange }: TenantAdminsModalProps) {
  const open = Boolean(tenantId);
  const queryClient = useQueryClient();

  const tenantQuery = useTenant(tenantId ?? undefined);
  const adminsQuery = useTenantAdmins(tenantId ?? undefined);

  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [pendingAccessChange, setPendingAccessChange] = useState<PendingAccessChange>(null);

  const addAdminMutation = useMutation({
    mutationFn: (values: AdminAccountFormValues) =>
      platformService.addTenantAdmin(tenantId as string, {
        email: values.email,
        password: values.password,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_QUERY_KEYS.tenantAdmins(tenantId as string),
      });
      setAddAdminOpen(false);
      setAddAdminError(null);
    },
    onError: (error) => setAddAdminError(describeApiError(error)),
  });

  const accessMutation = useMutation({
    mutationFn: (action: NonNullable<PendingAccessChange>) =>
      action.kind === 'block'
        ? platformService.blockUser(action.admin.id)
        : platformService.unblockUser(action.admin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_QUERY_KEYS.tenantAdmins(tenantId as string),
      });
      setPendingAccessChange(null);
    },
  });

  const tenant = tenantQuery.data;
  const admins = adminsQuery.data ?? [];

  function renderBody() {
    if (adminsQuery.isLoading || tenantQuery.isLoading) {
      return <Loader label="Loading admins…" />;
    }
    if (adminsQuery.isError) {
      return (
        <ErrorMessage
          message={describeApiError(adminsQuery.error)}
          onRetry={() => adminsQuery.refetch()}
        />
      );
    }
    if (admins.length === 0) {
      return (
        <EmptyState
          title="No admins yet"
          description="Add the first admin account for this business."
        />
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {admins.map((admin) => {
          const isBlocked = admin.isPlatformBlocked;
          return (
            <div
              key={admin.id}
              className="flex items-center justify-between gap-2.5 rounded-control border border-border px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {`${admin.firstName} ${admin.lastName}`.trim() || admin.email || '—'}
                </p>
                {admin.email ? (
                  <CopyableText
                    value={admin.email}
                    copiedMessage="Email copied to clipboard"
                    className="text-xs text-ink-faint"
                  />
                ) : (
                  <p className="truncate text-xs text-ink-faint">—</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {admin.isPrimary ? <Badge tone="accent">Owner</Badge> : null}
                <Badge tone={toneForStatus(isBlocked ? 'blocked' : 'active')}>
                  {isBlocked ? 'Blocked' : 'Active'}
                </Badge>
                <DropdownMenu
                  trigger={
                    <Button variant="ghost" size="sm" className="px-2">
                      Actions
                    </Button>
                  }
                  items={[
                    isBlocked
                      ? {
                          label: 'Restore access',
                          icon: UserCheck,
                          onSelect: () => setPendingAccessChange({ admin, kind: 'unblock' }),
                        }
                      : {
                          label: 'Remove access',
                          icon: ShieldOff,
                          destructive: true,
                          onSelect: () => setPendingAccessChange({ admin, kind: 'block' }),
                        },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={tenant ? `Admins — ${tenant.displayName || tenant.name}` : 'Admins'}
        description="Everyone with tenant_admin access to this business"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => setAddAdminOpen(true)}>Add admin</Button>
          </>
        }
      >
        {renderBody()}
      </Modal>

      <AddTenantAdminModal
        open={addAdminOpen}
        onOpenChange={(next) => {
          setAddAdminOpen(next);
          if (!next) setAddAdminError(null);
        }}
        onSubmit={async (values) => {
          await addAdminMutation.mutateAsync(values);
        }}
        isSubmitting={addAdminMutation.isPending}
        submitError={addAdminError}
      />

      <ConfirmDialog
        open={pendingAccessChange !== null}
        title={
          pendingAccessChange?.kind === 'block'
            ? 'Remove this admin’s access?'
            : 'Restore this admin’s access?'
        }
        description={
          pendingAccessChange?.kind === 'block'
            ? `${pendingAccessChange.admin.email ?? 'This admin'} will be signed out immediately and can't log in until access is restored.`
            : pendingAccessChange
              ? `${pendingAccessChange.admin.email ?? 'This admin'} can log in again immediately.`
              : undefined
        }
        confirmText={pendingAccessChange?.kind === 'block' ? 'Remove access' : 'Restore access'}
        isDestructive={pendingAccessChange?.kind === 'block'}
        isLoading={accessMutation.isPending}
        onConfirm={() => pendingAccessChange && accessMutation.mutate(pendingAccessChange)}
        onCancel={() => setPendingAccessChange(null)}
      />
    </>
  );
}
