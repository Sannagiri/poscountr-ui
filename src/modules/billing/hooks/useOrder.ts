import {
  BILLING_QUERY_KEYS,
  PAYMENT_STATUS_POLL_INTERVAL_MS,
} from '../constants/billing.constants';
import { billingService } from '../services/billingService';

import { useQuery } from '@tanstack/react-query';

/**
 * One order's full detail — `OrderDetailPage`'s data source; also refetched
 * after every item/transition mutation via `invalidateQueries`.
 *
 * `poll: true` (only `TerminalPaymentPanel`, while a gateway payment intent
 * is outstanding) re-fetches on `PAYMENT_STATUS_POLL_INTERVAL_MS` so the
 * caller can notice the order flip to `completed` once the webhook lands —
 * same opt-in shape `useTables`' own `poll` option uses. Off by default so
 * every other caller of this hook is unaffected.
 */
export function useOrder(orderId: string | undefined, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.order(orderId ?? ''),
    queryFn: () => billingService.getOrder(orderId as string),
    enabled: Boolean(orderId),
    refetchInterval: options?.poll ? PAYMENT_STATUS_POLL_INTERVAL_MS : false,
  });
}
