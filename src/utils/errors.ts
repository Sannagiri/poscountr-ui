import { ApiError } from '@/types/api';

/**
 * Turns any thrown value from a service call into a user-facing message.
 * Every mutation's `onError` in the app should route through this instead of
 * inlining the same `error instanceof ApiError` check per page
 * (previously duplicated in `LoginPage` and `TenantsPage` — centralized here
 * once a third caller needed it, docs/coding-standards.md §14).
 */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
