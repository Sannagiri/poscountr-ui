import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { businessesService } from '../services/businessesService';

import { useQuery } from '@tanstack/react-query';

/** Business entities + locations usage vs. the tenant's effective license limit. */
export function useLicenseUsage() {
  return useQuery({
    queryKey: BUSINESSES_QUERY_KEYS.licenseUsage,
    queryFn: businessesService.getLicenseUsage,
  });
}
