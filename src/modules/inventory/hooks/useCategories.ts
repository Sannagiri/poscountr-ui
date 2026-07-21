import { INVENTORY_QUERY_KEYS } from '../constants/inventory.constants';
import { inventoryService } from '../services/inventoryService';

import { useQuery } from '@tanstack/react-query';

/** Distinct existing category names (scoped the same as `useProducts`) — powers the product form's "existing or free-text" category field. */
export function useCategories() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEYS.categories,
    queryFn: inventoryService.listCategories,
  });
}
