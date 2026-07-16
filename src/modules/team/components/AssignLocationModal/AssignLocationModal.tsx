import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Modal, Select } from '@/components';

import type { Location } from '@/modules/businesses';

import type { TeamMember } from '../../types/team.types';
import type { AssignLocationFormValues } from '../../validations/team.validation';
import { assignLocationSchema } from '../../validations/team.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface AssignLocationModalProps {
  /** `null`/`undefined` closes the modal — a truthy member opens it for that staff member. */
  member: TeamMember | null | undefined;
  locations: Location[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AssignLocationFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Pin (or move) a staff member to a location — the standalone counterpart
 * to `AddStaffModal`'s own location field, for reassigning someone after
 * they already exist (e.g. a manager transferring between outlets). Only
 * active locations are offered, same as `AddStaffModal`.
 */
export function AssignLocationModal({
  member,
  locations,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitError,
}: AssignLocationModalProps) {
  const open = Boolean(member);
  const activeLocations = locations.filter((location) => location.isActive);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignLocationFormValues>({
    resolver: zodResolver(assignLocationSchema),
    defaultValues: { locationId: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ locationId: member?.assignedLocationId ?? '' });
  }, [open, member, reset]);

  async function handleFormSubmit(values: AssignLocationFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Assign location — ${member.firstName || member.username}` : 'Assign location'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="assign-location-form" type="submit" isLoading={isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="assign-location-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Controller
          name="locationId"
          control={control}
          render={({ field }) => (
            <Select
              label="Location"
              placeholder="Choose a location"
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

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
