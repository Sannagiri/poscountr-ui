import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Modal } from '@/components';

import type { AdminAccountFormValues } from '../../validations/platform.validation';
import { adminAccountSchema } from '../../validations/platform.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface AdminAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  passwordHint?: string;
  onSubmit: (values: AdminAccountFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Shared email/password/first-name/last-name form — the backend's
 * `AdminAccountInputSerializer` is reused for both adding a tenant_admin to
 * a business and creating a new ultra_admin, so this one modal covers both
 * call sites (`AddTenantAdminModal` and `CreatePlatformAdminModal`) instead
 * of two near-identical copies drifting apart over time.
 */
export function AdminAccountModal({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  passwordHint = 'Share this with them directly — they should change it after first login',
  onSubmit,
  isSubmitting,
  submitError,
}: AdminAccountModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminAccountFormValues>({ resolver: zodResolver(adminAccountSchema) });

  // Resetting only on the Cancel/dismiss path (inside `Modal`'s own
  // `onOpenChange`) misses the "submit succeeded" close, since that path
  // flips the `open` prop from the parent directly rather than calling back
  // through here — the previous email/password/name would otherwise still
  // be sitting in the form the next time this opens. Keying off `open`
  // itself catches every path that closes the modal, matching the pattern
  // `LicenseTypeModal` already uses.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function handleFormSubmit(values: AdminAccountFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="admin-account-form" type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="admin-account-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Email"
          type="email"
          placeholder="admin@example.com"
          hint="Doubles as their login username"
          {...register('email')}
          errorMessage={errors.email?.message}
        />
        <Input
          label="Temporary password"
          type="password"
          placeholder="At least 8 characters"
          hint={passwordHint}
          {...register('password')}
          errorMessage={errors.password?.message}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" placeholder="Ravi" {...register('firstName')} />
          <Input label="Last name" placeholder="Kumar" {...register('lastName')} />
        </div>
        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
      </form>
    </Modal>
  );
}
