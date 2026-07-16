/** Route paths owned by the platform module — imported by the router, never hardcoded at call sites. */
export const PLATFORM_ROUTES = {
  dashboard: '/platform',
  tenants: '/platform/tenants',
  licenseTypes: '/platform/license-types',
  admins: '/platform/admins',
  auditLog: '/platform/audit-log',
} as const;

/** TanStack Query cache keys for this module — shared between hooks/pages so invalidation stays consistent. */
export const PLATFORM_QUERY_KEYS = {
  tenants: ['platform', 'tenants'] as const,
  tenant: (id: string) => ['platform', 'tenants', id] as const,
  tenantAdmins: (id: string) => ['platform', 'tenants', id, 'admins'] as const,
  licenseTypes: ['platform', 'license-types'] as const,
  platformAdmins: ['platform', 'admins'] as const,
  auditLogs: (filters?: { tenantId?: string; action?: string }) =>
    ['platform', 'audit-logs', filters ?? {}] as const,
};
