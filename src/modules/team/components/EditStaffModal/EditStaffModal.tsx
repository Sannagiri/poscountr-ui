import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Input, Modal, Select } from '@/components';

import { useLocations } from '@/modules/businesses';

import { STAFF_ROLE_OPTIONS } from '../../constants/team.constants';
import { useStaffUsernameAvailability } from '../../hooks/useStaffUsernameAvailability';
import type { TeamMember } from '../../types/team.types';
import type { UpdateStaffFormValues } from '../../validations/team.validation';
import { updateStaffSchema } from '../../validations/team.validation';
import { UsernameAvailabilityHint } from '../UsernameAvailabilityHint';

import { zodResolver } from '@hookform/resolvers/zod';

export interface EditStaffModalProps {
  /** `null`/`undefined` closes the modal — a truthy member opens it for that staff member. */
  member: TeamMember | null | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UpdateStaffFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Edit an existing staff member's role, username, name, and location — the
 * create-time fields `AddStaffModal` collects, now editable after the fact.
 * Same location rule as `AddStaffModal`/`TeamService._resolve_staff_location`
 * (hidden with 0 locations, a fixed auto-assign note with exactly 1,
 * required dropdown with 2+); no "unassign" option here either, matching
 * `AssignLocationModal` — reassign, don't clear.
 *
 * A staff member already assigned to a location that's since been
 * deactivated would otherwise show a blank Select (its current value has no
 * matching option once filtered to active-only) — the current assignment is
 * synthesized into the option list in that case so editing something else
 * doesn't silently drop it.
 *
 * Same live username available/taken message and submit-disable as
 * `AddStaffModal` (`useStaffUsernameAvailability`) — the one difference is
 * this excludes the member's own id from the check, so re-saving the form
 * without touching the username doesn't flag itself as a collision. This is
 * also how a deactivated staff member whose username got reactivated-away
 * (see `TeamService.set_staff_active`'s collision guard) gets rescued: Edit
 * flags the new owner's username as taken immediately, before the person
 * even hits Save, let alone the Activate confirm.
 */
export function EditStaffModal({
  member,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitError,
}: EditStaffModalProps) {
  const open = Boolean(member);
  const locationsQuery = useLocations();

  const activeLocations = useMemo(
    () => (locationsQuery.data ?? []).filter((location) => location.isActive),
    [locationsQuery.data],
  );
  const requireLocation = activeLocations.length > 1;
  const soleLocation = activeLocations.length === 1 ? activeLocations[0] : undefined;

  const locationOptions = useMemo(() => {
    const options = activeLocations.map((location) => ({
      value: location.id,
      label: `${location.name} — ${location.businessName}`,
    }));
    if (
      member?.assignedLocationId &&
      !options.some((option) => option.value === member.assignedLocationId)
    ) {
      options.push({
        value: member.assignedLocationId,
        label: `${member.assignedLocationName ?? 'Current location'} (inactive)`,
      });
    }
    return options;
  }, [activeLocations, member?.assignedLocationId, member?.assignedLocationName]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateStaffFormValues>({
    resolver: zodResolver(updateStaffSchema(requireLocation)),
    defaultValues: { role: 'manager', username: '', firstName: '', lastName: '', locationId: '' },
  });

  // Excludes this member's own row — re-saving without changing the
  // username shouldn't flag itself as "taken".
  const usernameAvailability = useStaffUsernameAvailability(watch('username'), member?.id);

  useEffect(() => {
    if (!open || !member) return;
    reset({
      role: member.role === 'kitchen_staff' ? 'kitchen_staff' : 'manager',
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      locationId: member.assignedLocationId ?? soleLocation?.id ?? '',
    });
    // `soleLocation` intentionally left out — same reasoning as
    // `AddStaffModal`'s identical effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member, reset]);

  async function handleFormSubmit(values: UpdateStaffFormValues) {
    await onSubmit({
      ...values,
      locationId: values.locationId || soleLocation?.id || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Edit staff — ${member.firstName || member.username}` : 'Edit staff'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            form="edit-staff-form"
            type="submit"
            isLoading={isSubmitting}
            disabled={usernameAvailability === 'taken'}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-staff-form"
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

        <div className="flex flex-col gap-1.5">
          <Input
            label="Username"
            placeholder="ravi.k"
            hint="Lowercase letters, digits, '.', '_' or '-' — used to log in on the PIN pad"
            {...register('username')}
            errorMessage={errors.username?.message}
          />
          {!errors.username ? <UsernameAvailabilityHint status={usernameAvailability} /> : null}
        </div>

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
                options={locationOptions}
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
