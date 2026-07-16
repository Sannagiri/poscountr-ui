import { apiClient, unwrap } from '@/services/apiClient';

import type {
  CurrentUser,
  IdentifyRequest,
  IdentifyResponse,
  LoginRequest,
  LoginResponse,
} from '../types/auth.types';

/**
 * All calls to `/auth/*` live here — components and hooks never call
 * `apiClient` directly (docs/coding-standards.md §14). Request/response
 * bodies are translated between the backend's snake_case field names
 * (POSCountr-authentication-system.md §4–5) and this module's camelCase types.
 */
export const authService = {
  async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
    const body = await unwrap(
      apiClient.post('/auth/identify/', {
        client: request.client,
        tenant_slug: request.tenantSlug,
        email: request.email,
        username: request.username,
      }),
    );
    const raw = body as {
      role: IdentifyResponse['role'];
      auth_method: IdentifyResponse['authMethod'];
      display_name: string;
      must_change_pin: boolean;
      tenant_name?: string;
    };
    return {
      role: raw.role,
      authMethod: raw.auth_method,
      displayName: raw.display_name,
      mustChangePin: raw.must_change_pin,
      tenantName: raw.tenant_name,
    };
  },

  async login(request: LoginRequest): Promise<LoginResponse> {
    const body = await unwrap(
      apiClient.post('/auth/login/', {
        client: request.client,
        tenant_slug: request.tenantSlug,
        email: request.email,
        username: request.username,
        password: request.password,
        pin: request.pin,
      }),
    );
    const raw = body as {
      access_token: string;
      refresh_token: string;
      role: LoginResponse['role'];
      must_change_pin: boolean;
    };
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      role: raw.role,
      mustChangePin: raw.must_change_pin,
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const body = await unwrap(apiClient.post('/auth/refresh/', { refresh_token: refreshToken }));
    const raw = body as { access_token: string; refresh_token: string };
    return { accessToken: raw.access_token, refreshToken: raw.refresh_token };
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout/');
  },

  async me(): Promise<CurrentUser> {
    const body = await unwrap(apiClient.get('/auth/me/'));
    const raw = body as {
      id: string;
      role: CurrentUser['role'];
      email: string | null;
      username: string | null;
      full_name: string;
      tenant_id: string | null;
      tenant_name: string | null;
      must_change_pin: boolean;
    };
    return {
      id: raw.id,
      role: raw.role,
      email: raw.email,
      username: raw.username,
      fullName: raw.full_name,
      tenantId: raw.tenant_id,
      tenantName: raw.tenant_name,
      mustChangePin: raw.must_change_pin,
    };
  },

  async changePin(currentPin: string, newPin: string): Promise<void> {
    await apiClient.post('/auth/change-pin/', { current_pin: currentPin, new_pin: newPin });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};
