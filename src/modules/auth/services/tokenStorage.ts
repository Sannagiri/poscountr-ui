import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '../constants/auth.constants';

/**
 * Token persistence — isolated behind this module so the storage mechanism
 * can change without touching `authService` or components.
 *
 * Decision (recommended default, flagged for the F1 confirm-gate per
 * poscountr-ui-execution-roadmap.md): `sessionStorage`, not `localStorage`.
 * This backend has no httpOnly-cookie mode (tokens come back in the JSON
 * body), so pure in-memory storage would force a full re-login on every
 * page refresh — unacceptable for counter staff. `sessionStorage` persists
 * across reloads in the same tab but clears on tab/browser close, which
 * bounds the XSS exposure window compared to `localStorage`.
 * Never store the refresh token in `localStorage`.
 */
export const tokenStorage = {
  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },
  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },
  clear(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },
};
