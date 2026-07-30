import { PURCHASING_QUERY_KEYS } from '../constants/purchasing.constants';
import { purchasingService } from '../services/purchasingService';

import { useQuery } from '@tanstack/react-query';

/** Purchase orders visible to the actor, scoped + filterable server-side by `status`/`locationId`/`supplierId` — pass `{}` for the unfiltered list. */
export function usePurchaseOrders(
  filters: { status?: string; locationId?: string; supplierId?: string } = {},
) {
  return useQuery({
    queryKey: PURCHASING_QUERY_KEYS.purchaseOrders(filters),
    queryFn: () => purchasingService.listPurchaseOrders(filters),
  });
}
