import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, ErrorMessage, Input, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { INDIAN_STATE_OPTIONS } from '@/modules/businesses';

import { purchasingService } from '../../services/purchasingService';
import type { Supplier, SupplierRequest } from '../../types/purchasing.types';
import type { SupplierFormValues } from '../../validations/purchasing.validation';
import { supplierSchema } from '../../validations/purchasing.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface SupplierFormModalProps {
  /** `null`/`undefined` closes the modal. `'create'` opens it blank for a new supplier; a `Supplier` opens it in edit mode for that one. */
  target: Supplier | 'create' | null | undefined;
  /** Which business a new supplier belongs to — resolved by the caller (`SuppliersPage`, via `ChooseBusinessModal` for a tenant_admin) before this opens in create mode. Omitted for a manager, whose own business is forced server-side regardless of what's sent. Ignored once editing. */
  businessId?: string;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful create/update, with the saved supplier — lets a caller like `NewPurchaseOrderPage` auto-select a freshly-created supplier in its own form instead of the user having to find and pick it again. */
  onSaved?: (supplier: Supplier) => void;
}

const EMPTY_VALUES: SupplierFormValues = {
  name: '',
  phone: '',
  email: '',
  gstin: '',
  state: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  pincode: '',
};

function defaultValuesFor(supplier: Supplier | undefined): SupplierFormValues {
  if (!supplier) return EMPTY_VALUES;
  return {
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    gstin: supplier.gstin,
    state: supplier.state,
    addressLine1: supplier.addressLine1,
    addressLine2: supplier.addressLine2,
    city: supplier.city,
    pincode: supplier.pincode,
  };
}

/**
 * Create + edit, one modal — same shape `ProductFormModal`/`BusinessEditModal`
 * establish (POST and PATCH share one input shape, PATCH just partial).
 * `isActive` isn't a field here — same "toggle is its own row action, not a
 * form field" split those two use — `SuppliersPage`'s own Deactivate/
 * Activate row actions call `updateSupplier` directly with just that one
 * field, there's no dedicated activate/deactivate endpoint to call instead
 * (unlike `Product`'s).
 */
export function SupplierFormModal({ target, businessId, onOpenChange, onSaved }: SupplierFormModalProps) {
  const open = Boolean(target);
  const editingSupplier = target && target !== 'create' ? target : undefined;
  const isEditing = Boolean(editingSupplier);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Resets the form each time the modal transitions from closed to open —
  // during render (not a `useEffect`) so there's no one-frame flicker of
  // stale values, same fix `ProductFormModal`/`LocationsModal` already apply.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSaveError(null);
      reset(defaultValuesFor(editingSupplier));
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      const shared = {
        name: values.name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        gstin: values.gstin || undefined,
        state: values.state || undefined,
        addressLine1: values.addressLine1 || undefined,
        addressLine2: values.addressLine2 || undefined,
        city: values.city || undefined,
        pincode: values.pincode || undefined,
      } satisfies Partial<SupplierRequest>;

      if (editingSupplier) {
        return purchasingService.updateSupplier(editingSupplier.id, shared);
      }
      return purchasingService.createSupplier({ ...shared, businessId });
    },
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
      setSaveError(null);
      showToast({ tone: 'success', message: isEditing ? 'Supplier updated.' : 'Supplier created.' });
      onOpenChange(false);
      onSaved?.(supplier);
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${editingSupplier?.name}` : 'Add supplier'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {isEditing ? 'Close' : 'Cancel'}
          </Button>
          <Button form="supplier-form" type="submit" isLoading={saveMutation.isPending}>
            {isEditing ? 'Save changes' : 'Create supplier'}
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
        onSubmit={handleSubmit((values) => saveMutation.mutateAsync(values))}
        className="flex flex-col gap-5"
      >
        {saveError ? <ErrorMessage message={saveError} /> : null}

        <Input label="Supplier name" {...register('name')} errorMessage={errors.name?.message} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Phone (optional)"
            placeholder="9876543210"
            {...register('phone')}
            errorMessage={errors.phone?.message}
          />
          <Input
            label="Email (optional)"
            placeholder="orders@supplier.com"
            {...register('email')}
            errorMessage={errors.email?.message}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="GSTIN (optional)"
            placeholder="29ABCDE1234F1Z5"
            hint="15 characters — leave blank if not registered"
            {...register('gstin')}
            errorMessage={errors.gstin?.message}
          />
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Select
                label="State (optional)"
                placeholder="Choose a state"
                options={INDIAN_STATE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Address (optional)"
            placeholder="12-3-45, Main Road"
            {...register('addressLine1')}
            errorMessage={errors.addressLine1?.message}
          />
          <Input
            label="Address extra (optional)"
            placeholder="Near Metro Station, opposite ABC Mall"
            {...register('addressLine2')}
            errorMessage={errors.addressLine2?.message}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="City (optional)" placeholder="Hyderabad" {...register('city')} errorMessage={errors.city?.message} />
          <Input
            label="PIN code (optional)"
            placeholder="500074"
            {...register('pincode')}
            errorMessage={errors.pincode?.message}
          />
        </div>
      </form>
    </Modal>
  );
}
