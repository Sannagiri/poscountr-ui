import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { businessesService } from '../services/businessesService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every location across all of the tenant's businesses — the backend has no
 * per-business list endpoint, so `LocationsModal` filters this flat list by
 * `businessId` client-side rather than the frontend inventing a query param
 * the API doesn't support.
 */
export function useLocations() {
  return useQuery({
    queryKey: BUSINESSES_QUERY_KEYS.locations,
    queryFn: businessesService.listLocations,
  });
}
