import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input, Modal } from '@/components';

import type { AddAdminFormValues } from '../../validations/team.validation';
import { addAdminSchema } from '../../validations/team.validation';

import { zodResolver } from '@hookform/resolvers/zod';

export interface AddAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddAdminFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

const EMPTY_VALUES: AddAdminFormValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
};

/**
 * Add another tenant_admin — a peer of the acting admin, same password
 * login as the acting admin themselves (not a staff PIN account). One-way
 * form: there's no "edit an admin" endpoint on the backend, only
 * add/activate/deactivate, so this modal never doubles as an edit form the
 * way `BusinessEditModal`/`LicenseTypeModal` do.
 */
export function AddAdminModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitError,
}: AddAdminModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddAdminFormValues>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(EMPTY_VALUES);
  }, [open, reset]);

  async function handleFormSubmit(values: AddAdminFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add admin"
      description="Another tenant_admin — full access to this account, same as you."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="add-admin-form" type="submit" isLoading={isSubmitting}>
            Add admin
          </Button>
        </>
      }
    >
      <form
        id="add-admin-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Email"
          type="email"
          placeholder="admin@business.com"
          hint="Doubles as this admin's login username"
          {...register('email')}
          errorMessage={errors.email?.message}
        />
        <Input
          label="Temporary password"
          type="password"
          placeholder="At least 8 characters"
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
