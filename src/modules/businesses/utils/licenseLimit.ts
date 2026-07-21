import type { LicenseUsageResource } from '../types/businesses.types';

/**
 * True once `used` has reached (or passed) `limit` for one resource —
 * mirrors the backend's own at/over-limit rule exactly
 * (`QuotaService.check_can_add`'s `current_count >= limit`), so the
 * frontend's proactive disabling agrees with what the backend would
 * actually reject. `undefined` usage (data not loaded yet, or the query
 * failed) reads as "not reached" — this is a proactive UX nicety layered on
 * top of the backend's own enforcement, not a security boundary, so failing
 * open here just means the person finds out from the backend's own
 * warning/error instead of a moment sooner, not that anything is bypassed.
 */
export function isLimitReached(usage: LicenseUsageResource | undefined): boolean {
  return usage ? usage.used >= usage.limit : false;
}

/**
 * Hover text for a disabled "Add"/"Activate" control blocked by this
 * resource's license limit — `undefined` once there's headroom (or no
 * usage data yet), so callers can hand this straight to a `disabledReason`
 * prop and let `undefined` mean "not disabled for this reason."
 */
export function limitReachedReason(
  usage: LicenseUsageResource | undefined,
  resourceLabel: string,
): string | undefined {
  if (!usage || !isLimitReached(usage)) return undefined;
  return `You've used ${usage.used} of ${usage.limit} ${resourceLabel} licenses — deactivate one, or ask your plan admin to increase the limit.`;
}
