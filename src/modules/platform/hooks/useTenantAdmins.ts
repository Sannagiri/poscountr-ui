import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';

import { useQuery } from '@tanstack/react-query';

/** The owner + any additional tenant_admins on one business — Tenant detail's "Admins" tab. */
export function useTenantAdmins(tenantId: string | undefined) {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.tenantAdmins(tenantId ?? ''),
    queryFn: () => platformService.listTenantAdmins(tenantId as string),
    enabled: Boolean(tenantId),
  });
}
