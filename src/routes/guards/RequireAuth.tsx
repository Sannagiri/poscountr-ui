import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@/components';

import { useAuthStore } from '@/modules/auth';

/**
 * Gate for every authenticated route. Runs `bootstrap()` once (resolves
 * `/auth/me` from a stored token so a page refresh doesn't force a fresh
 * login) and redirects to `/login` if that fails — mirrors the backend's
 * "session-bound access token" model (POSCountr-authentication-system.md §6):
 * a stale/revoked token here should end at the login screen, not a broken page.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle') {
      void bootstrap();
    }
  }, [status, bootstrap]);

  if (status === 'idle' || status === 'authenticating') {
    return <Loader label="Loading POSCountr…" className="min-h-screen" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
