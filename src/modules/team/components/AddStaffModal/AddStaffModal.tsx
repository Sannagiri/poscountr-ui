import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Input, Modal, Select } from '@/components';

import { useLocations } from '@/modules/businesses';

import { STAFF_ROLE_OPTIONS } from '../../constants/team.constants';
import type { AddStaffFormValues } from '../../validations/team.validation';
import { addStaffSchema } from '../../validations/team.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface AddStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddStaffFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

const EMPTY_VALUES: AddStaffFormValues = {
  role: 'manager',
  username: '',
  firstName: '',
  lastName: '',
  locationId: '',
};

/**
 * Add a manager or kitchen_staff — username + PIN auth, starting on the
 * default PIN (000000, forced change on first login — the caller opens
 * `StaffCredentialModal` right after this succeeds to actually hand that
 * off).
 *
 * The location field follows the backend's own staff-location rule
 * (`TeamService._resolve_staff_location`) exactly, driven by how many
 * *active* locations this tenant has:
 *   - 0 locations  → field hidden entirely (nothing to assign to yet).
 *   - 1 location   → field hidden, a fixed note shown instead — the
 *     backend auto-assigns the only location either way, so a dropdown
 *     with a single option would be pure friction.
 *   - 2+ locations → a required dropdown; the backend rejects the create
 *     outright if this is left empty, and `addStaffSchema(true)` mirrors
 *     that client-side.
 */
export function AddStaffModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitError,
}: AddStaffModalProps) {
  const locationsQuery = useLocations();
  const activeLocations = useMemo(
    () => (locationsQuery.data ?? []).filter((location) => location.isActive),
    [locationsQuery.data],
  );
  const requireLocation = activeLocations.length > 1;
  const soleLocation = activeLocations.length === 1 ? activeLocations[0] : undefined;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddStaffFormValues>({
    resolver: zodResolver(addStaffSchema(requireLocation)),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset({ ...EMPTY_VALUES, locationId: soleLocation?.id ?? '' });
    // `soleLocation` intentionally left out of the dependency array — it's
    // derived from `locationsQuery.data`, already loaded by the time this
    // modal can be opened (the page fetches locations up front). Depending
    // on it here would reset the form mid-edit if that query ever refetches
    // while the modal happens to be open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  async function handleFormSubmit(values: AddStaffFormValues) {
    await onSubmit({
      ...values,
      locationId: values.locationId || soleLocation?.id || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add staff"
      description="Starts on the default PIN (000000) — must be changed on first login."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="add-staff-form" type="submit" isLoading={isSubmitting}>
            Add staff
          </Button>
        </>
      }
    >
      <form
        id="add-staff-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select
              label="Role"
              options={STAFF_ROLE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        <Input
          label="Username"
          placeholder="ravi.k"
          hint="Lowercase letters, digits, '.', '_' or '-' — used to log in on the PIN pad"
          {...register('username')}
          errorMessage={errors.username?.message}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" placeholder="Ravi" {...register('firstName')} />
          <Input label="Last name" placeholder="Kumar" {...register('lastName')} />
        </div>

        {requireLocation ? (
          <Controller
            name="locationId"
            control={control}
            render={({ field }) => (
              <Select
                label="Location"
                placeholder="Choose a location"
                hint="This tenant has more than one location — pick which one this staff member works at"
                options={activeLocations.map((location) => ({
                  value: location.id,
                  label: `${location.name} — ${location.businessName}`,
                }))}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                errorMessage={errors.locationId?.message}
              />
            )}
          />
        ) : soleLocation ? (
          <p className="text-xs text-ink-faint">
            Auto-assigned to{' '}
            <span className="font-semibold text-ink-soft">{soleLocation.name}</span> — the only
            location on this account.
          </p>
        ) : (
          <p className="text-xs text-ink-faint">
            No locations yet — add one first (Businesses &amp; Locations) to assign this staff
            member to it.
          </p>
        )}

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
