import { BILLING_QUERY_KEYS } from '../constants/billing.constants';
import { billingService } from '../services/billingService';

import { useQuery } from '@tanstack/react-query';

/** One order's full detail — `OrderDetailPage`'s data source; also refetched after every item/transition mutation via `invalidateQueries`. */
export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.order(orderId ?? ''),
    queryFn: () => billingService.getOrder(orderId as string),
    enabled: Boolean(orderId),
  });
}
