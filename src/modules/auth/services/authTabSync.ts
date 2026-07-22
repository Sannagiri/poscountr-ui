import { AUTH_SYNC_CHANNEL_NAME } from '../constants/auth.constants';

/**
 * Cross-tab session handoff — lets a freshly opened tab pick up the session
 * a sibling tab already has, without ever putting tokens in `localStorage`
 * (see `tokenStorage.ts` for why that constraint exists). Tokens still live
 * only in each tab's own `sessionStorage`; this module just relays them
 * between tabs of the same origin over a `BroadcastChannel`, which never
 * touches disk and only reaches other currently-open tabs, not future ones.
 *
 * Each function opens its own short-lived (or listener-scoped) channel
 * rather than sharing one module-level instance, so there's no shared
 * mutable state to reason about across Vite HMR reloads or tests.
 */

interface SharedSession {
  accessToken: string;
  refreshToken: string;
}

type SyncMessage =
  | { type: 'request-session' }
  | { type: 'share-session'; session: SharedSession }
  | { type: 'session-cleared' };

function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
}

/**
 * Called from a fresh tab's `bootstrap()` when it has no local access token.
 * Asks any other open tab for its session and waits up to `timeoutMs` for a
 * reply. Resolves `null` (never rejects) if there's no `BroadcastChannel`
 * support, no other tab responds in time, or no other tab is logged in —
 * all of which just fall back to today's normal "please log in" behavior.
 */
export function requestSessionFromOtherTabs(timeoutMs = 400): Promise<SharedSession | null> {
  return new Promise((resolve) => {
    const channel = openChannel();
    if (!channel) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (session: SharedSession | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.close();
      resolve(session);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data.type === 'share-session') {
        finish(event.data.session);
      }
    };

    channel.postMessage({ type: 'request-session' } satisfies SyncMessage);
  });
}

/**
 * Called once at startup on every tab. Listens for `request-session`
 * messages from newly opened tabs and, if this tab currently holds an
 * authenticated session, replies with it. `getSession` is read live on each
 * incoming request (not captured once) so it always reflects this tab's
 * current state. Returns an unsubscribe function.
 */
export function registerCrossTabSessionResponder(
  getSession: () => SharedSession | null,
): () => void {
  const channel = openChannel();
  if (!channel) return () => {};

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type !== 'request-session') return;
    const session = getSession();
    if (!session) return;
    channel.postMessage({ type: 'share-session', session } satisfies SyncMessage);
  };

  return () => channel.close();
}

/**
 * Called from the explicit logout call site (`Topbar.handleLogout`) — not
 * from the store's `clearSession()` itself, since that's also invoked from
 * automatic paths (`bootstrap()`'s catch, `apiClient`'s `onSessionExpired`)
 * where broadcasting would wrongly log out a sibling tab whose own token is
 * still perfectly valid.
 */
export function broadcastSessionCleared(): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: 'session-cleared' } satisfies SyncMessage);
  channel.close();
}

/**
 * Called once at startup on every tab. When a sibling tab explicitly logs
 * out, clears this tab's session too so it doesn't keep working on a
 * revoked refresh token. Returns an unsubscribe function.
 */
export function registerCrossTabLogoutListener(onLogout: () => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    if (event.data.type === 'session-cleared') {
      onLogout();
    }
  };

  return () => channel.close();
}
