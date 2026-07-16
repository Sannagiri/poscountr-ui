import type { AdminAccountFormValues } from '../../validations/platform.validation';
import { AdminAccountModal } from '../AdminAccountModal';

export interface CreatePlatformAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AdminAccountFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Creates a new ultra_admin — someone with full Platform Console access.
 * Thin wrapper around the shared `AdminAccountModal` (see
 * `AddTenantAdminModal` for the tenant-side equivalent using the same form).
 */
export function CreatePlatformAdminModal(props: CreatePlatformAdminModalProps) {
  return (
    <AdminAccountModal
      {...props}
      title="New platform admin"
      description="Gives full Platform Console access — this is not a tenant_admin."
      submitLabel="Create admin"
      passwordHint="Share this with them directly over a secure channel — they should change it after first login"
    />
  );
}
