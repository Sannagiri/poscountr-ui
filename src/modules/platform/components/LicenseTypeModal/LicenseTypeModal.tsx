import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Info } from 'lucide-react';

import { Button, Input, Modal, Select, Tooltip } from '@/components';

import type { LicenseType } from '../../types/platform.types';
import type { LicenseTypeFormValues } from '../../validations/platform.validation';
import { licenseTypeSchema } from '../../validations/platform.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface LicenseTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing plan — absent when creating a new one. */
  licenseType?: LicenseType;
  onSubmit: (values: LicenseTypeFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

const EMPTY_VALUES: LicenseTypeFormValues = {
  name: '',
  code: '',
  description: '',
  price: '',
  defaultEnforcementMode: 'lenient',
  isActive: true,
  maxTenantAdmins: 1,
  maxManagers: 0,
  maxKitchenStaff: 0,
  maxBusinessEntities: 1,
  maxLocations: 1,
  maxProducts: 100,
};

/**
 * Create/edit form for one license plan — one modal handles both, switching
 * on whether `licenseType` was passed in (mirrors the backend: POST and
 * PATCH share the same `LicenseTypeInputSerializer` shape, PATCH just
 * partial). No field for `maxMonthlyTransactions` — it's on the backend
 * model but not exposed by its input serializer, so a field here would
 * silently do nothing.
 */
export function LicenseTypeModal({
  open,
  onOpenChange,
  licenseType,
  onSubmit,
  isSubmitting,
  submitError,
}: LicenseTypeModalProps) {
  const isEditing = Boolean(licenseType);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LicenseTypeFormValues>({
    resolver: zodResolver(licenseTypeSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      licenseType
        ? {
            name: licenseType.name,
            code: licenseType.code,
            description: licenseType.description,
            price: licenseType.price,
            defaultEnforcementMode: licenseType.defaultEnforcementMode,
            isActive: licenseType.isActive,
            maxTenantAdmins: licenseType.maxTenantAdmins,
            maxManagers: licenseType.maxManagers,
            maxKitchenStaff: licenseType.maxKitchenStaff,
            maxBusinessEntities: licenseType.maxBusinessEntities,
            maxLocations: licenseType.maxLocations,
            maxProducts: licenseType.maxProducts,
          }
        : EMPTY_VALUES,
    );
  }, [open, licenseType, reset]);

  async function handleFormSubmit(values: LicenseTypeFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit license plan' : 'New license plan'}
      description="The seat and entity limits enforced for every business on this plan."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="license-type-form" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <form
        id="license-type-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Plan name"
            placeholder="Pro"
            {...register('name')}
            errorMessage={errors.name?.message}
          />
          <Input
            label="Code"
            placeholder="pro-monthly"
            hint="Short unique identifier used internally, never shown to tenants"
            {...register('code')}
            errorMessage={errors.code?.message}
          />
        </div>
        <Input
          label="Description (optional)"
          placeholder="For growing multi-location businesses"
          {...register('description')}
          errorMessage={errors.description?.message}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Price"
            placeholder="49.99"
            hint="Monthly price shown to the business, e.g. 49.99"
            {...register('price')}
            errorMessage={errors.price?.message}
          />
          <Controller
            name="defaultEnforcementMode"
            control={control}
            render={({ field }) => (
              <Select
                label="Default enforcement mode"
                hint="What a new business on this plan starts with — can be overridden per business later"
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
        </div>
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Select
              label="Status"
              hint="Inactive plans can't be assigned to new businesses, but tenants already on it keep working"
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={field.value ? 'true' : 'false'}
              onChange={(value) => field.onChange(value === 'true')}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Seat &amp; entity limits
            </p>
            <Tooltip content="Set any limit to 0 to disable that role or resource entirely for this plan.">
              <button
                type="button"
                aria-label="About seat and entity limits"
                className="text-ink-faint hover:text-ink-soft"
              >
                <Info size={12} />
              </button>
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Input
              type="number"
              label="Admins"
              className="h-8 text-sm"
              {...register('maxTenantAdmins')}
              errorMessage={errors.maxTenantAdmins?.message}
            />
            <Input
              type="number"
              label="Managers"
              className="h-8 text-sm"
              {...register('maxManagers')}
              errorMessage={errors.maxManagers?.message}
            />
            <Input
              type="number"
              label="Kitchen staff"
              className="h-8 text-sm"
              {...register('maxKitchenStaff')}
              errorMessage={errors.maxKitchenStaff?.message}
            />
            <Input
              type="number"
              label="Entities"
              className="h-8 text-sm"
              {...register('maxBusinessEntities')}
              errorMessage={errors.maxBusinessEntities?.message}
            />
            <Input
              type="number"
              label="Locations"
              className="h-8 text-sm"
              {...register('maxLocations')}
              errorMessage={errors.maxLocations?.message}
            />
            <Input
              type="number"
              label="Products"
              className="h-8 text-sm"
              {...register('maxProducts')}
              errorMessage={errors.maxProducts?.message}
            />
          </div>
        </div>

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
