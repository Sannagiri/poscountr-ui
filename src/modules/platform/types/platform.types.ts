/**
 * Types mirror the real Django serializers in `apps/platform/` — field names
 * and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25, POSCountr/progress/04_platform_ultra_admin.md).
 */

export type TenantStatus = 'trial' | 'active' | 'suspended';

export type EnforcementMode = 'lenient' | 'strict';

/** A "business" in ultra_admin language — the platform's Tenant record. */
export interface Tenant {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: TenantStatus;
  isActive: boolean;
  enforcementMode: EnforcementMode;
  licenseTypeId: string | null;
  licenseTypeName: string | null;
  licenseValidFrom: string | null;
  licenseValidUntil: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  createdAt: string;
}

/**
 * The backend creates the tenant AND its first tenant_admin in one call —
 * the admin fields are flat (`admin_*` prefix), not a nested object, by
 * deliberate backend design (so the form posts as plain form-data).
 */
export interface CreateTenantRequest {
  name: string;
  slug: string;
  displayName?: string;
  licenseTypeId?: string;
  enforcementMode?: EnforcementMode;
  adminEmail: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

/**
 * Fields the "edit business" form can change. `slug` is deliberately absent
 * — the backend's `TenantUpdateInputSerializer` doesn't accept it at all
 * (immutable after creation), so there's nothing to send even if a form
 * field existed for it.
 */
export interface UpdateTenantRequest {
  name?: string;
  displayName?: string;
  licenseTypeId?: string | null;
  licenseValidFrom?: string | null;
  licenseValidUntil?: string | null;
  enforcementMode?: EnforcementMode;
}

export interface LicenseType {
  id: string;
  name: string;
  code: string;
  description: string;
  price: string;
  defaultEnforcementMode: EnforcementMode;
  isActive: boolean;
  maxTenantAdmins: number;
  maxManagers: number;
  maxKitchenStaff: number;
  maxBusinessEntities: number;
  maxLocations: number;
  maxProducts: number;
}

/**
 * `LicenseType` minus server-assigned fields. Note: `max_monthly_transactions`
 * exists on the backend model but isn't exposed by its input serializer —
 * there is deliberately no field for it here, it would be silently dropped.
 */
export interface LicenseTypeRequest {
  name: string;
  code: string;
  description?: string;
  price: string;
  defaultEnforcementMode: EnforcementMode;
  isActive: boolean;
  maxTenantAdmins: number;
  maxManagers: number;
  maxKitchenStaff: number;
  maxBusinessEntities: number;
  maxLocations: number;
  maxProducts: number;
}

/** A tenant_admin (or the owner) attached to one business — from the tenant's own "admins" sub-resource. */
export interface TenantAdmin {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isPlatformBlocked: boolean;
  /** True when this admin is the tenant's `owner_id` — the one created alongside the business. */
  isPrimary: boolean;
  createdAt: string;
}

export interface AddTenantAdminRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/** An ultra_admin account — same `accounts.User` table as everyone else, filtered by role server-side. */
export interface PlatformAdmin {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isSuperuser: boolean;
  createdAt: string;
}

export interface CreatePlatformAdminRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/** Every action the backend's `AuditLog.Action` enum can record (apps/platform/models/audit_log.py). */
export type AuditLogAction =
  | 'tenant_created'
  | 'tenant_suspended'
  | 'tenant_activated'
  | 'license_assigned'
  | 'quota_override_set'
  | 'user_blocked'
  | 'user_unblocked'
  | 'impersonation_started'
  | 'license_type_created'
  | 'license_type_updated'
  | 'license_type_deleted'
  | 'ultra_admin_created'
  | 'ultra_admin_activated'
  | 'ultra_admin_deactivated'
  | 'tenant_admin_added';

/**
 * A single platform-level audit entry. Only IDs are exposed for
 * actor/target (no denormalized names on the backend) — pages that display
 * these cross-reference already-fetched tenants/admins lists to show a
 * human-readable label instead of a raw UUID.
 */
export interface AuditLogEntry {
  id: string;
  action: AuditLogAction;
  actorId: string | null;
  targetTenantId: string | null;
  targetUserId: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  tenantId?: string;
  action?: AuditLogAction;
}
