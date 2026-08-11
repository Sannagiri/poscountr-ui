import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth';
import type { ModuleKey } from '@/modules/platform';

export interface RequireModuleProps {
  module: ModuleKey;
}

/**
 * Section-level module gate — e.g. `/reports/*` and `/payment-terminals`
 * only reach a tenant whose `Tenant.enabled_modules` includes that module
 * (set by the Ultra Admin per tenant, independent of role). Orthogonal to
 * `RequireRole`: both guards nest on the same routes, each dropping to its
 * own fallback rather than a raw 403, matching `RequireRole`'s own
 * reasoning — the sidebar already never links here when the module is off,
 * this only guards someone typing the URL directly.
 */
export function RequireModule({ module }: RequireModuleProps) {
  const enabledModules = useAuthStore((state) => state.user?.enabledModules);

  if (!enabledModules?.includes(module)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
