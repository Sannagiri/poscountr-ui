import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';

import { useQuery } from '@tanstack/react-query';

/** Every ultra_admin account — the "Platform admins" screen. */
export function usePlatformAdmins() {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.platformAdmins,
    queryFn: platformService.listPlatformAdmins,
  });
}
