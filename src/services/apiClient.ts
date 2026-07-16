import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

import { env } from '@/config/env';

import type { ApiEnvelope } from '@/types/api';
import { ApiError } from '@/types/api';

/**
 * Auth is wired in from `modules/auth` at app startup via
 * `registerAuthSession(...)` rather than imported directly here — this file
 * has no dependency on any module, and any module can depend on it
 * (docs/coding-standards.md §14, "keep API calls inside service files").
 */
interface AuthSessionPort {
  getAccessToken: () => string | null;
  /** Performs the refresh-rotation call and returns the new access token, or null if it failed. */
  refreshAccessToken: () => Promise<string | null>;
  /** Called when the session cannot be recovered (refresh failed, or a 401 with session_revoked). */
  onSessionExpired: () => void;
}

let authSession: AuthSessionPort | null = null;

export function registerAuthSession(port: AuthSessionPort): void {
  authSession = port;
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authSession?.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Retry queue so concurrent 401s during a refresh only trigger one
// /auth/refresh call, not one per in-flight request.
let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const originalRequest = error.config as
      (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const envelope = error.response?.data;
    const code = envelope?.code;
    const status = error.response?.status;

    const isRecoverableAuthError =
      status === 401 &&
      code === 'token_expired' &&
      authSession &&
      originalRequest &&
      !originalRequest._retried;

    if (isRecoverableAuthError && originalRequest) {
      originalRequest._retried = true;
      refreshPromise ??= authSession!.refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return apiClient(originalRequest);
      }
      authSession?.onSessionExpired();
    }

    if (status === 401 && (code === 'session_revoked' || code === 'invalid_token')) {
      authSession?.onSessionExpired();
    }

    if (envelope) {
      return Promise.reject(new ApiError(envelope.code, envelope.message, envelope.errors, status));
    }

    return Promise.reject(
      new ApiError(
        'network_error',
        'Could not reach the server. Check your connection.',
        null,
        status,
      ),
    );
  },
);

/** Unwraps the `{ data }` envelope so callers work with the resource directly. */
export async function unwrap<TData>(
  promise: Promise<{ data: ApiEnvelope<TData> }>,
): Promise<TData> {
  const response = await promise;
  return response.data.data as TData;
}

/**
 * Same as `unwrap`, but also returns the envelope's `meta` — for the few
 * endpoints that attach something a caller needs beyond the resource itself
 * (e.g. `apps/businesses/services/business_service.py`'s lenient-mode
 * `{"warning": "..."}` on an at/over-cap create or reactivate). Most callers
 * should keep using plain `unwrap`; reach for this one only when `meta`
 * actually carries something.
 */
export async function unwrapWithMeta<TData>(
  promise: Promise<{ data: ApiEnvelope<TData> }>,
): Promise<{ data: TData; meta: Record<string, unknown> }> {
  const response = await promise;
  return { data: response.data.data as TData, meta: response.data.meta };
}
