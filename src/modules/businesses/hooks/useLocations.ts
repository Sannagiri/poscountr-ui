import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { businessesService } from '../services/businessesService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every location across all of the tenant's businesses — the backend has no
 * per-business list endpoint, so `LocationsModal` filters this flat list by
 * `businessId` client-side rather than the frontend inventing a query param
 * the API doesn't support.
 *
 * `enabled` defaults to on — pass `false` for a caller reachable by a
 * `manager` (this endpoint is `IsTenantAdmin`-gated server-side, same as
 * `useBusinesses`). Every pre-existing caller of this hook sits behind a
 * tenant_admin-only route already, so this only matters starting with
 * `NewOrderPage`, which both roles can reach.
 */
export function useLocations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: BUSINESSES_QUERY_KEYS.locations,
    queryFn: businessesService.listLocations,
    enabled: options?.enabled ?? true,
  });
}
