import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, ErrorMessage, Input, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useBusinesses } from '@/modules/businesses';

import {
  PAYMENT_DETAIL_TYPE_OPTIONS,
  PAYMENT_DETAILS_QUERY_KEYS,
} from '../../constants/paymentDetails.constants';
import { paymentDetailsService } from '../../services/paymentDetailsService';
import type { PaymentDetail, PaymentDetailCreateRequest } from '../../types/paymentDetails.types';
import type { PaymentDetailFormValues } from '../../validations/paymentDetails.validation';
import { paymentDetailSchema } from '../../validations/paymentDetails.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface PaymentDetailFormModalProps {
  /** `null`/`undefined` closes the modal. `'create'` opens it blank for a new payment detail; a `PaymentDetail` opens it in edit mode for that one. */
  target: PaymentDetail | 'create' | null | undefined;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful create/update, with the saved payment detail. */
  onSaved?: (paymentDetail: PaymentDetail) => void;
}

const EMPTY_VALUES: PaymentDetailFormValues = {
  businessId: '',
  detailType: 'bank',
  label: '',
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branch: '',
  upiId: '',
  upiName: '',
};

function defaultValuesFor(paymentDetail: PaymentDetail | undefined): PaymentDetailFormValues {
  if (!paymentDetail) return EMPTY_VALUES;
  return {
    businessId: paymentDetail.businessId,
    detailType: paymentDetail.detailType,
    label: paymentDetail.label,
    accountHolderName: paymentDetail.accountHolderName,
    bankName: paymentDetail.bankName,
    accountNumber: paymentDetail.accountNumber,
    ifscCode: paymentDetail.ifscCode,
    branch: paymentDetail.branch,
    upiId: paymentDetail.upiId,
    upiName: paymentDetail.upiName,
  };
}

/**
 * Create + edit, one modal — same shape `SupplierFormModal` establishes
 * (POST and PATCH share one input shape, PATCH just partial). `detailType`
 * and `businessId` are both real fields here, and both locked once editing —
 * the backend's own `PATCH` never accepts either (immutable after creation),
 * so both pickers are disabled rather than silently ignored. `isActive`
 * isn't a field here either — `PaymentDetailsPage`'s own Deactivate/Activate
 * row actions call the dedicated activate/deactivate endpoints directly,
 * same "toggle is its own row action" split `SupplierFormModal` documents
 * for `Supplier.isActive`.
 */
export function PaymentDetailFormModal({
  target,
  onOpenChange,
  onSaved,
}: PaymentDetailFormModalProps) {
  const open = Boolean(target);
  const editingPaymentDetail = target && target !== 'create' ? target : undefined;
  const isEditing = Boolean(editingPaymentDetail);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);

  const businessesQuery = useBusinesses();
  const businessOptions = (businessesQuery.data ?? []).map((business) => ({
    value: business.id,
    label: business.name,
  }));

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentDetailFormValues>({
    resolver: zodResolver(paymentDetailSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Resets the form each time the modal transitions from closed to open —
  // during render (not a `useEffect`) so there's no one-frame flicker of
  // stale values, same fix `SupplierFormModal`/`ProductFormModal` apply.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSaveError(null);
      reset(defaultValuesFor(editingPaymentDetail));
    }
  }

  const detailType = watch('detailType');

  const saveMutation = useMutation({
    mutationFn: async (values: PaymentDetailFormValues) => {
      const shared = {
        label: values.label,
        accountHolderName: values.accountHolderName || undefined,
        bankName: values.bankName || undefined,
        accountNumber: values.accountNumber || undefined,
        ifscCode: values.ifscCode || undefined,
        branch: values.branch || undefined,
        upiId: values.upiId || undefined,
        upiName: values.upiName || undefined,
      };

      if (editingPaymentDetail) {
        return paymentDetailsService.updatePaymentDetail(editingPaymentDetail.id, shared);
      }
      return paymentDetailsService.createPaymentDetail({
        ...shared,
        businessId: values.businessId,
        detailType: values.detailType,
      } satisfies PaymentDetailCreateRequest);
    },
    onSuccess: (paymentDetail) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_DETAILS_QUERY_KEYS.paymentDetailsRoot });
      setSaveError(null);
      showToast({
        tone: 'success',
        message: isEditing ? 'Payment detail updated.' : 'Payment detail created.',
      });
      onOpenChange(false);
      onSaved?.(paymentDetail);
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${editingPaymentDetail?.label}` : 'Add payment detail'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {isEditing ? 'Close' : 'Cancel'}
          </Button>
          <Button form="payment-detail-form" type="submit" isLoading={saveMutation.isPending}>
            {isEditing ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="payment-detail-form"
        onSubmit={handleSubmit((values) => saveMutation.mutateAsync(values))}
        className="flex flex-col gap-5"
      >
        {saveError ? <ErrorMessage message={saveError} /> : null}

        <Controller
          name="businessId"
          control={control}
          render={({ field }) => (
            <Select
              label="Business"
              hint={isEditing ? "Can't change once created" : undefined}
              placeholder="Select a business"
              options={businessOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              disabled={isEditing || businessesQuery.isLoading}
              errorMessage={errors.businessId?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="detailType"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                hint={isEditing ? "Can't change once created" : undefined}
                options={PAYMENT_DETAIL_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                disabled={isEditing}
              />
            )}
          />
          <Input
            label="Label"
            placeholder="Primary current account"
            {...register('label')}
            errorMessage={errors.label?.message}
          />
        </div>

        {detailType === 'bank' ? (
          <>
            <Input
              label="Account holder name (optional)"
              {...register('accountHolderName')}
              errorMessage={errors.accountHolderName?.message}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Bank name"
                placeholder="HDFC Bank"
                {...register('bankName')}
                errorMessage={errors.bankName?.message}
              />
              <Input
                label="Account number"
                {...register('accountNumber')}
                errorMessage={errors.accountNumber?.message}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="IFSC code"
                placeholder="HDFC0001234"
                {...register('ifscCode')}
                errorMessage={errors.ifscCode?.message}
              />
              <Input
                label="Branch (optional)"
                {...register('branch')}
                errorMessage={errors.branch?.message}
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="UPI ID"
              placeholder="business@upi"
              {...register('upiId')}
              errorMessage={errors.upiId?.message}
            />
            <Input
              label="Payee name (optional)"
              {...register('upiName')}
              errorMessage={errors.upiName?.message}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
