import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { businessesService } from '../services/businessesService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every business (operating entity) on the acting tenant.
 *
 * `enabled` defaults to on — pass `false` for a caller that can't call
 * `/tenant/businesses/` at all (it's `IsTenantAdmin`-gated server-side;
 * `Topbar`'s business switcher, shared by both `tenant_admin` and `manager`,
 * is the motivating case — a manager would get a 403).
 */
export function useBusinesses(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: BUSINESSES_QUERY_KEYS.businesses,
    queryFn: businessesService.listBusinesses,
    enabled: options?.enabled ?? true,
  });
}
