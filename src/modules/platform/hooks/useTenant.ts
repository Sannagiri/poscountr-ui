import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';

import { useQuery } from '@tanstack/react-query';

/** A single business's full detail — feeds the Tenant detail page. */
export function useTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.tenant(tenantId ?? ''),
    queryFn: () => platformService.getTenant(tenantId as string),
    enabled: Boolean(tenantId),
  });
}
