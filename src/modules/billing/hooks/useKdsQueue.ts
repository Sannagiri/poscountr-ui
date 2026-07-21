import { BILLING_QUERY_KEYS, KDS_POLL_INTERVAL_MS } from '../constants/billing.constants';
import { billingService } from '../services/billingService';

import { useQuery } from '@tanstack/react-query';

/**
 * The kitchen queue, polled every `KDS_POLL_INTERVAL_MS` (~4s) per the
 * backend's own doc comment on `KDSListView` — there's no push/websocket
 * channel yet, so `refetchInterval` is the whole realtime story for now.
 * `refetchIntervalInBackground: false` (the default) is intentional: a
 * tenant_admin/manager who's tabbed away from the KDS page shouldn't keep
 * hammering the endpoint.
 *
 * `locationId` is `undefined` for manager/kitchen_staff (the backend
 * resolves their own assigned location) and required for tenant_admin —
 * `enabled` holds off the very first fetch until `KitchenPage` has
 * resolved which location to show for a tenant_admin caller.
 */
export function useKdsQueue(locationId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.kds(locationId),
    queryFn: () => billingService.listKds(locationId),
    enabled: options?.enabled ?? true,
    refetchInterval: KDS_POLL_INTERVAL_MS,
  });
}
