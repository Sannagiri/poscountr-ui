import { create } from 'zustand';

import { registerAuthSession } from '@/services/apiClient';

import { authService } from '../services/authService';
import {
  registerCrossTabLogoutListener,
  registerCrossTabSessionResponder,
  requestSessionFromOtherTabs,
} from '../services/authTabSync';
import { tokenStorage } from '../services/tokenStorage';
import type { CurrentUser } from '../types/auth.types';

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  setSession: (accessToken: string, refreshToken: string, user: CurrentUser) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  setSession: (accessToken, refreshToken, user) => {
    tokenStorage.setTokens(accessToken, refreshToken);
    set({ status: 'authenticated', user });
  },
  clearSession: () => {
    tokenStorage.clear();
    set({ status: 'unauthenticated', user: null });
  },
  bootstrap: async () => {
    let accessToken = tokenStorage.getAccessToken();

    // No token in this tab's own sessionStorage — before giving up and
    // showing the login screen, ask any sibling tab (same origin, already
    // logged in) to hand this tab its session over BroadcastChannel. This
    // never touches localStorage; it's a live handoff between tabs that
    // happen to be open at the same moment, which is exactly the "I opened
    // a second tab and it made me log in again even though I'm already
    // logged in" complaint this fixes.
    if (!accessToken) {
      set({ status: 'authenticating' });
      const shared = await requestSessionFromOtherTabs();
      if (shared) {
        tokenStorage.setTokens(shared.accessToken, shared.refreshToken);
        accessToken = shared.accessToken;
      }
    }

    if (!accessToken) {
      set({ status: 'unauthenticated' });
      return;
    }

    try {
      const user = await authService.me();
      set({ status: 'authenticated', user });
    } catch {
      get().clearSession();
    }
  },
}));

/**
 * Wires this tab into the cross-tab session-sync mesh — call once at
 * startup (see `main.tsx`), alongside `registerAuthWithApiClient()`.
 * Lets a freshly opened sibling tab ask this one for its session (if this
 * tab is authenticated), and logs this tab out if a sibling tab explicitly
 * logs out. Tokens are never written to `localStorage` by any of this —
 * see `tokenStorage.ts`'s security-decision comment.
 */
export function registerCrossTabAuth(): () => void {
  const unregisterResponder = registerCrossTabSessionResponder(() => {
    if (useAuthStore.getState().status !== 'authenticated') return null;
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  });

  const unregisterLogoutListener = registerCrossTabLogoutListener(() => {
    useAuthStore.getState().clearSession();
  });

  return () => {
    unregisterResponder();
    unregisterLogoutListener();
  };
}

export function registerAuthWithApiClient(): void {
  registerAuthSession({
    getAccessToken: () => tokenStorage.getAccessToken(),
    refreshAccessToken: async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const result = await authService.refresh(refreshToken);
        tokenStorage.setTokens(result.accessToken, result.refreshToken);
        return result.accessToken;
      } catch {
        return null;
      }
    },
    onSessionExpired: () => {
      useAuthStore.getState().clearSession();
    },
  });
}
