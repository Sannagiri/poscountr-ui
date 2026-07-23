import { useEffect } from 'react';

/**
 * When `items` resolves to exactly one entry and nothing is selected yet,
 * auto-picks it — generalizes the "pick the first business once loaded"
 * effect `InvoiceSettingsPage` already uses, but only when there's truly a
 * single option (not just "pick whichever loads first"). `NewOrderPage`
 * uses this for both the business and business-filtered location pickers so
 * a tenant with exactly one of either never has to touch that dropdown.
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
