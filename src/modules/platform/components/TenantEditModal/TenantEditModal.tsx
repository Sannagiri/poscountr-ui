import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Users } from 'lucide-react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  ErrorMessage,
  Input,
  Loader,
  Modal,
  Select,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { PLATFORM_QUERY_KEYS } from '../../constants/platform.constants';
import { useLicenseTypes } from '../../hooks/useLicenseTypes';
import { useTenant } from '../../hooks/useTenant';
import { platformService } from '../../services/platformService';
import type { UpdateTenantFormValues } from '../../validations/platform.validation';
import { updateTenantSchema } from '../../validations/platform.validation';
import { TenantAdminsModal } from '../TenantAdminsModal';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingLifecycleAction = 'suspend' | 'activate' | null;

export interface TenantEditModalProps {
  /** `null` (or `undefined`) closes the modal — a truthy id opens it for that tenant. */
  tenantId: string | null | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Business edit, opened directly from a card/row action in `TenantsPage` —
 * a centered `Modal`, the same dialog type `TenantAdminsModal` uses,
 * instead of a side-sliding `Drawer` (an earlier version used `Drawer`;
 * switched here so every overlay on this screen reads as the same kind of
 * "dialog," not two different shapes). Still one scrollable panel, not a
 * separate page or tabs: the editable fields `TenantUpdateInputSerializer`
 * actually accepts (no `slug` — immutable server-side), then a "Manage
 * admins" row that opens the shared `TenantAdminsModal` — admin add/
 * block/unblock lives there once, instead of being duplicated here.
 */
export function TenantEditModal({ tenantId, onOpenChange }: TenantEditModalProps) {
  const open = Boolean(tenantId);
  const queryClient = useQueryClient();

  const tenantQuery = useTenant(tenantId ?? undefined);
  const licenseTypesQuery = useLicenseTypes();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingLifecycleAction>(null);
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateTenantFormValues>({ resolver: zodResolver(updateTenantSchema) });

  // Populate the form once the tenant loads, and again after every successful
  // save (the mutation's `onSuccess` below re-seeds the query cache, which
  // flows back here through `tenantQuery.data`).
  useEffect(() => {
    if (!tenantQuery.data) return;
    reset({
      name: tenantQuery.data.name,
      displayName: tenantQuery.data.displayName ?? '',
      licenseTypeId: tenantQuery.data.licenseTypeId ?? '',
      licenseValidFrom: tenantQuery.data.licenseValidFrom ?? '',
      licenseValidUntil: tenantQuery.data.licenseValidUntil ?? '',
      enforcementMode: tenantQuery.data.enforcementMode,
    });
  }, [tenantQuery.data, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateTenantFormValues) =>
      platformService.updateTenant(tenantId as string, {
        name: values.name,
        // Unlike the license/date fields below, an empty string here is a
        // meaningful, real value to send ("clear the override") rather than
        // "field not provided" — `|| undefined` would make axios drop the
        // key entirely and the backend would never learn it was cleared.
        displayName: values.displayName ?? '',
        licenseTypeId: values.licenseTypeId || null,
        licenseValidFrom: values.licenseValidFrom || null,
        licenseValidUntil: values.licenseValidUntil || null,
        enforcementMode: values.enforcementMode,
      }),
    onSuccess: (tenant) => {
      queryClient.setQueryData(PLATFORM_QUERY_KEYS.tenant(tenant.id), tenant);
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.tenants });
      setSaveError(null);
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (kind: NonNullable<PendingLifecycleAction>) =>
      kind === 'suspend'
        ? platformService.suspendTenant(tenantId as string)
        : platformService.activateTenant(tenantId as string),
    onSuccess: (tenant) => {
      queryClient.setQueryData(PLATFORM_QUERY_KEYS.tenant(tenant.id), tenant);
      queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.tenants });
      setPendingLifecycle(null);
    },
  });

  function onSubmit(values: UpdateTenantFormValues) {
    setSaveError(null);
    updateMutation.mutate(values);
  }

  const tenant = tenantQuery.data;

  function renderBody() {
    if (tenantQuery.isLoading) {
      return <Loader label="Loading business…" />;
    }
    if (tenantQuery.isError || !tenant) {
      return (
        <ErrorMessage
          message={
            tenantQuery.isError ? describeApiError(tenantQuery.error) : 'Business not found.'
          }
          onRetry={tenantQuery.isError ? () => tenantQuery.refetch() : undefined}
        />
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2.5">
          <Badge tone={toneForStatus(tenant.status)}>{statusLabel(tenant.status)}</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setPendingLifecycle(tenant.status === 'suspended' ? 'activate' : 'suspend')
            }
          >
            {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
          </Button>
        </div>

        <form
          id="tenant-edit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Input
            label="Business name"
            hint="Shown to customers and staff across the app"
            {...register('name')}
            errorMessage={errors.name?.message}
          />
          <Input
            label="Display name (optional)"
            hint="Overrides the name shown in the owner/staff UI, if different from the legal name above"
            {...register('displayName')}
            errorMessage={errors.displayName?.message}
          />
          <Controller
            name="licenseTypeId"
            control={control}
            render={({ field }) => (
              <Select
                label="License plan"
                placeholder="No plan assigned"
                hint="Controls the seat/entity limits enforced for this business"
                options={(licenseTypesQuery.data ?? []).map((plan) => ({
                  value: plan.id,
                  label: plan.isActive ? plan.name : `${plan.name} (Inactive)`,
                  // The tenant's current plan stays selectable even if it's
                  // since been deactivated — only *switching to* another
                  // inactive plan is blocked.
                  disabled: !plan.isActive && plan.id !== tenant.licenseTypeId,
                }))}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
          <Controller
            name="enforcementMode"
            control={control}
            render={({ field }) => (
              <Select
                label="Enforcement mode"
                hint="Strict blocks actions once a quota is hit; lenient only warns"
                options={[
                  { value: 'lenient', label: 'Lenient' },
                  { value: 'strict', label: 'Strict' },
                ]}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="licenseValidFrom"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Valid from"
                  hint="Blank = no start restriction"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errors.licenseValidFrom?.message}
                />
              )}
            />
            <Controller
              name="licenseValidUntil"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Valid until"
                  hint="Blank = no expiry"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errors.licenseValidUntil?.message}
                />
              )}
            />
          </div>

          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>

        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setAdminsModalOpen(true)}
            className="flex w-full items-center justify-between gap-2.5 rounded-control border border-border px-3 py-2.5 text-left hover:bg-surface"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <Users size={15} className="text-ink-faint" />
              Manage admins
            </span>
            <span className="text-xs font-semibold text-accent">Open</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={tenant?.name ?? 'Business details'}
        description={tenant?.slug}
        size="md"
        footer={
          tenant ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                form="tenant-edit-form"
                type="submit"
                isLoading={updateMutation.isPending}
                disabled={!isDirty}
              >
                Save changes
              </Button>
            </>
          ) : undefined
        }
      >
        {renderBody()}
      </Modal>

      <ConfirmDialog
        open={pendingLifecycle !== null}
        title={
          pendingLifecycle === 'suspend' ? 'Suspend this business?' : 'Activate this business?'
        }
        description={
          tenant && pendingLifecycle === 'suspend'
            ? `${tenant.name}'s staff and owner will be unable to log in until it's reactivated.`
            : tenant
              ? `${tenant.name} will regain access immediately.`
              : undefined
        }
        confirmText={pendingLifecycle === 'suspend' ? 'Suspend' : 'Activate'}
        isDestructive={pendingLifecycle === 'suspend'}
        isLoading={lifecycleMutation.isPending}
        onConfirm={() => pendingLifecycle && lifecycleMutation.mutate(pendingLifecycle)}
        onCancel={() => setPendingLifecycle(null)}
      />

      <TenantAdminsModal
        tenantId={adminsModalOpen ? tenantId : null}
        onOpenChange={(next) => setAdminsModalOpen(next)}
      />
    </>
  );
}
