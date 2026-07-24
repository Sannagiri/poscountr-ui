import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Input, Modal, Select } from '@/components';

import { INDIAN_STATE_OPTIONS } from '../../constants/businesses.constants';
import type { BusinessEntity } from '../../types/businesses.types';
import type { BusinessFormValues } from '../../validations/businesses.validation';
import { businessSchema } from '../../validations/businesses.validation';
import { EntityTypePicker } from '../EntityTypePicker';

import { zodResolver } from '@hookform/resolvers/zod';

export interface BusinessEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing business — absent when creating a new one. */
  business?: BusinessEntity;
  onSubmit: (values: BusinessFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

const EMPTY_VALUES: BusinessFormValues = {
  name: '',
  entityType: 'restaurant',
  gstin: '',
  phone: '',
  state: '',
};

/**
 * Create/edit form for one business — one modal handles both, switching on
 * whether `business` was passed in (mirrors the backend: POST and PATCH
 * share the same `BusinessEntityInputSerializer` shape, PATCH just
 * partial). Active/inactive isn't a field here — that's the card's own
 * Deactivate/Activate button (a dedicated endpoint), matching
 * `TenantEditModal`'s split rather than `LicenseTypeModal`'s (which folds
 * status into its form, since the license's soft-delete shares the license
 * PATCH endpoint instead of having its own activate/deactivate routes).
 */
export function BusinessEditModal({
  open,
  onOpenChange,
  business,
  onSubmit,
  isSubmitting,
  submitError,
}: BusinessEditModalProps) {
  const isEditing = Boolean(business);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      business
        ? {
            name: business.name,
            entityType: business.entityType,
            gstin: business.gstin ?? '',
            phone: business.phone,
            state: business.state,
          }
        : EMPTY_VALUES,
    );
  }, [open, business, reset]);

  async function handleFormSubmit(values: BusinessFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit business' : 'New business'}
      description="A business (operating entity) under your account — add its locations afterward."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="business-form" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save changes' : 'Create business'}
          </Button>
        </>
      }
    >
      <form
        id="business-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Business name"
          placeholder="Sri Lakshmi Restaurant"
          {...register('name')}
          errorMessage={errors.name?.message}
        />

        <Controller
          name="entityType"
          control={control}
          render={({ field }) => (
            <EntityTypePicker
              value={field.value}
              onChange={field.onChange}
              errorMessage={errors.entityType?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="GSTIN (optional)"
            placeholder="29ABCDE1234F1Z5"
            hint="15 characters — leave blank if not registered yet"
            {...register('gstin')}
            errorMessage={errors.gstin?.message}
          />
          <Input label="Phone (optional)" placeholder="9876543210" {...register('phone')} />
        </div>

        <Controller
          name="state"
          control={control}
          render={({ field }) => (
            <Select
              label="State (optional)"
              hint="Required before a GST invoice/bill can be generated for this business's orders"
              placeholder="Choose a state"
              options={INDIAN_STATE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
