import { apiClient, unwrap } from '@/services/apiClient';

import type {
  AddTenantAdminRequest,
  AuditLogEntry,
  AuditLogFilters,
  CreatePlatformAdminRequest,
  CreateTenantRequest,
  EnforcementMode,
  LicenseType,
  LicenseTypeRequest,
  PlatformAdmin,
  Tenant,
  TenantAdmin,
  UpdateTenantRequest,
} from '../types/platform.types';

/**
 * All calls to `/platform/*` live here — components and hooks never call
 * `apiClient` directly (docs/coding-standards.md §14). Every endpoint here is
 * `IsUltraAdmin`-gated server-side; the route guard on the frontend
 * (`RequireRole roles={['ultra_admin']}`) just avoids a round-trip for
 * everyone else. Request/response bodies are translated between the
 * backend's snake_case field names and this module's camelCase types.
 */

interface TenantRaw {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  status: Tenant['status'];
  is_active: boolean;
  enforcement_mode: EnforcementMode;
  license_type_id: string | null;
  license_type_name: string | null;
  license_valid_from: string | null;
  license_valid_until: string | null;
  owner_id: string | null;
  owner_email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  created_at: string;
}

function mapTenant(raw: TenantRaw): Tenant {
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.display_name,
    slug: raw.slug,
    status: raw.status,
    isActive: raw.is_active,
    enforcementMode: raw.enforcement_mode,
    licenseTypeId: raw.license_type_id,
    licenseTypeName: raw.license_type_name,
    licenseValidFrom: raw.license_valid_from,
    licenseValidUntil: raw.license_valid_until,
    ownerId: raw.owner_id,
    ownerEmail: raw.owner_email,
    ownerFirstName: raw.owner_first_name,
    ownerLastName: raw.owner_last_name,
    createdAt: raw.created_at,
  };
}

interface LicenseTypeRaw {
  id: string;
  name: string;
  code: string;
  description: string;
  price: string;
  default_enforcement_mode: EnforcementMode;
  is_active: boolean;
  max_tenant_admins: number;
  max_managers: number;
  max_kitchen_staff: number;
  max_business_entities: number;
  max_locations: number;
  max_products: number;
}

function mapLicenseType(raw: LicenseTypeRaw): LicenseType {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    description: raw.description,
    price: raw.price,
    defaultEnforcementMode: raw.default_enforcement_mode,
    isActive: raw.is_active,
    maxTenantAdmins: raw.max_tenant_admins,
    maxManagers: raw.max_managers,
    maxKitchenStaff: raw.max_kitchen_staff,
    maxBusinessEntities: raw.max_business_entities,
    maxLocations: raw.max_locations,
    maxProducts: raw.max_products,
  };
}

interface TenantAdminRaw {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_platform_blocked: boolean;
  is_primary: boolean;
  created_at: string;
}

function mapTenantAdmin(raw: TenantAdminRaw): TenantAdmin {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    role: raw.role,
    isActive: raw.is_active,
    isPlatformBlocked: raw.is_platform_blocked,
    isPrimary: raw.is_primary,
    createdAt: raw.created_at,
  };
}

interface PlatformAdminRaw {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

function mapPlatformAdmin(raw: PlatformAdminRaw): PlatformAdmin {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    role: raw.role,
    isActive: raw.is_active,
    isSuperuser: raw.is_superuser,
    createdAt: raw.created_at,
  };
}

interface AuditLogRaw {
  id: string;
  action: AuditLogEntry['action'];
  actor_id: string | null;
  target_tenant_id: string | null;
  target_user_id: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapAuditLog(raw: AuditLogRaw): AuditLogEntry {
  return {
    id: raw.id,
    action: raw.action,
    actorId: raw.actor_id,
    targetTenantId: raw.target_tenant_id,
    targetUserId: raw.target_user_id,
    reason: raw.reason,
    metadata: raw.metadata,
    createdAt: raw.created_at,
  };
}

export const platformService = {
  /** No pagination — the backend returns a plain array here (confirmed against source). */
  async listTenants(): Promise<Tenant[]> {
    const body = await unwrap<TenantRaw[]>(apiClient.get('/platform/tenants/'));
    return body.map(mapTenant);
  },

  async getTenant(id: string): Promise<Tenant> {
    const raw = await unwrap<TenantRaw>(apiClient.get(`/platform/tenants/${id}/`));
    return mapTenant(raw);
  },

  /** `slug` is immutable server-side — not present in `UpdateTenantRequest`, so nothing to send for it. */
  async updateTenant(id: string, request: UpdateTenantRequest): Promise<Tenant> {
    const raw = await unwrap<TenantRaw>(
      apiClient.patch(`/platform/tenants/${id}/`, {
        name: request.name,
        display_name: request.displayName,
        license_type_id: request.licenseTypeId,
        license_valid_from: request.licenseValidFrom,
        license_valid_until: request.licenseValidUntil,
        enforcement_mode: request.enforcementMode,
      }),
    );
    return mapTenant(raw);
  },

  async listTenantAdmins(tenantId: string): Promise<TenantAdmin[]> {
    const body = await unwrap<TenantAdminRaw[]>(
      apiClient.get(`/platform/tenants/${tenantId}/admins/`),
    );
    return body.map(mapTenantAdmin);
  },

  async addTenantAdmin(tenantId: string, request: AddTenantAdminRequest): Promise<TenantAdmin> {
    const raw = await unwrap<TenantAdminRaw>(
      apiClient.post(`/platform/tenants/${tenantId}/admins/`, {
        email: request.email,
        password: request.password,
        first_name: request.firstName || undefined,
        last_name: request.lastName || undefined,
      }),
    );
    return mapTenantAdmin(raw);
  },

  /**
   * Blocks any user account (tenant_admin, manager, etc.) — kills their
   * sessions and prevents login until unblocked. There's no "remove a
   * tenant admin" endpoint on the backend (only list/add), so this is the
   * real, backend-supported equivalent of "revoke this admin's access"
   * rather than deleting the account/association outright. Returns no
   * data — callers should invalidate the relevant admins query afterward.
   */
  async blockUser(userId: string, reason?: string): Promise<void> {
    await unwrap<null>(apiClient.post(`/platform/users/${userId}/block/`, { reason }));
  },

  async unblockUser(userId: string): Promise<void> {
    await unwrap<null>(apiClient.post(`/platform/users/${userId}/unblock/`, {}));
  },

  /**
   * Creates the tenant (the "business") AND its first tenant_admin (the
   * "admin") in one call — the backend has no separate admin-creation step
   * for this flow.
   */
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    const raw = await unwrap<TenantRaw>(
      apiClient.post('/platform/tenants/', {
        name: request.name,
        slug: request.slug,
        display_name: request.displayName || undefined,
        license_type_id: request.licenseTypeId || undefined,
        enforcement_mode: request.enforcementMode,
        admin_email: request.adminEmail,
        admin_password: request.adminPassword,
        admin_first_name: request.adminFirstName || undefined,
        admin_last_name: request.adminLastName || undefined,
      }),
    );
    return mapTenant(raw);
  },

  async suspendTenant(id: string, reason?: string): Promise<Tenant> {
    const raw = await unwrap<TenantRaw>(
      apiClient.post(`/platform/tenants/${id}/suspend/`, reason ? { reason } : {}),
    );
    return mapTenant(raw);
  },

  async activateTenant(id: string): Promise<Tenant> {
    const raw = await unwrap<TenantRaw>(apiClient.post(`/platform/tenants/${id}/activate/`));
    return mapTenant(raw);
  },

  async listLicenseTypes(): Promise<LicenseType[]> {
    const body = await unwrap<LicenseTypeRaw[]>(apiClient.get('/platform/license-types/'));
    return body.map(mapLicenseType);
  },

  async createLicenseType(request: LicenseTypeRequest): Promise<LicenseType> {
    const raw = await unwrap<LicenseTypeRaw>(
      apiClient.post('/platform/license-types/', licenseTypeRequestToBody(request)),
    );
    return mapLicenseType(raw);
  },

  /** PATCH only — the backend view doesn't actually implement PUT despite the URL comment implying both. */
  async updateLicenseType(id: string, request: Partial<LicenseTypeRequest>): Promise<LicenseType> {
    const raw = await unwrap<LicenseTypeRaw>(
      apiClient.patch(`/platform/license-types/${id}/`, licenseTypeRequestToBody(request)),
    );
    return mapLicenseType(raw);
  },

  /** Soft delete — sets `is_active=False` server-side, doesn't remove the row. */
  async deleteLicenseType(id: string): Promise<void> {
    await apiClient.delete(`/platform/license-types/${id}/`);
  },

  async listPlatformAdmins(): Promise<PlatformAdmin[]> {
    const body = await unwrap<PlatformAdminRaw[]>(apiClient.get('/platform/admins/'));
    return body.map(mapPlatformAdmin);
  },

  async createPlatformAdmin(request: CreatePlatformAdminRequest): Promise<PlatformAdmin> {
    const raw = await unwrap<PlatformAdminRaw>(
      apiClient.post('/platform/admins/', {
        email: request.email,
        password: request.password,
        first_name: request.firstName || undefined,
        last_name: request.lastName || undefined,
      }),
    );
    return mapPlatformAdmin(raw);
  },

  async activatePlatformAdmin(id: string): Promise<PlatformAdmin> {
    const raw = await unwrap<PlatformAdminRaw>(apiClient.post(`/platform/admins/${id}/activate/`));
    return mapPlatformAdmin(raw);
  },

  /** Backend blocks deactivating yourself or the last active ultra_admin — surfaces as a normal ApiError. */
  async deactivatePlatformAdmin(id: string): Promise<PlatformAdmin> {
    const raw = await unwrap<PlatformAdminRaw>(
      apiClient.post(`/platform/admins/${id}/deactivate/`),
    );
    return mapPlatformAdmin(raw);
  },

  /**
   * No pagination beyond the backend's own hard cap (first 200 rows,
   * newest first) — there's no `offset`/`page` param to request more.
   * `tenant_id`/`action` are the only supported server-side filters; there's
   * no date-range param yet.
   */
  async listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    const body = await unwrap<AuditLogRaw[]>(
      apiClient.get('/platform/audit-logs/', {
        params: {
          tenant_id: filters.tenantId || undefined,
          action: filters.action || undefined,
        },
      }),
    );
    return body.map(mapAuditLog);
  },
};

/** camelCase request → snake_case body, shared by create (full) and update (partial). */
function licenseTypeRequestToBody(request: Partial<LicenseTypeRequest>) {
  return {
    name: request.name,
    code: request.code,
    description: request.description,
    price: request.price,
    default_enforcement_mode: request.defaultEnforcementMode,
    is_active: request.isActive,
    max_tenant_admins: request.maxTenantAdmins,
    max_managers: request.maxManagers,
    max_kitchen_staff: request.maxKitchenStaff,
    max_business_entities: request.maxBusinessEntities,
    max_locations: request.maxLocations,
    max_products: request.maxProducts,
  };
}
