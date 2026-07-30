import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AlertCircle, Check, Hash, Loader2 } from 'lucide-react';

import { Card, CardHeader, Input, PageHeader, Select, useToast } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import { isPurchasingEntityType, useBusinesses } from '@/modules/businesses';

import { ORDER_RESET_PERIOD_OPTIONS, SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { usePurchaseSettings } from '../hooks/usePurchaseSettings';
import { settingsService } from '../services/settingsService';
import type { PurchaseSettingsFormValues } from '../validations/settings.validation';
import { purchaseSettingsFormSchema } from '../validations/settings.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const EMPTY_VALUES: PurchaseSettingsFormValues = {
  resetPeriod: 'daily',
  numberingPrefix: '',
  numberingStart: '0001',
};

const AUTOSAVE_DEBOUNCE_MS = 700;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Per-business purchase-order numbering configuration — a sibling of
 * `/settings/orders` under the "Settings" sidebar group, same structure
 * (business picker, no Save button, short-debounce autosave), but only one
 * card: numbering. There's no customer-required or kitchen-flow equivalent
 * here, since a purchase order has neither.
 *
 * The business picker only offers a retail/pharmacy/grocery business
 * (`isPurchasingEntityType`) — a restaurant/cafe never has purchase orders,
 * so it never has purchase settings to configure either.
 */
export function PurchaseSettingsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const businessesQuery = useBusinesses();
  const purchasingBusinesses = useMemo(
    () => (businessesQuery.data ?? []).filter((business) => isPurchasingEntityType(business.entityType)),
    [businessesQuery.data],
  );
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedBusinessId) return;
    const first = purchasingBusinesses[0];
    if (first) setSelectedBusinessId(first.id);
  }, [purchasingBusinesses, selectedBusinessId]);

  const purchaseSettingsQuery = usePurchaseSettings(selectedBusinessId);

  const {
    control,
    register,
    watch,
    trigger,
    getValues,
    reset: resetForm,
    formState: { errors },
  } = useForm<PurchaseSettingsFormValues>({
    resolver: zodResolver(purchaseSettingsFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const lastSavedRef = useRef<string>(JSON.stringify(EMPTY_VALUES));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseSettingsQuery.data) return;
    const values: PurchaseSettingsFormValues = {
      resetPeriod: purchaseSettingsQuery.data.resetPeriod,
      numberingPrefix: purchaseSettingsQuery.data.numberingPrefix,
      numberingStart: purchaseSettingsQuery.data.numberingStart,
    };
    resetForm(values);
    lastSavedRef.current = JSON.stringify(values);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
  }, [purchaseSettingsQuery.data, resetForm]);

  const updateMutation = useMutation({
    mutationFn: (values: PurchaseSettingsFormValues) => {
      if (!selectedBusinessId) return Promise.reject(new Error('No business selected'));
      return settingsService.updatePurchaseSettings(selectedBusinessId, values);
    },
    onSuccess: (data, values) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.purchaseSettings(selectedBusinessId ?? ''), data);
      lastSavedRef.current = JSON.stringify(values);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      showToast({ tone: 'success', message: 'Purchase order settings saved.' });
    },
    onError: (error) => {
      const message = describeApiError(error);
      setSaveStatus('error');
      setSaveErrorMessage(message);
      showToast({ tone: 'danger', message });
    },
  });

  useEffect(() => {
    if (!selectedBusinessId || !purchaseSettingsQuery.data) return;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const subscription = watch(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const isValid = await trigger();
        if (!isValid) return;
        const values = getValues();
        const serialized = JSON.stringify(values);
        if (serialized === lastSavedRef.current) return;
        setSaveStatus('saving');
        updateMutation.mutate(values);
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, purchaseSettingsQuery.data, watch, trigger, getValues]);

  const businessOptions = purchasingBusinesses.map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        subtitle="Numbering, per retail/pharmacy/grocery business"
        actions={
          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={saveStatus} errorMessage={saveErrorMessage} />
            {businessOptions.length > 1 ? (
              <Select
                className="w-auto min-w-[11rem]"
                value={selectedBusinessId}
                onChange={setSelectedBusinessId}
                options={businessOptions}
              />
            ) : null}
          </div>
        }
      />

      {!selectedBusinessId ? (
        <Card>
          <p className="text-sm text-ink-faint">
            No retail/pharmacy/grocery businesses yet — a restaurant/cafe business has no purchase
            orders to configure.
          </p>
        </Card>
      ) : purchaseSettingsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-ink-faint">Loading…</p>
        </Card>
      ) : purchaseSettingsQuery.isError ? (
        <Card>
          <p className="text-sm text-danger">{describeApiError(purchaseSettingsQuery.error)}</p>
        </Card>
      ) : purchaseSettingsQuery.data ? (
        <Card>
          <CardHeader
            icon={Hash}
            title="Purchase order numbering"
            subtitle="How purchase order numbers are generated for this business"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Controller
              name="resetPeriod"
              control={control}
              render={({ field }) => (
                <Select
                  label="Resets"
                  options={ORDER_RESET_PERIOD_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Input
              label="Numbering prefix (optional)"
              placeholder="PO"
              {...register('numberingPrefix')}
              errorMessage={errors.numberingPrefix?.message}
            />
            <Input
              label="Starting number"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0001"
              hint="Leading zeros set the padding width — e.g. 0001 → 4 digits"
              {...register('numberingStart', {
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
                },
              })}
              errorMessage={errors.numberingStart?.message}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function SaveStatusIndicator({
  status,
  errorMessage,
}: {
  status: SaveStatus;
  errorMessage: string | null;
}) {
  if (status === 'idle') return null;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
        status === 'error' ? 'text-danger' : 'text-ink-faint',
      )}
    >
      {status === 'saving' ? (
        <>
          <Loader2 size={13} className="animate-spin" />
          Saving…
        </>
      ) : status === 'saved' ? (
        <>
          <Check size={13} className="text-success-text" />
          All changes saved
        </>
      ) : (
        <>
          <AlertCircle size={13} />
          {errorMessage ?? 'Could not save'}
        </>
      )}
    </span>
  );
}
