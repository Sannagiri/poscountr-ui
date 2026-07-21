import { BILLING_QUERY_KEYS } from '../constants/billing.constants';
import { billingService } from '../services/billingService';

import { useQuery } from '@tanstack/react-query';

/** Orders visible to the actor, scoped + filtered server-side by `status`/`locationId` — pass `{}` for the unfiltered list. */
export function useOrders(filters: { status?: string; locationId?: string } = {}) {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.orders(filters),
    queryFn: () => billingService.listOrders(filters),
  });
}
