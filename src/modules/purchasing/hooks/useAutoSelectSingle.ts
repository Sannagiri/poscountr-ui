import { useEffect } from 'react';

/**
 * When `items` resolves to exactly one entry and nothing is selected yet,
 * auto-picks it — same small utility `billing`'s own `useAutoSelectSingle`
 * provides for `NewOrderPage`'s business/location pickers, duplicated here
 * rather than imported cross-module since it isn't part of that module's
 * public barrel. `NewPurchaseOrderPage` uses this for the same
 * business/location pickers so a tenant with exactly one of either never has
 * to touch that dropdown.
 */
export function useAutoSelectSingle(
  items: { id: string }[] | undefined,
  current: string | undefined,
  onSelect: (id: string) => void,
) {
  useEffect(() => {
    if (current || !items) return;
    if (items.length === 1) onSelect(items[0].id);
  }, [items, current, onSelect]);
}
