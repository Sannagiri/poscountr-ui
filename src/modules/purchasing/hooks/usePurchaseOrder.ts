import { PURCHASING_QUERY_KEYS } from '../constants/purchasing.constants';
import { purchasingService } from '../services/purchasingService';

import { useQuery } from '@tanstack/react-query';

/** One purchase order's full detail — `PurchaseOrderDetailPage`'s data source; also refetched after every item/transition/way-bill mutation via `invalidateQueries`. */
export function usePurchaseOrder(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: PURCHASING_QUERY_KEYS.purchaseOrder(purchaseOrderId ?? ''),
    queryFn: () => purchasingService.getPurchaseOrder(purchaseOrderId as string),
    enabled: Boolean(purchaseOrderId),
  });
}
