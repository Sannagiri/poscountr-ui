import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { settingsService } from '../services/settingsService';

import { useQuery } from '@tanstack/react-query';

/** The acting tenant_admin's own plan & usage (`TenantLicensePlanView`) — only reachable from the tenant_admin-only Settings screen. */
export function useLicensePlan() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.licensePlan,
    queryFn: settingsService.getLicensePlan,
  });
}
