import type { Tenant } from '../types/platform.types';

export type TenantLifecycleAction = 'suspend' | 'activate';

/**
 * Which lifecycle action to offer for a tenant's *current* status — the
 * single place this decision lives (docs/coding-standards.md §12), used by
 * `TenantCard`, `TenantsPage`, and `TenantEditModal` alike.
 *
 * Every newly created tenant starts life at `trial`
 * (`TenantProvisionService.create_tenant`'s status default) and stays fully
 * operational there (`Tenant.is_operational` treats trial the same as
 * active) — but before this fix, every call site wrote its own
 * `status === 'suspended' ? 'activate' : 'suspend'` ternary. That only
 * distinguishes suspended from everything else, so a `trial` tenant was
 * always offered "Suspend" and never "Activate" — there was no way to move
 * Trial -> Active in one click. Only `active` itself should offer
 * "Suspend"; both `trial` and `suspended` should offer "Activate".
 */
export function nextLifecycleAction(status: Tenant['status']): TenantLifecycleAction {
  return status === 'active' ? 'suspend' : 'activate';
}

export interface LifecycleConfirmCopy {
  title: string;
  confirmText: string;
  description: string;
  isDestructive: boolean;
}

/**
 * Confirm-dialog copy for a lifecycle action, tailored to the tenant's
 * status going in — "regain access immediately" only makes sense coming
 * from `suspended` (where access was actually cut); a `trial` tenant never
 * lost access, so activating it out of trial gets its own, accurate wording.
 */
export function lifecycleConfirmCopy(tenant: Tenant, kind: TenantLifecycleAction): LifecycleConfirmCopy {
  if (kind === 'suspend') {
    return {
      title: 'Suspend this business?',
      confirmText: 'Suspend',
      description: `${tenant.name}'s staff and owner will be unable to log in until it's reactivated.`,
      isDestructive: true,
    };
  }
  return {
    title: 'Activate this business?',
    confirmText: 'Activate',
    description:
      tenant.status === 'trial'
        ? `${tenant.name} moves from Trial to Active.`
        : `${tenant.name} will regain access immediately.`,
    isDestructive: false,
  };
}

/** Button label for the lifecycle toggle — "Activate" for trial/suspended, "Suspend" only once actually active. */
export function lifecycleButtonLabel(status: Tenant['status']): string {
  return nextLifecycleAction(status) === 'suspend' ? 'Suspend' : 'Activate';
}
