import { PLATFORM_QUERY_KEYS } from '../constants/platform.constants';
import { platformService } from '../services/platformService';
import type { AuditLogFilters } from '../types/platform.types';

import { useQuery } from '@tanstack/react-query';

/**
 * The platform's append-only action feed. Filters are server-side
 * (`tenant_id`/`action`) so changing them re-fetches rather than filtering a
 * client-side cache — matches the backend's own 200-row cap, there's no
 * larger cached set to filter locally.
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.auditLogs(filters),
    queryFn: () => platformService.listAuditLogs(filters),
  });
}
