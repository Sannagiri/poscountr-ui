import { TEAM_QUERY_KEYS } from '../constants/team.constants';
import { teamService } from '../services/teamService';

import { useQuery } from '@tanstack/react-query';

/** Every manager + kitchen_staff on the acting tenant. */
export function useStaff() {
  return useQuery({
    queryKey: TEAM_QUERY_KEYS.staff,
    queryFn: teamService.listStaff,
  });
}
