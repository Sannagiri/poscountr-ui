import { INVENTORY_QUERY_KEYS } from '../constants/inventory.constants';
import { inventoryService } from '../services/inventoryService';

import { useQuery } from '@tanstack/react-query';

/** Every product visible to the actor — pre-scoped server-side (manager → their business only, tenant_admin → everything); filter/search client-side over this one list. */
export function useProducts() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEYS.products,
    queryFn: inventoryService.listProducts,
  });
}
