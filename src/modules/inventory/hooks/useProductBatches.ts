import { INVENTORY_QUERY_KEYS } from '../constants/inventory.constants';
import { inventoryService } from '../services/inventoryService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every batch for one product, FEFO order — fetched per-product on demand
 * (`enabled`) rather than eagerly for every product in the list, since
 * batches only exist/matter for pharmacy (batch-tracked) products and
 * `BatchesModal` is the only caller.
 */
export function useProductBatches(productId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEYS.batches(productId ?? ''),
    queryFn: () => inventoryService.listBatches(productId as string),
    enabled: Boolean(productId) && (options?.enabled ?? true),
  });
}
