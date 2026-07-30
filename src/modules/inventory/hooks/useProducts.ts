import { INVENTORY_QUERY_KEYS } from '../constants/inventory.constants';
import { inventoryService } from '../services/inventoryService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every product visible to the actor — pre-scoped server-side (manager →
 * their business only, tenant_admin → everything); filter/search client-side
 * over this one list.
 *
 * `locationId` omitted → this raw master-catalog list (`ProductsPage`,
 * `ProductFormModal`'s admin views, unaffected by per-location overrides).
 * Passed → the server resolves the *effective* per-location view instead
 * (excludes products turned off at that location, resolves override price/
 * discount into `effectiveSellingPrice`/`effectiveDiscountPercent`) — used
 * by `NewOrderPage` once a location is selected. Cached under a distinct key
 * per location, never the plain `products` key (see that key's own comment).
 *
 * `enabled: false` (e.g. `NewOrderPage` waiting on a location pick for a
 * multi-location business) skips the fetch entirely rather than firing it
 * with `locationId` still `undefined` — avoids fetching the unfiltered list
 * only to immediately re-fetch the location-scoped one a moment later.
 */
export function useProducts(locationId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: locationId
      ? INVENTORY_QUERY_KEYS.productsForLocation(locationId)
      : INVENTORY_QUERY_KEYS.products,
    queryFn: () => inventoryService.listProducts(locationId),
    enabled: options?.enabled ?? true,
  });
}
