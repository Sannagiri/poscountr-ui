/** Route paths owned by the auth module — imported by the router, never hardcoded at call sites. */
export const AUTH_ROUTES = {
  login: '/login',
  changePin: '/change-pin',
} as const;

/** PIN policy mirrors POSCountr-authentication-system.md §7 (client-side UX check only — the server is the source of truth). */
export const PIN_LENGTH = 6;

export const ACCESS_TOKEN_STORAGE_KEY = 'poscountr.access_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'poscountr.refresh_token';

/** `BroadcastChannel` name used to hand a session between tabs of the same origin without ever putting it in `localStorage` — see `authTabSync.ts`. */
export const AUTH_SYNC_CHANNEL_NAME = 'poscountr.auth-sync';
