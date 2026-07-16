/**
 * Types mirror POSCountr-authentication-system.md exactly — field names,
 * roles, and auth-method values are the backend's contract, not invented
 * here (docs/coding-standards.md §25).
 */

export type UserRole = 'ultra_admin' | 'tenant_admin' | 'manager' | 'kitchen_staff';

export type Client = 'web';

export type AuthMethod = 'password' | 'pin';

/** Roles allowed to reach this web client (kitchen_staff is mobile-only). */
export const WEB_ROLES: UserRole[] = ['ultra_admin', 'tenant_admin', 'manager'];

export interface IdentifyRequest {
  client: Client;
  tenantSlug?: string;
  email?: string;
  username?: string;
}

export interface IdentifyResponse {
  role: UserRole;
  authMethod: AuthMethod;
  displayName: string;
  mustChangePin: boolean;
  tenantName?: string;
}

export interface LoginRequest {
  client: Client;
  tenantSlug?: string;
  email?: string;
  username?: string;
  password?: string;
  pin?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  mustChangePin: boolean;
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  email: string | null;
  username: string | null;
  fullName: string;
  tenantId: string | null;
  tenantName: string | null;
  mustChangePin: boolean;
}
