import { OCCUPANCY_POLL_INTERVAL_MS, TABLES_QUERY_KEYS } from '../constants/tables.constants';
import { tablesService } from '../services/tablesService';

import { useQuery } from '@tanstack/react-query';

/**
 * A location's floor plan, with live occupancy embedded per table.
 *
 * `poll: true` (the table-select screen) re-fetches on the same cadence the
 * Kitchen Display uses, so occupancy doesn't go stale while the screen sits
 * open; the layout editor leaves it off — repositioning a chip mid-drag has
 * no business fighting a background refetch.
 */
export function useTables(locationId: string | undefined, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: TABLES_QUERY_KEYS.tables(locationId ?? ''),
    queryFn: () => tablesService.listTables(locationId as string),
    enabled: Boolean(locationId),
    refetchInterval: options?.poll ? OCCUPANCY_POLL_INTERVAL_MS : false,
  });
}
