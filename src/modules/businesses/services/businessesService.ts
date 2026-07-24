import { apiClient, unwrap, unwrapWithMeta } from '@/services/apiClient';

import type {
  BusinessEntity,
  BusinessEntityRequest,
  EntityType,
  LicenseUsage,
  Location,
  LocationRequest,
} from '../types/businesses.types';

/**
 * All calls to `/tenant/businesses/` and `/tenant/locations/` live here —
 * components and hooks never call `apiClient` directly
 * (docs/coding-standards.md §14). Every endpoint here is `IsTenantAdmin`-
 * gated server-side; the route guard on the frontend (`RequireRole
 * roles={['tenant_admin']}`) just avoids a round-trip for everyone else.
 * Request/response bodies are translated between the backend's snake_case
 * field names and this module's camelCase types.
 */

interface BusinessEntityRaw {
  id: string;
  name: string;
  entity_type: EntityType;
  gstin: string | null;
  phone: string;
  state: string;
  is_active: boolean;
  created_at: string;
}

function mapBusiness(raw: BusinessEntityRaw): BusinessEntity {
  return {
    id: raw.id,
    name: raw.name,
    entityType: raw.entity_type,
    gstin: raw.gstin,
    phone: raw.phone,
    state: raw.state,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

/** camelCase request → snake_case body, shared by create (full) and update (partial). */
function businessRequestToBody(request: Partial<BusinessEntityRequest>) {
  return {
    name: request.name,
    entity_type: request.entityType,
    gstin: request.gstin,
    phone: request.phone,
    state: request.state,
  };
}

interface LocationRaw {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

function mapLocation(raw: LocationRaw): Location {
  return {
    id: raw.id,
    businessId: raw.business_id,
    businessName: raw.business_name,
    name: raw.name,
    addressLine1: raw.address_line1,
    addressLine2: raw.address_line2,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode,
    phone: raw.phone,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

/** camelCase request → snake_case body, shared by create (full) and update (partial). `businessId` is create-only (fixed after that), so update bodies simply won't include it. */
function locationRequestToBody(request: Partial<LocationRequest>) {
  return {
    business_id: request.businessId,
    name: request.name,
    address_line1: request.addressLine1,
    address_line2: request.addressLine2,
    city: request.city,
    state: request.state,
    pincode: request.pincode,
    phone: request.phone,
  };
}

interface LicenseUsageResourceRaw {
  used: number;
  limit: number;
}

interface LicenseUsageRaw {
  business_entities: LicenseUsageResourceRaw;
  locations: LicenseUsageResourceRaw;
}

function mapLicenseUsage(raw: LicenseUsageRaw): LicenseUsage {
  return {
    businessEntities: raw.business_entities,
    locations: raw.locations,
  };
}

export const businessesService = {
  /** No pagination — the backend returns a plain array here (confirmed against source, same as tenants/license-types). */
  async listBusinesses(): Promise<BusinessEntity[]> {
    const body = await unwrap<BusinessEntityRaw[]>(apiClient.get('/tenant/businesses/'));
    return body.map(mapBusiness);
  },

  /**
   * Gated by `max_business_entities` — a lenient-mode tenant at/over its cap
   * still gets the business created, with a warning in `meta`; a strict-mode
   * tenant gets a 422 `quota_exceeded` instead (surfaces as a normal
   * `ApiError`, `describeApiError` already renders its message).
   */
  async createBusiness(
    request: BusinessEntityRequest,
  ): Promise<{ business: BusinessEntity; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<BusinessEntityRaw>(
      apiClient.post('/tenant/businesses/', businessRequestToBody(request)),
    );
    return { business: mapBusiness(data), warning: (meta.warning as string) ?? null };
  },

  async updateBusiness(
    id: string,
    request: Partial<BusinessEntityRequest>,
  ): Promise<BusinessEntity> {
    const raw = await unwrap<BusinessEntityRaw>(
      apiClient.patch(`/tenant/businesses/${id}/`, businessRequestToBody(request)),
    );
    return mapBusiness(raw);
  },

  async deactivateBusiness(id: string): Promise<BusinessEntity> {
    const raw = await unwrap<BusinessEntityRaw>(
      apiClient.post(`/tenant/businesses/${id}/deactivate/`),
    );
    return mapBusiness(raw);
  },

  /** Reactivating consumes a seat exactly like a create — same quota gating, same `warning` shape. */
  async activateBusiness(
    id: string,
  ): Promise<{ business: BusinessEntity; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<BusinessEntityRaw>(
      apiClient.post(`/tenant/businesses/${id}/activate/`),
    );
    return { business: mapBusiness(data), warning: (meta.warning as string) ?? null };
  },

  /** No pagination — a flat list of every location across all of the tenant's businesses; filter client-side per business. */
  async listLocations(): Promise<Location[]> {
    const body = await unwrap<LocationRaw[]>(apiClient.get('/tenant/locations/'));
    return body.map(mapLocation);
  },

  /** Gated by `max_locations` — same lenient-warning / strict-block shape as `createBusiness`. */
  async createLocation(
    request: LocationRequest,
  ): Promise<{ location: Location; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<LocationRaw>(
      apiClient.post('/tenant/locations/', locationRequestToBody(request)),
    );
    return { location: mapLocation(data), warning: (meta.warning as string) ?? null };
  },

  async updateLocation(id: string, request: Partial<LocationRequest>): Promise<Location> {
    const raw = await unwrap<LocationRaw>(
      apiClient.patch(`/tenant/locations/${id}/`, locationRequestToBody(request)),
    );
    return mapLocation(raw);
  },

  async deactivateLocation(id: string): Promise<Location> {
    const raw = await unwrap<LocationRaw>(apiClient.post(`/tenant/locations/${id}/deactivate/`));
    return mapLocation(raw);
  },

  /** Reactivating consumes a seat exactly like a create — same quota gating, same `warning` shape. */
  async activateLocation(id: string): Promise<{ location: Location; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<LocationRaw>(
      apiClient.post(`/tenant/locations/${id}/activate/`),
    );
    return { location: mapLocation(data), warning: (meta.warning as string) ?? null };
  },

  /**
   * Business entities + locations usage vs. the tenant's effective license
   * limit — `IsTenantAdmin`-gated, narrow read of what
   * `QuotaService.effective_limits` already computes server-side (the fuller
   * per-resource picture stays ultra_admin-only on the Platform Console).
   */
  async getLicenseUsage(): Promise<LicenseUsage> {
    const raw = await unwrap<LicenseUsageRaw>(apiClient.get('/tenant/license/usage/'));
    return mapLicenseUsage(raw);
  },
};
