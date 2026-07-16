import type { AdminAccountFormValues } from '../../validations/platform.validation';
import { AdminAccountModal } from '../AdminAccountModal';

export interface AddTenantAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AdminAccountFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Adds another tenant_admin to an existing business — same shape as the
 * owner login created alongside a new business (`CreateBusinessModal`'s
 * "First owner login" section), just for a second (or third) seat on one
 * that already exists. Thin wrapper around the shared `AdminAccountModal`
 * (the backend's `AdminAccountInputSerializer` is reused for both tenant
 * admins and platform admins, so the form itself lives in one place —
 * `CreatePlatformAdminModal` is the other wrapper).
 */
export function AddTenantAdminModal(props: AddTenantAdminModalProps) {
  return (
    <AdminAccountModal
      {...props}
      title="Add an admin"
      description="Gives another person tenant_admin access to this business."
      submitLabel="Add admin"
    />
  );
}
