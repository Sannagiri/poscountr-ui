import { useEffect } from 'react';

/**
 * When `items` resolves to exactly one entry and nothing is selected yet,
 * auto-picks it — same small utility `billing`/`purchasing` each provide
 * for their own business/location pickers, duplicated here rather than
 * imported cross-module since it isn't part of either module's public
 * barrel. `NewQuotationPage` uses this for the same business/location
 * pickers so a tenant with exactly one of either never has to touch that
 * dropdown.
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
