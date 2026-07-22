import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  ChefHat,
  KeyRound,
  Mail,
  MapPin,
  Receipt,
  ShieldCheck,
  Store,
  UserCog,
  Users,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  PasswordInput,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel } from '@/utils/status';

import { authService, useAuthStore } from '@/modules/auth';
import type { ResourceKey } from '@/modules/settings';
import { RESOURCE_KEY_OPTIONS, useLicensePlan } from '@/modules/settings';

import { PlanUsageTile } from '../components/PlanUsageTile';
import type { ChangePasswordFormValues } from '../validations/profile.validation';
import { changePasswordFormSchema } from '../validations/profile.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

const EMPTY_PASSWORD_VALUES: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const RESOURCE_ICONS: Record<ResourceKey, LucideIcon> = {
  tenant_admins: Users,
  managers: UserCog,
  kitchen_staff: ChefHat,
  business_entities: Store,
  locations: MapPin,
  products: Boxes,
  monthly_transactions: Receipt,
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * A tenant_admin's own account: identity, security (password), and plan &
 * usage — split out of the old combined `SettingsPage` into its own sidebar
 * entry ("My Profile") and route (`/profile`), separate from the
 * business-configuration "Settings" area (`/settings/invoices`). Same
 * `RequireRole roles={['tenant_admin']}` gate as before (see
 * `routes/router.tsx`) — managers/kitchen_staff use a PIN and never reach
 * this screen (`GLOBAL_PASSWORD_ROLES`/`STAFF_PIN_ROLES`,
 * apps/accounts/constants.py).
 */
export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY_PASSWORD_VALUES,
  });

  // `AuthService.change_password` revokes every session for the user
  // server-side on success — there's no "stay logged in on this device"
  // option, so the only sane response is to clear the local session and
  // send them back through `/login` with a fresh one.
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

  const licensePlanQuery = useLicensePlan();

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your account details, security, and plan" />

      <Card className="overflow-hidden !p-0">
        <div className="h-20 bg-gradient-to-r from-brand via-brand to-accent" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5">
          <span className="-mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 border-white bg-ink font-display text-xl font-bold text-white shadow-card">
            {initialsFor(user?.fullName ?? '?')}
          </span>
          <div className="min-w-0 flex-1 pt-2 sm:pt-0">
            <h2 className="truncate font-display text-lg font-extrabold text-ink">
              {user?.fullName ?? '—'}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {user?.email ?? user?.username ?? '—'}
              </span>
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {user?.tenantName ?? '—'}
              </span>
            </p>
          </div>
          <Badge tone="accent" className="self-start sm:self-center">
            {statusLabel(user?.role ?? 'tenant_admin')}
          </Badge>
        </div>
      </Card>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={ShieldCheck}
            title="Account details"
            subtitle="Read-only — contact an ultra_admin to change your role or tenant"
          />
          <dl className="flex flex-col gap-3 text-sm">
            <DetailRow label="Full name" value={user?.fullName ?? '—'} />
            <DetailRow label="Email" value={user?.email ?? user?.username ?? '—'} />
            <DetailRow
              label="Role"
              value={<Badge tone="accent">{statusLabel(user?.role ?? 'tenant_admin')}</Badge>}
            />
            <DetailRow label="Tenant" value={user?.tenantName ?? '—'} />
          </dl>
        </Card>

        <Card>
          <CardHeader
            icon={KeyRound}
            title="Change password"
            subtitle="You'll be signed out on every device afterward"
            action={
              <Button
                type="submit"
                form="change-password-form"
                size="sm"
                isLoading={changePasswordMutation.isPending}
              >
                Change password
              </Button>
            }
          />
          <form
            id="change-password-form"
            onSubmit={handlePasswordSubmit((values) => changePasswordMutation.mutate(values))}
            className="flex flex-col gap-3.5"
          >
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              {...registerPassword('currentPassword')}
              errorMessage={passwordErrors.currentPassword?.message}
            />
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              {...registerPassword('newPassword')}
              errorMessage={passwordErrors.newPassword?.message}
            />
            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              {...registerPassword('confirmPassword')}
              errorMessage={passwordErrors.confirmPassword?.message}
            />
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={Receipt}
            title="My plan & usage"
            subtitle={licensePlanQuery.data?.licenseName ?? undefined}
            action={
              licensePlanQuery.data ? (
                <div className="flex items-center gap-2">
                  <Badge
                    tone={licensePlanQuery.data.enforcementMode === 'strict' ? 'danger' : 'warning'}
                  >
                    {licensePlanQuery.data.enforcementMode === 'strict'
                      ? 'Strict enforcement'
                      : 'Lenient enforcement'}
                  </Badge>
                  {licensePlanQuery.data.licenseValidUntil ? (
                    <span className="whitespace-nowrap text-xs font-normal text-ink-faint">
                      Valid until{' '}
                      {new Date(licensePlanQuery.data.licenseValidUntil).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              ) : undefined
            }
          />
          {licensePlanQuery.isLoading ? (
            <p className="text-sm text-ink-faint">Loading…</p>
          ) : licensePlanQuery.isError ? (
            <p className="text-sm text-danger">{describeApiError(licensePlanQuery.error)}</p>
          ) : licensePlanQuery.data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {RESOURCE_KEY_OPTIONS.map((option) => {
                const resource = licensePlanQuery.data.resources[option.key];
                return (
                  <PlanUsageTile
                    key={option.key}
                    icon={RESOURCE_ICONS[option.key]}
                    label={option.label}
                    used={resource?.used ?? 0}
                    limit={resource?.limit ?? 0}
                  />
                );
              })}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
