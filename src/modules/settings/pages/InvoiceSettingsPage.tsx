import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AlertCircle, Check, FileText, Loader2, Palette, ShieldCheck } from 'lucide-react';

import { Card, CardHeader, Input, PageHeader, Select, Switch } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import { useBusinesses } from '@/modules/businesses';

import { InvoiceLogoField } from '../components/InvoiceLogoField';
import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { useInvoiceSettings } from '../hooks/useInvoiceSettings';
import { settingsService } from '../services/settingsService';
import type { InvoiceSettingsFormValues } from '../validations/settings.validation';
import { invoiceSettingsFormSchema } from '../validations/settings.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const EMPTY_INVOICE_VALUES: InvoiceSettingsFormValues = {
  numberingPrefix: '',
  numberingFormat: '',
  numberingStart: '0001',
  headerNote: '',
  footerNote: '',
  showCustomerGstin: true,
  paperWidth: '80mm',
};

const PAPER_WIDTH_OPTIONS = [
  { value: '58mm', label: '58mm' },
  { value: '80mm', label: '80mm' },
];

/** How long to let typing settle before autosaving a field change. */
const AUTOSAVE_DEBOUNCE_MS = 700;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Per-business invoice numbering/branding — the first (and so far only)
 * section under the "Settings" sidebar group (see `layouts/AppShell/
 * navConfig.tsx`); more sections (tax, notifications, …) join this one as
 * sibling routes/cards over time, each getting the same treatment: its own
 * sidebar sub-item and its own page here, not more tabs bolted onto this
 * one. Split out of the old combined `SettingsPage`, which mixed this
 * business-level configuration with the tenant_admin's own account
 * (profile/password/plan — now `modules/profile`'s `ProfilePage`) on one
 * screen; those are different concerns; own accounts vs. per-business GST
 * config) and didn't belong together.
 *
 * Saves on the fly — no "Save" button. Every field (including the logo,
 * which already uploaded instantly) autosaves a short debounce after the
 * last edit, once the form validates; a small status indicator in the page
 * header ("Saving…" / "All changes saved") is the only feedback, matching
 * `ProfilePage`'s account-details card, which is read-only precisely
 * because there's nothing there to save.
 */
export function InvoiceSettingsPage() {
  const queryClient = useQueryClient();

  const businessesQuery = useBusinesses();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedBusinessId) return;
    const first = businessesQuery.data?.[0];
    if (first) setSelectedBusinessId(first.id);
  }, [businessesQuery.data, selectedBusinessId]);

  const invoiceSettingsQuery = useInvoiceSettings(selectedBusinessId);

  const {
    register,
    control,
    watch,
    trigger,
    getValues,
    reset: resetForm,
    formState: { errors },
  } = useForm<InvoiceSettingsFormValues>({
    resolver: zodResolver(invoiceSettingsFormSchema),
    defaultValues: EMPTY_INVOICE_VALUES,
  });

  // Baseline for "did anything actually change" — set whenever fresh data
  // loads (including right after a save re-seeds the query cache), so the
  // autosave effect below never re-saves a value it just loaded.
  const lastSavedRef = useRef<string>(JSON.stringify(EMPTY_INVOICE_VALUES));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceSettingsQuery.data) return;
    const values: InvoiceSettingsFormValues = {
      numberingPrefix: invoiceSettingsQuery.data.numberingPrefix,
      numberingFormat: invoiceSettingsQuery.data.numberingFormat,
      numberingStart: invoiceSettingsQuery.data.numberingStart,
      headerNote: invoiceSettingsQuery.data.headerNote,
      footerNote: invoiceSettingsQuery.data.footerNote,
      showCustomerGstin: invoiceSettingsQuery.data.showCustomerGstin,
      paperWidth: invoiceSettingsQuery.data.paperWidth,
    };
    resetForm(values);
    lastSavedRef.current = JSON.stringify(values);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
  }, [invoiceSettingsQuery.data, resetForm]);

  const updateMutation = useMutation({
    mutationFn: (values: InvoiceSettingsFormValues) => {
      if (!selectedBusinessId) return Promise.reject(new Error('No business selected'));
      return settingsService.updateInvoiceSettings(selectedBusinessId, values);
    },
    onSuccess: (data, values) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.invoiceSettings(selectedBusinessId ?? ''), data);
      lastSavedRef.current = JSON.stringify(values);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
    },
    onError: (error) => {
      setSaveStatus('error');
      setSaveErrorMessage(describeApiError(error));
    },
  });

  // Autosave — watches every field and, a short debounce after the last
  // edit, validates and saves whatever changed since the last successful
  // save. Re-subscribes whenever the business (and so the form's data)
  // changes, so a save never fires against the wrong business.
  useEffect(() => {
    if (!selectedBusinessId || !invoiceSettingsQuery.data) return;
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
    // `updateMutation` is stable (from `useMutation`) and intentionally left
    // out — including it would resubscribe on every mutate call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, invoiceSettingsQuery.data, watch, trigger, getValues]);

  const businessOptions = (businessesQuery.data ?? []).map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Numbering + branding for GST invoices, per business"
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
      ) : invoiceSettingsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-ink-faint">Loading…</p>
        </Card>
      ) : invoiceSettingsQuery.isError ? (
        <Card>
          <p className="text-sm text-danger">{describeApiError(invoiceSettingsQuery.error)}</p>
        </Card>
      ) : invoiceSettingsQuery.data ? (
        <div className="flex flex-col gap-3.5">
          <Card>
            <CardHeader
              icon={Palette}
              title="Branding & numbering"
              subtitle="Your logo and how invoice numbers are generated for this business"
            />
            <div className="flex flex-wrap items-start gap-5">
              <InvoiceLogoField
                businessId={selectedBusinessId}
                logoUrl={invoiceSettingsQuery.data.logoUrl}
              />
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Numbering prefix"
                  placeholder="INV"
                  {...register('numberingPrefix')}
                  errorMessage={errors.numberingPrefix?.message}
                />
                <Input
                  label="Numbering format"
                  placeholder="{prefix}/{fy}/{seq}"
                  hint="Must include {seq}"
                  {...register('numberingFormat')}
                  errorMessage={errors.numberingFormat?.message}
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
                <Controller
                  control={control}
                  name="paperWidth"
                  render={({ field }) => (
                    <Select
                      label="Bill paper width"
                      hint="Thermal/KOT printer roll width for the downloadable bill"
                      value={field.value}
                      onChange={field.onChange}
                      options={PAPER_WIDTH_OPTIONS}
                    />
                  )}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={FileText}
              title="Invoice notes"
              subtitle="Optional text shown on every invoice for this business"
            />
            <div className="flex flex-col gap-4">
              <Input
                label="Header note (optional)"
                placeholder="Tagline shown under your business name/address"
                {...register('headerNote')}
                errorMessage={errors.headerNote?.message}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="footerNote" className="text-xs font-semibold text-ink-soft">
                  Footer note (optional)
                </label>
                <textarea
                  id="footerNote"
                  rows={3}
                  placeholder="Terms, bank details, thank-you note, etc."
                  {...register('footerNote')}
                  className="rounded-control border border-border bg-white px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader icon={ShieldCheck} title="GST display" subtitle="B2B invoice compliance options" />
            <Controller
              control={control}
              name="showCustomerGstin"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface/60 p-3.5">
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      Show the customer&apos;s GSTIN on B2B invoices
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      Prints the customer&apos;s GST number on invoices where one is on file.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Show the customer's GSTIN on B2B invoices"
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
