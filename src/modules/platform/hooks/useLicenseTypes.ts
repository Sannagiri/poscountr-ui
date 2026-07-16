import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';

import { useQuery } from '@tanstack/react-query';

/** License plans available to assign to a tenant — feeds the "New business" form's dropdown. */
export function useLicenseTypes() {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.licenseTypes,
    queryFn: platformService.listLicenseTypes,
  });
}
