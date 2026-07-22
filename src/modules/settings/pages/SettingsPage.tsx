import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Input,
  PageHeader,
  Select,
  UsageMeter,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel } from '@/utils/status';

import { authService, useAuthStore } from '@/modules/auth';
import { useBusinesses } from '@/modules/businesses';

import { InvoiceLogoField } from '../components/InvoiceLogoField';
import { RESOURCE_KEY_OPTIONS, SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { useInvoiceSettings } from '../hooks/useInvoiceSettings';
import { useLicensePlan } from '../hooks/useLicensePlan';
import { settingsService } from '../services/settingsService';
import type {
  ChangePasswordFormValues,
  InvoiceSettingsFormValues,
} from '../validations/settings.validation';
import {
  changePasswordFormSchema,
  invoiceSettingsFormSchema,
} from '../validations/settings.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const EMPTY_PASSWORD_VALUES: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const EMPTY_INVOICE_VALUES: InvoiceSettingsFormValues = {
  numberingPrefix: '',
  numberingFormat: '',
  headerNote: '',
  footerNote: '',
  showCustomerGstin: true,
};

/**
 * A tenant_admin's own account + tenant-level configuration — this route is
 * `RequireRole roles={['tenant_admin']}`-only (see `routes/router.tsx`), so
 * only the password credential-change form is needed here (managers/
 * kitchen_staff use a PIN and never reach this screen — see
 * `GLOBAL_PASSWORD_ROLES`/`STAFF_PIN_ROLES`, apps/accounts/constants.py).
 *
 * Three independent cards: Profile (read-only), Change password, "My plan &
 * usage" (`TenantLicensePlanView`), and per-business invoice numbering/
 * branding (`InvoiceSettingsView`) — the last one is per-`BusinessEntity`,
 * so a tenant_admin with more than one business gets a picker.
 */
export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // ─── Change password ────────────────────────────────────────────────────
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY_PASSWORD_VALUES,
  });

  // Both `AuthService.change_password`/`change_pin` revoke every session for
  // the user server-side on success — there's no "stay logged in on this
  // device" option, so the only sane response is to clear the local session
  // and send them back through `/login` with a fresh one (deliberately
  // simpler than `ChangePinPage`'s auto-relogin trick, which exists only for
  // the forced first-login flow).
  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      authService.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      resetPasswordForm(EMPTY_PASSWORD_VALUES);
      clearSession();
      showToast({ tone: 'success', message: 'Password changed — please sign in again.' });
      navigate('/login', { replace: true });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  // ─── Plan & usage ───────────────────────────────────────────────────────
  const licensePlanQuery = useLicensePlan();

  // ─── Invoice settings ───────────────────────────────────────────────────
  const businessesQuery = useBusinesses();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedBusinessId) return;
    const first = businessesQuery.data?.[0];
    if (first) setSelectedBusinessId(first.id);
  }, [businessesQuery.data, selectedBusinessId]);

  const invoiceSettingsQuery = useInvoiceSettings(selectedBusinessId);

  const {
    register: registerInvoice,
    control: invoiceControl,
    handleSubmit: handleInvoiceSubmit,
    reset: resetInvoiceForm,
    formState: { errors: invoiceErrors },
  } = useForm<InvoiceSettingsFormValues>({
    resolver: zodResolver(invoiceSettingsFormSchema),
    defaultValues: EMPTY_INVOICE_VALUES,
  });

  useEffect(() => {
    if (!invoiceSettingsQuery.data) return;
    resetInvoiceForm({
      numberingPrefix: invoiceSettingsQuery.data.numberingPrefix,
      numberingFormat: invoiceSettingsQuery.data.numberingFormat,
      headerNote: invoiceSettingsQuery.data.headerNote,
      footerNote: invoiceSettingsQuery.data.footerNote,
      showCustomerGstin: invoiceSettingsQuery.data.showCustomerGstin,
    });
  }, [invoiceSettingsQuery.data, resetInvoiceForm]);

  const updateInvoiceSettingsMutation = useMutation({
    mutationFn: (values: InvoiceSettingsFormValues) => {
      if (!selectedBusinessId) return Promise.reject(new Error('No business selected'));
      return settingsService.updateInvoiceSettings(selectedBusinessId, values);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.invoiceSettings(selectedBusinessId ?? ''), data);
      showToast({ tone: 'success', message: 'Invoice settings saved.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const businessOptions = (businessesQuery.data ?? []).map((business) => ({
    value: business.id,
    label: business.name,
  }));

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account, plan, and invoice configuration" />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Profile"
            subtitle="Read-only — contact an ultra_admin to change your role or tenant"
          />
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-ink-faint">Name</dt>
            <dd className="text-right font-medium text-ink">{user?.fullName ?? '—'}</dd>
            <dt className="text-ink-faint">Email</dt>
            <dd className="text-right font-medium text-ink">
              {user?.email ?? user?.username ?? '—'}
            </dd>
            <dt className="text-ink-faint">Role</dt>
            <dd className="text-right">
              <Badge tone="accent">{statusLabel(user?.role ?? 'tenant_admin')}</Badge>
            </dd>
            <dt className="text-ink-faint">Tenant</dt>
            <dd className="text-right font-medium text-ink">{user?.tenantName ?? '—'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            subtitle="You'll be signed out on every device afterward"
          />
          <form
            onSubmit={handlePasswordSubmit((values) => changePasswordMutation.mutate(values))}
            className="flex flex-col gap-3.5"
          >
            <Input
              type="password"
              label="Current password"
              autoComplete="current-password"
              {...registerPassword('currentPassword')}
              errorMessage={passwordErrors.currentPassword?.message}
            />
            <Input
              type="password"
              label="New password"
              autoComplete="new-password"
              {...registerPassword('newPassword')}
              errorMessage={passwordErrors.newPassword?.message}
            />
            <Input
              type="password"
              label="Confirm new password"
              autoComplete="new-password"
              {...registerPassword('confirmPassword')}
              errorMessage={passwordErrors.confirmPassword?.message}
            />
            <Button
              type="submit"
              isLoading={changePasswordMutation.isPending}
              className="self-start"
            >
              Change password
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="My plan & usage"
            subtitle={licensePlanQuery.data?.licenseName ?? undefined}
          />
          {licensePlanQuery.isLoading ? (
            <p className="text-sm text-ink-faint">Loading…</p>
          ) : licensePlanQuery.isError ? (
            <p className="text-sm text-danger">{describeApiError(licensePlanQuery.error)}</p>
          ) : licensePlanQuery.data ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={licensePlanQuery.data.enforcementMode === 'strict' ? 'danger' : 'warning'}
                >
                  {licensePlanQuery.data.enforcementMode === 'strict'
                    ? 'Strict enforcement'
                    : 'Lenient enforcement'}
                </Badge>
                {licensePlanQuery.data.licenseValidUntil ? (
                  <span className="text-xs text-ink-faint">
                    Valid until{' '}
                    {new Date(licensePlanQuery.data.licenseValidUntil).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-3.5">
                {RESOURCE_KEY_OPTIONS.map((option) => {
                  const resource = licensePlanQuery.data.resources[option.key];
                  return (
                    <UsageMeter
                      key={option.key}
                      label={option.label}
                      used={resource?.used ?? 0}
                      limit={resource?.limit ?? 0}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Invoice settings"
            subtitle="Numbering + branding for GST invoices, per business"
            action={
              businessOptions.length > 1 ? (
                <Select
                  className="w-auto min-w-[10rem]"
                  value={selectedBusinessId}
                  onChange={setSelectedBusinessId}
                  options={businessOptions}
                />
              ) : undefined
            }
          />
          {!selectedBusinessId ? (
            <p className="text-sm text-ink-faint">
              No businesses yet — create one under Businesses first.
            </p>
          ) : invoiceSettingsQuery.isLoading ? (
            <p className="text-sm text-ink-faint">Loading…</p>
          ) : invoiceSettingsQuery.isError ? (
            <p className="text-sm text-danger">{describeApiError(invoiceSettingsQuery.error)}</p>
          ) : invoiceSettingsQuery.data ? (
            <form
              onSubmit={handleInvoiceSubmit((values) =>
                updateInvoiceSettingsMutation.mutate(values),
              )}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-start gap-4">
                <InvoiceLogoField
                  businessId={selectedBusinessId}
                  logoUrl={invoiceSettingsQuery.data.logoUrl}
                />
                <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Numbering prefix"
                    placeholder="INV"
                    {...registerInvoice('numberingPrefix')}
                    errorMessage={invoiceErrors.numberingPrefix?.message}
                  />
                  <Input
                    label="Numbering format"
                    placeholder="{prefix}/{fy}/{seq}"
                    hint="Must include {seq}"
                    {...registerInvoice('numberingFormat')}
                    errorMessage={invoiceErrors.numberingFormat?.message}
                  />
                </div>
              </div>
              <Input
                label="Header note (optional)"
                placeholder="Tagline shown under your business name/address"
                {...registerInvoice('headerNote')}
                errorMessage={invoiceErrors.headerNote?.message}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="footerNote" className="text-xs font-semibold text-ink-soft">
                  Footer note (optional)
                </label>
                <textarea
                  id="footerNote"
                  rows={3}
                  placeholder="Terms, bank details, thank-you note, etc."
                  {...registerInvoice('footerNote')}
                  className="rounded-control border border-border bg-white px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={invoiceControl}
                  name="showCustomerGstin"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      label="Show the customer's GSTIN on B2B invoices"
                    />
                  )}
                />
                <span className="text-sm text-ink">
                  Show the customer&apos;s GSTIN on B2B invoices
                </span>
              </div>
              <Button
                type="submit"
                isLoading={updateInvoiceSettingsMutation.isPending}
                className="self-start"
              >
                Save invoice settings
              </Button>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
