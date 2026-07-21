import { apiClient, unwrap, unwrapWithMeta } from '@/services/apiClient';

import type {
  AddAdminRequest,
  AddStaffRequest,
  AssignLocationRequest,
  TeamMember,
  TeamRole,
} from '../types/team.types';

/**
 * All calls to `/tenant/admins/` and `/tenant/staff/` live here — components
 * and hooks never call `apiClient` directly (docs/coding-standards.md §14).
 * Every endpoint here is `IsTenantAdmin`-gated server-side; the route guard
 * on the frontend (`RequireRole roles={['tenant_admin']}`) just avoids a
 * round-trip for everyone else. Request/response bodies are translated
 * between the backend's snake_case field names and this module's camelCase
 * types.
 */

interface TeamMemberRaw {
  id: string;
  role: TeamRole;
  email: string | null;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_platform_blocked: boolean;
  must_change_pin: boolean;
  assigned_location_id: string | null;
  assigned_location_name: string | null;
  created_at: string;
}

function mapTeamMember(raw: TeamMemberRaw): TeamMember {
  return {
    id: raw.id,
    role: raw.role,
    email: raw.email,
    username: raw.username,
    firstName: raw.first_name,
    lastName: raw.last_name,
    isActive: raw.is_active,
    isPlatformBlocked: raw.is_platform_blocked,
    mustChangePin: raw.must_change_pin,
    assignedLocationId: raw.assigned_location_id,
    assignedLocationName: raw.assigned_location_name,
    createdAt: raw.created_at,
  };
}

export const teamService = {
  /** No pagination — the backend returns a plain array here (confirmed against source, same as tenants/businesses). */
  async listAdmins(): Promise<TeamMember[]> {
    const body = await unwrap<TeamMemberRaw[]>(apiClient.get('/tenant/admins/'));
    return body.map(mapTeamMember);
  },

  /** Gated by `max_tenant_admins` — a lenient-mode tenant at/over cap still adds the admin, with a warning in `meta`; strict mode gets a 422 `quota_exceeded` instead. */
  async addAdmin(
    request: AddAdminRequest,
  ): Promise<{ member: TeamMember; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<TeamMemberRaw>(
      apiClient.post('/tenant/admins/', {
        email: request.email,
        password: request.password,
        first_name: request.firstName || undefined,
        last_name: request.lastName || undefined,
      }),
    );
    return { member: mapTeamMember(data), warning: (meta.warning as string) ?? null };
  },

  /** Reactivating consumes a seat exactly like adding one — same quota gating, same `warning` shape. */
  async activateAdmin(id: string): Promise<{ member: TeamMember; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<TeamMemberRaw>(
      apiClient.post(`/tenant/admins/${id}/activate/`),
    );
    return { member: mapTeamMember(data), warning: (meta.warning as string) ?? null };
  },

  /** Backend blocks deactivating yourself or the last active tenant_admin — surfaces as a normal ApiError. */
  async deactivateAdmin(id: string): Promise<TeamMember> {
    const raw = await unwrap<TeamMemberRaw>(apiClient.post(`/tenant/admins/${id}/deactivate/`));
    return mapTeamMember(raw);
  },

  /** No pagination — every manager + kitchen_staff on the tenant, in one flat list. */
  async listStaff(): Promise<TeamMember[]> {
    const body = await unwrap<TeamMemberRaw[]>(apiClient.get('/tenant/staff/'));
    return body.map(mapTeamMember);
  },

  /**
   * Gated by `max_managers`/`max_kitchen_staff` (whichever `role` is). The
   * new account starts on the default PIN (`000000`, `meta.default_pin`)
   * with `must_change_pin=True` — the caller shows that in a
   * `StaffCredentialModal` rather than letting it disappear in a toast.
   */
  async addStaff(request: AddStaffRequest): Promise<{
    member: TeamMember;
    defaultPin: string;
    warning: string | null;
  }> {
    const { data, meta } = await unwrapWithMeta<TeamMemberRaw>(
      apiClient.post('/tenant/staff/', {
        role: request.role,
        username: request.username,
        first_name: request.firstName || undefined,
        last_name: request.lastName || undefined,
        location_id: request.locationId || undefined,
      }),
    );
    return {
      member: mapTeamMember(data),
      defaultPin: meta.default_pin as string,
      warning: (meta.warning as string) ?? null,
    };
  },

  /** Resets to the same default PIN and forces a change again — same `StaffCredentialModal` reveal as a fresh add. */
  async resetStaffPin(id: string): Promise<{ member: TeamMember; defaultPin: string }> {
    const { data, meta } = await unwrapWithMeta<TeamMemberRaw>(
      apiClient.post(`/tenant/staff/${id}/reset-pin/`),
    );
    return { member: mapTeamMember(data), defaultPin: meta.default_pin as string };
  },

  async assignStaffLocation(id: string, request: AssignLocationRequest): Promise<TeamMember> {
    const raw = await unwrap<TeamMemberRaw>(
      apiClient.post(`/tenant/staff/${id}/assign-location/`, { location_id: request.locationId }),
    );
    return mapTeamMember(raw);
  },

  /** Reactivating consumes a seat exactly like adding one — same quota gating, same `warning` shape. */
  async activateStaff(id: string): Promise<{ member: TeamMember; warning: string | null }> {
    const { data, meta } = await unwrapWithMeta<TeamMemberRaw>(
      apiClient.post(`/tenant/staff/${id}/activate/`),
    );
    return { member: mapTeamMember(data), warning: (meta.warning as string) ?? null };
  },

  async deactivateStaff(id: string): Promise<TeamMember> {
    const raw = await unwrap<TeamMemberRaw>(apiClient.post(`/tenant/staff/${id}/deactivate/`));
    return mapTeamMember(raw);
  },
};
