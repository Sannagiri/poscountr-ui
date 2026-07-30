import { PURCHASING_QUERY_KEYS } from '../constants/purchasing.constants';
import { purchasingService } from '../services/purchasingService';

import { useQuery } from '@tanstack/react-query';

/** Suppliers visible to the actor — manager pre-scoped to their own business server-side, tenant_admin sees every business's (same scoping shape `useProducts`/`useOrders` already establish). Pass `{}` for the unfiltered list. */
export function useSuppliers(filters: { businessId?: string; isActive?: string } = {}) {
  return useQuery({
    queryKey: PURCHASING_QUERY_KEYS.suppliers(filters),
    queryFn: () => purchasingService.listSuppliers(filters),
  });
}
