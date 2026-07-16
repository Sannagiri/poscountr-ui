import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Info, RefreshCw } from 'lucide-react';

import { Button, Input, Modal, Select, Tooltip } from '@/components';

import { useLicenseTypes } from '../../hooks/useLicenseTypes';
import { generateTemporaryPassword } from '../../utils/generateTemporaryPassword';
import type { CreateTenantFormValues } from '../../validations/platform.validation';
import { createTenantSchema } from '../../validations/platform.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface CreateBusinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateTenantFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * "New business" — creates a Tenant AND its first tenant_admin in one call
 * (POSCountr/progress/04_platform_ultra_admin.md: `POST /platform/tenants/`
 * takes flat `admin_*` fields alongside the tenant fields, no separate
 * admin-creation step). One form covers both "preparing the business" and
 * "creating the admin" the ultra_admin asked for.
 */
export function CreateBusinessModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitError,
}: CreateBusinessModalProps) {
  const { data: licenseTypes } = useLicenseTypes();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTenantFormValues>({ resolver: zodResolver(createTenantSchema) });

  const slugValue = watch('slug');

  async function handleFormSubmit(values: CreateTenantFormValues) {
    await onSubmit(values);
  }

  /** Generates the deterministic password from the slug and reveals it — never re-masks. */
  function handleGenerateAndReveal() {
    if (!slugValue) return;
    setValue('adminPassword', generateTemporaryPassword(slugValue), {
      shouldValidate: true,
      shouldDirty: true,
    });
    setIsPasswordVisible(true);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="New business"
      description="Creates the tenant and its first owner login in one step."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="create-business-form" type="submit" isLoading={isSubmitting}>
            Create business
          </Button>
        </>
      }
    >
      <form
        id="create-business-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Business</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Business name"
            placeholder="Sri Lakshmi Restaurant"
            hint="Shown to customers and staff across the app"
            {...register('name')}
            errorMessage={errors.name?.message}
          />
          <Input
            label="URL slug"
            placeholder="sri-lakshmi"
            hint="Used in the staff login URL/subdomain"
            {...register('slug')}
            errorMessage={errors.slug?.message}
          />
        </div>
        <Controller
          name="licenseTypeId"
          control={control}
          render={({ field }) => (
            <Select
              label="License plan (optional)"
              placeholder="No plan assigned yet"
              hint="Can be left unassigned and added later from the tenant's detail view"
              options={(licenseTypes ?? []).map((plan) => ({
                value: plan.id,
                label: plan.isActive ? plan.name : `${plan.name} (Inactive)`,
                disabled: !plan.isActive,
              }))}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
          First owner login
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Owner email"
            type="email"
            placeholder="owner@business.com"
            hint="Doubles as the owner's login username"
            {...register('adminEmail')}
            errorMessage={errors.adminEmail?.message}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="adminPassword" className="text-xs font-medium text-ink-soft">
                Temporary password
              </label>
              <Tooltip content='Generates slug + year + "@" (e.g. "lar2026@") — easy to work out again later if forgotten.'>
                <button
                  type="button"
                  aria-label="About the temporary password format"
                  className="text-ink-faint hover:text-ink-soft"
                >
                  <Info size={12} />
                </button>
              </Tooltip>
            </div>
            <div className="relative">
              <Input
                id="adminPassword"
                type={isPasswordVisible ? 'text' : 'password'}
                placeholder="At least 8 characters"
                className="pr-9"
                {...register('adminPassword')}
                errorMessage={errors.adminPassword?.message}
              />
              {slugValue ? (
                <button
                  type="button"
                  onClick={handleGenerateAndReveal}
                  title="Generate and view the temporary password"
                  className="absolute right-2 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
                >
                  <RefreshCw size={14} />
                </button>
              ) : null}
            </div>
          </div>
          <Input label="First name" placeholder="Ravi" {...register('adminFirstName')} />
          <Input label="Last name" placeholder="Kumar" {...register('adminLastName')} />
        </div>

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
