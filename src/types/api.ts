/**
 * Shape of every response from the POSCountr API — confirmed against the
 * actual DRF exception handler + response wrapper
 * (`poscountr-api/apps/common/response.py` + `exception_handler.py`), not
 * assumed. Kept in one place so a change to the envelope only touches this
 * file (docs/coding-standards.md §25).
 */
export interface ApiEnvelope<TData> {
  success: boolean;
  /** Mirrors the exception/response code — 'ok' | 'created' | 'validation_error' | ... */
  code: string;
  message: string;
  data: TData | null;
  /** Field-level validation errors (DRF `serializer.errors` shape) — null on success. */
  errors: Record<string, string[]> | null;
  /** Always present; empty object unless the endpoint attaches pagination/warnings. */
  meta: Record<string, unknown>;
}

/**
 * Error codes actually emitted by the backend
 * (POSCountr-authentication-system.md §14 + platform/inventory/billing modules
 * + `apps/common/exceptions.py`). Kept as a union, not `string`, so a typo in
 * a `code === '...'` check is a compile error, not a silent runtime miss.
 */
export type ApiErrorCode =
  | 'validation_error'
  | 'invalid_credentials'
  | 'not_authenticated'
  | 'invalid_token'
  | 'token_expired'
  | 'session_revoked'
  | 'account_inactive'
  | 'account_blocked'
  | 'client_not_allowed'
  | 'tenant_inactive'
  | 'account_locked'
  | 'permission_denied'
  | 'impersonation_read_only'
  | 'user_not_found'
  | 'not_found'
  | 'quota_exceeded'
  | 'pin_policy'
  | 'throttled'
  | 'server_error'
  | 'network_error';

/** Normalized shape every service function throws on failure. */
export class ApiError extends Error {
  code: string;
  /** Field-level validation errors, when `code === 'validation_error'`. */
  errors?: Record<string, string[]>;
  status?: number;

  constructor(
    code: string,
    message: string,
    errors?: Record<string, string[]> | null,
    status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.errors = errors ?? undefined;
    this.status = status;
  }
}
