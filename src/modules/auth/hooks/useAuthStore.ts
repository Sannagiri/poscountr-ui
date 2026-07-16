import { create } from 'zustand';

import { registerAuthSession } from '@/services/apiClient';

import { authService } from '../services/authService';
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

/**
 * The single source of truth for "who is signed in." UI state (is the PIN
 * pad open, which step of login) stays local to `LoginPage`; only the
 * resolved session lives here — this is genuinely shared, cross-route state
 * (docs/coding-standards.md §15).
 */
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
    const accessToken = tokenStorage.getAccessToken();
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
 * Wires the auth store into the shared `apiClient` (token attach + silent
 * refresh + forced logout on an unrecoverable 401). Call once, at app
 * startup — see `src/main.tsx`.
 */
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
