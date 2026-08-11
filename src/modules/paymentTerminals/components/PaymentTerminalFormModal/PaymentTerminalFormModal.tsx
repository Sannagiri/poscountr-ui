import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, ErrorMessage, Input, Modal, PasswordInput, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useLocations } from '@/modules/businesses';

import {
  PAYMENT_TERMINALS_QUERY_KEYS,
  PROVIDER_OPTIONS,
} from '../../constants/paymentTerminals.constants';
import { paymentTerminalsService } from '../../services/paymentTerminalsService';
import type {
  PaymentTerminal,
  PaymentTerminalCreateRequest,
} from '../../types/paymentTerminals.types';
import type { PaymentTerminalFormValues } from '../../validations/paymentTerminals.validation';
import { paymentTerminalSchema } from '../../validations/paymentTerminals.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface PaymentTerminalFormModalProps {
  /** `null`/`undefined` closes the modal. `'create'` opens it blank for a new terminal; a `PaymentTerminal` opens it in edit mode for that one. */
  target: PaymentTerminal | 'create' | null | undefined;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful create/update, with the saved terminal. */
  onSaved?: (paymentTerminal: PaymentTerminal) => void;
}

const EMPTY_VALUES: PaymentTerminalFormValues = {
  locationId: '',
  provider: 'razorpay',
  label: '',
  mid: '',
  tid: '',
  deviceSerial: '',
  apiKey: '',
  apiSecret: '',
  webhookSecret: '',
};

function defaultValuesFor(paymentTerminal: PaymentTerminal | undefined): PaymentTerminalFormValues {
  if (!paymentTerminal) return EMPTY_VALUES;
  return {
    locationId: paymentTerminal.locationId,
    provider: paymentTerminal.provider,
    label: paymentTerminal.label,
    mid: paymentTerminal.mid,
    tid: paymentTerminal.tid,
    deviceSerial: paymentTerminal.deviceSerial,
    apiKey: paymentTerminal.apiKey,
    // Secrets are write-only server-side — always start blank on edit, never
    // pre-filled with a placeholder that could be submitted back verbatim.
    apiSecret: '',
    webhookSecret: '',
  };
}

/**
 * Create + edit, one modal — same shape `PaymentDetailFormModal` establishes.
 * `locationId`/`provider` are both real fields here, and both locked once
 * editing — the backend's own `PATCH` never accepts either (immutable after
 * creation). `isActive` isn't a field here either — `PaymentTerminalsPage`'s
 * own Deactivate/Activate row actions call the dedicated endpoints directly.
 */
export function PaymentTerminalFormModal({
  target,
  onOpenChange,
  onSaved,
}: PaymentTerminalFormModalProps) {
  const open = Boolean(target);
  const editingPaymentTerminal = target && target !== 'create' ? target : undefined;
  const isEditing = Boolean(editingPaymentTerminal);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);

  const locationsQuery = useLocations();
  const locationOptions = (locationsQuery.data ?? []).map((location) => ({
    value: location.id,
    label: `${location.name} (${location.businessName})`,
  }));

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentTerminalFormValues>({
    resolver: zodResolver(paymentTerminalSchema(isEditing)),
    defaultValues: EMPTY_VALUES,
  });

  // Resets the form each time the modal transitions from closed to open —
  // during render (not a `useEffect`) so there's no one-frame flicker of
  // stale values, same fix `PaymentDetailFormModal` applies.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSaveError(null);
      reset(defaultValuesFor(editingPaymentTerminal));
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: PaymentTerminalFormValues) => {
      if (editingPaymentTerminal) {
        return paymentTerminalsService.updatePaymentTerminal(editingPaymentTerminal.id, {
          label: values.label,
          mid: values.mid,
          tid: values.tid || '',
          deviceSerial: values.deviceSerial || '',
          apiKey: values.apiKey,
          apiSecret: values.apiSecret || undefined,
          webhookSecret: values.webhookSecret || undefined,
        });
      }
      return paymentTerminalsService.createPaymentTerminal({
        locationId: values.locationId,
        provider: values.provider,
        label: values.label,
        mid: values.mid,
        tid: values.tid || undefined,
        deviceSerial: values.deviceSerial || undefined,
        apiKey: values.apiKey,
        // Guaranteed non-empty here by `paymentTerminalSchema(false)`'s
        // superRefine (apiSecret required on create) — the `|| ''` is only
        // to satisfy the request type, not a real fallback.
        apiSecret: values.apiSecret || '',
        webhookSecret: values.webhookSecret || undefined,
      } satisfies PaymentTerminalCreateRequest);
    },
    onSuccess: (paymentTerminal) => {
      queryClient.invalidateQueries({
        queryKey: PAYMENT_TERMINALS_QUERY_KEYS.paymentTerminalsRoot,
      });
      setSaveError(null);
      showToast({
        tone: 'success',
        message: isEditing ? 'Payment terminal updated.' : 'Payment terminal registered.',
      });
      onOpenChange(false);
      onSaved?.(paymentTerminal);
    },
    onError: (error) => setSaveError(describeApiError(error)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${editingPaymentTerminal?.label}` : 'Add payment terminal'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {isEditing ? 'Close' : 'Cancel'}
          </Button>
          <Button form="payment-terminal-form" type="submit" isLoading={saveMutation.isPending}>
            {isEditing ? 'Save changes' : 'Register'}
          </Button>
        </>
      }
    >
      <form
        id="payment-terminal-form"
        onSubmit={handleSubmit((values) => saveMutation.mutateAsync(values))}
        className="flex flex-col gap-5"
      >
        {saveError ? <ErrorMessage message={saveError} /> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="locationId"
            control={control}
            render={({ field }) => (
              <Select
                label="Location"
                hint={isEditing ? "Can't change once created" : undefined}
                placeholder="Select a location"
                options={locationOptions}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                disabled={isEditing || locationsQuery.isLoading}
                errorMessage={errors.locationId?.message}
              />
            )}
          />
          <Controller
            name="provider"
            control={control}
            render={({ field }) => (
              <Select
                label="Gateway"
                hint={isEditing ? "Can't change once created" : undefined}
                options={PROVIDER_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                disabled={isEditing}
              />
            )}
          />
        </div>

        <Input
          label="Label"
          placeholder="Counter 1 EDC"
          {...register('label')}
          errorMessage={errors.label?.message}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="MID"
            hint="Merchant ID issued by the gateway for this machine"
            {...register('mid')}
            errorMessage={errors.mid?.message}
          />
          <Input label="TID (optional)" {...register('tid')} errorMessage={errors.tid?.message} />
        </div>

        <Input
          label="Device serial (optional)"
          {...register('deviceSerial')}
          errorMessage={errors.deviceSerial?.message}
        />

        <Input label="API key" {...register('apiKey')} errorMessage={errors.apiKey?.message} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordInput
            label="API secret"
            hint={isEditing ? 'Leave blank to keep the existing value' : undefined}
            placeholder={isEditing ? '••••••••' : undefined}
            {...register('apiSecret')}
            errorMessage={errors.apiSecret?.message}
          />
          <PasswordInput
            label="Webhook secret (optional)"
            hint={isEditing ? 'Leave blank to keep the existing value' : undefined}
            placeholder={isEditing ? '••••••••' : undefined}
            {...register('webhookSecret')}
            errorMessage={errors.webhookSecret?.message}
          />
        </div>
      </form>
    </Modal>
  );
}
