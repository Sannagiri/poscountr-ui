import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Modal } from '@/components';

import type { Location } from '../../types/businesses.types';
import type { LocationFormValues } from '../../validations/businesses.validation';
import { locationSchema } from '../../validations/businesses.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface LocationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed for the lifetime of this modal — a location's parent business is set at creation and never changed. */
  businessId: string;
  /** Present when editing an existing location — absent when adding a new one. */
  location?: Location;
  onSubmit: (values: LocationFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Add/edit form for one location under a fixed business, opened from
 * `LocationsModal`. `businessId` is carried in the form's values (the
 * schema requires it, mirroring `LocationInputSerializer`) but never shown
 * or made editable — the backend's own update path
 * (`LocationService._EDITABLE`) only ever touches name/address/phone.
 */
export function LocationFormModal({
  open,
  onOpenChange,
  businessId,
  location,
  onSubmit,
  isSubmitting,
  submitError,
}: LocationFormModalProps) {
  const isEditing = Boolean(location);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { businessId, name: '', address: '', phone: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      location
        ? { businessId, name: location.name, address: location.address, phone: location.phone }
        : { businessId, name: '', address: '', phone: '' },
    );
  }, [open, location, businessId, reset]);

  async function handleFormSubmit(values: LocationFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit location' : 'Add location'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="location-form" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Add location'}
          </Button>
        </>
      }
    >
      <form
        id="location-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Location name"
          placeholder="LB Nagar"
          {...register('name')}
          errorMessage={errors.name?.message}
        />
        <Input
          label="Address (optional)"
          placeholder="12-3-45, LB Nagar, Hyderabad"
          {...register('address')}
        />
        <Input label="Phone (optional)" placeholder="9876543210" {...register('phone')} />
        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
