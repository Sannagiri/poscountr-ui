import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { businessesService } from '../services/businessesService';

import { useQuery } from '@tanstack/react-query';

/** Every business (operating entity) on the acting tenant. */
export function useBusinesses() {
  return useQuery({
    queryKey: BUSINESSES_QUERY_KEYS.businesses,
    queryFn: businessesService.listBusinesses,
  });
}
