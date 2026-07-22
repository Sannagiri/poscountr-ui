/**
 * Types mirror the real Django serializers in `apps/staff_management/` —
 * field names and value unions are the backend's contract, not invented
 * here (docs/coding-standards.md §25). See
 * `apps/staff_management/serializers/{input,output}.py`,
 * `apps/staff_management/services/team_service.py`.
 */

export type TeamRole = 'tenant_admin' | 'manager' | 'kitchen_staff';

/**
 * `TeamMemberOutputSerializer` — the same shape for an admin (tenant_admin)
 * and a staff member (manager/kitchen_staff); which fields are meaningful
 * differs by `role` (an admin has `email`, no PIN/location; a staff member
 * has `username`+PIN state+`assignedLocation*`, no `email`).
 */
export interface TeamMember {
  id: string;
  role: TeamRole;
  email: string | null;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isPlatformBlocked: boolean;
  mustChangePin: boolean;
  assignedLocationId: string | null;
  assignedLocationName: string | null;
  createdAt: string;
}

/** `AddAdminInputSerializer` — another tenant_admin, password auth like the acting admin themselves. */
export interface AddAdminRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export type StaffRole = Extract<TeamRole, 'manager' | 'kitchen_staff'>;

/**
 * `AddStaffInputSerializer` — a manager or kitchen_staff, username+PIN auth
 * (the default PIN, never chosen here). `locationId` follows the backend's
 * staff-location rule (`TeamService._resolve_staff_location`): required
 * only when the tenant has 2+ active locations, auto-assigned when there's
 * exactly one, `undefined` when there are none yet.
 */
export interface AddStaffRequest {
  role: StaffRole;
  username: string;
  firstName?: string;
  lastName?: string;
  locationId?: string;
}

export interface AssignLocationRequest {
  locationId: string;
}

/**
 * `UpdateStaffInputSerializer` — editing an existing manager/kitchen_staff's
 * role, username, name, and (optionally) location in one call. `locationId`
 * follows the same staff-location rule as `AddStaffRequest` (required only
 * with 2+ active locations); omitted entirely leaves the current location
 * untouched rather than clearing it — there's no "unassign" affordance
 * anywhere else in the app, so Edit doesn't introduce one either.
 */
export interface UpdateStaffRequest {
  role: StaffRole;
  username: string;
  firstName?: string;
  lastName?: string;
  locationId?: string;
}
