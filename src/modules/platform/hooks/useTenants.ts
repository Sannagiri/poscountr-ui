import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';

import { useQuery } from '@tanstack/react-query';

/** All tenants ("businesses") on the platform — ultra_admin only. */
export function useTenants() {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.tenants,
    queryFn: platformService.listTenants,
  });
}
