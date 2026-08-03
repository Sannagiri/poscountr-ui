import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '../constants/auth.constants';

/**
 * Token persistence — isolated behind this module so the storage mechanism
 * can change without touching `authService` or components.
 *
 * Decision (revised — was `sessionStorage`, see git history): `localStorage`.
 * The backend already issues a 30-day sliding-window refresh token (each
 * successful refresh extends it another 30 days from that point), so the
 * intent was always "stay logged in for a long time" — `sessionStorage`
 * undermined that by wiping both tokens on every tab/browser close, which is
 * what counter staff actually experienced as "getting logged out constantly"
 * even though their session was still valid server-side. This backend has
 * no httpOnly-cookie mode (tokens come back in the JSON body), so
 * `localStorage` is the only option that both survives a closed tab and
 * needs no backend change. It does widen the XSS exposure window compared
 * to `sessionStorage` — mitigate via the usual means (CSP, output escaping,
 * no untrusted HTML rendering) rather than by shortening this lifetime.
 */
export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },
};
