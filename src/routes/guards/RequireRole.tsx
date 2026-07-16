import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '@/modules/auth';
import { useAuthStore } from '@/modules/auth';

export interface RequireRoleProps {
  roles: UserRole[];
}

/**
 * Section-level role gate — e.g. only `tenant_admin` reaches `/businesses`,
 * only `ultra_admin` reaches `/platform/*`. A role that doesn't match is
 * sent to their own home rather than shown a raw 403, since the sidebar
 * already never links them there in the first place (this only guards
 * someone typing the URL directly).
 */
export function RequireRole({ roles }: RequireRoleProps) {
  const role = useAuthStore((state) => state.user?.role);

  if (!role) return <Navigate to="/login" replace />;

  if (!roles.includes(role)) {
    return <Navigate to={role === 'ultra_admin' ? '/platform' : '/dashboard'} replace />;
  }

  return <Outlet />;
}
