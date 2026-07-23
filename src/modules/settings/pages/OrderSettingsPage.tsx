import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AlertCircle, Check, ChefHat, Hash, Loader2, UserCheck } from 'lucide-react';

import { Card, CardHeader, Input, PageHeader, Select, Switch, useToast } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import { useBusinesses } from '@/modules/businesses';

import { ORDER_RESET_PERIOD_OPTIONS, SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { useOrderSettings } from '../hooks/useOrderSettings';
import { settingsService } from '../services/settingsService';
import type { OrderSettingsFormValues } from '../validations/settings.validation';
import { orderSettingsFormSchema } from '../validations/settings.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const EMPTY_ORDER_VALUES: OrderSettingsFormValues = {
  resetPeriod: 'daily',
  numberingPrefix: '',
  numberingStart: '0001',
  customerNameRequired: true,
  customerPhoneRequired: true,
  kitchenEnabled: true,
};

/** How long to let typing/toggling settle before autosaving a field change. */
const AUTOSAVE_DEBOUNCE_MS = 700;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Per-business order configuration — a sibling of `/settings/invoices`
 * under the "Settings" sidebar group, same structure: business picker
 * (auto-picks the first business, hidden when there's only one), no Save
 * button, autosaves a short debounce after the last edit.
 *
 * Three cards: order numbering (reset period / prefix / starting number),
 * required customer fields (name/phone switches — the backend rejects
 * turning both off, mirrored here so the error surfaces without a round
 * trip), and the kitchen flow toggle (drives whether New Order shows
 * table-number/KOT fields and which order-status flow applies).
 */
export function OrderSettingsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const businessesQuery = useBusinesses();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedBusinessId) return;
    const first = businessesQuery.data?.[0];
    if (first) setSelectedBusinessId(first.id);
  }, [businessesQuery.data, selectedBusinessId]);

  const orderSettingsQuery = useOrderSettings(selectedBusinessId);

  const {
    control,
    register,
    watch,
    trigger,
    getValues,
    reset: resetForm,
    formState: { errors },
  } = useForm<OrderSettingsFormValues>({
    resolver: zodResolver(orderSettingsFormSchema),
    defaultValues: EMPTY_ORDER_VALUES,
  });

  // Baseline for "did anything actually change" — same autosave-guard
  // pattern as InvoiceSettingsPage.
  const lastSavedRef = useRef<string>(JSON.stringify(EMPTY_ORDER_VALUES));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderSettingsQuery.data) return;
    const values: OrderSettingsFormValues = {
      resetPeriod: orderSettingsQuery.data.resetPeriod,
      numberingPrefix: orderSettingsQuery.data.numberingPrefix,
      numberingStart: orderSettingsQuery.data.numberingStart,
      customerNameRequired: orderSettingsQuery.data.customerNameRequired,
      customerPhoneRequired: orderSettingsQuery.data.customerPhoneRequired,
      kitchenEnabled: orderSettingsQuery.data.kitchenEnabled,
    };
    resetForm(values);
    lastSavedRef.current = JSON.stringify(values);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
  }, [orderSettingsQuery.data, resetForm]);

  const updateMutation = useMutation({
    mutationFn: (values: OrderSettingsFormValues) => {
      if (!selectedBusinessId) return Promise.reject(new Error('No business selected'));
      return settingsService.updateOrderSettings(selectedBusinessId, values);
    },
    onSuccess: (data, values) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.orderSettings(selectedBusinessId ?? ''), data);
      lastSavedRef.current = JSON.stringify(values);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      showToast({ tone: 'success', message: 'Order settings saved.' });
    },
    onError: (error) => {
      const message = describeApiError(error);
      setSaveStatus('error');
      setSaveErrorMessage(message);
      showToast({ tone: 'danger', message });
    },
  });

  // Autosave — same watch-debounce-validate-save shape as InvoiceSettingsPage.
  useEffect(() => {
    if (!selectedBusinessId || !orderSettingsQuery.data) return;
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
  }, [selectedBusinessId, orderSettingsQuery.data, watch, trigger, getValues]);

  const businessOptions = (businessesQuery.data ?? []).map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Numbering, required fields, and kitchen flow, per business"
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
            No businesses yet — create one under Businesses first.
          </p>
        </Card>
      ) : orderSettingsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-ink-faint">Loading…</p>
        </Card>
      ) : orderSettingsQuery.isError ? (
        <Card>
          <p className="text-sm text-danger">{describeApiError(orderSettingsQuery.error)}</p>
        </Card>
      ) : orderSettingsQuery.data ? (
        <div className="flex flex-col gap-3.5">
          <Card>
            <CardHeader
              icon={Hash}
              title="Order numbering"
              subtitle="How order numbers are generated for this business"
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
                placeholder="ORD"
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
                  // Plain type="text" (not type="number") so leading zeros can
                  // actually be typed and the mouse scroll wheel never nudges
                  // the value up/down while focused — sanitize to digits-only
                  // here instead of relying on browser number-input coercion.
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
                  },
                })}
                errorMessage={errors.numberingStart?.message}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={UserCheck}
              title="Required customer fields"
              subtitle="At least one of name or phone must stay required"
            />
            <div className="flex flex-col gap-3">
              <Controller
                control={control}
                name="customerNameRequired"
                render={({ field }) => {
                  const lastOneOn = !watch('customerPhoneRequired');
                  return (
                    <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface/60 p-3.5">
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          Customer name required
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          {lastOneOn
                            ? "Phone isn't required, so name must stay required."
                            : "When off, the name field stays on New Order but isn't mandatory."}
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={lastOneOn}
                        label="Customer name required"
                      />
                    </div>
                  );
                }}
              />
              <Controller
                control={control}
                name="customerPhoneRequired"
                render={({ field }) => {
                  const lastOneOn = !watch('customerNameRequired');
                  return (
                    <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface/60 p-3.5">
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          Customer phone required
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          {lastOneOn
                            ? "Name isn't required, so phone must stay required."
                            : "When off, the phone field stays on New Order but isn't mandatory."}
                        </span>
                      </span>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={lastOneOn}
                        label="Customer phone required"
                      />
                    </div>
                  );
                }}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={ChefHat}
              title="Kitchen flow"
              subtitle="Whether this business runs KOT / kitchen display"
            />
            <Controller
              control={control}
              name="kitchenEnabled"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface/60 p-3.5">
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      This business runs a kitchen
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      When on, New Order shows the table number field and orders go through
                      KOT → preparing → ready → delivered before completion. When off, orders
                      go straight to payment.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="This business runs a kitchen"
                  />
                </div>
              )}
            />
          </Card>
        </div>
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
