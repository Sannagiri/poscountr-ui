import { TEAM_QUERY_KEYS } from '../constants/team.constants';
import { teamService } from '../services/teamService';

import { useQuery } from '@tanstack/react-query';

/** Every tenant_admin on the acting tenant (the acting admin's own peers). */
export function useAdmins() {
  return useQuery({
    queryKey: TEAM_QUERY_KEYS.admins,
    queryFn: teamService.listAdmins,
  });
}
