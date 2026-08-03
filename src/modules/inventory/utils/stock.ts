import { isStockRowLow } from '../constants/inventory.constants';
import type { Product } from '../types/inventory.types';

function findStockRow(product: Product, locationId: string) {
  return product.stock.find((entry) => entry.locationId === locationId);
}

/**
 * On-hand stock for `product` at `locationId`.
 *
 * Returns `null` — meaning "don't clamp or warn, treat as unlimited" — in
 * two cases: the product isn't stock-tracked (a made-to-order/kitchen item,
 * where a stock ceiling makes no sense), or `locationId` isn't resolvable
 * yet (e.g. a manager's own assigned location, which the frontend has no
 * way to look up client-side — see `NewOrderPage`'s own note on this; the
 * backend's `_upsert_item` stock check is still the real gate in that case).
 * Otherwise returns the number (0 if no `StockItem` row exists for that
 * location yet) — `product.stock` already carries every location's on-hand
 * quantity (`ProductOutputSerializer.get_stock`), so this never needs a
 * separate fetch.
 */
export function getAvailableStock(product: Product, locationId: string | undefined): number | null {
  if (!product.isStockTracked || !locationId) return null;
  const row = findStockRow(product, locationId);
  return row ? Number(row.quantity) : 0;
}

/**
 * Short "N in stock" / "Low stock: N" / "Out of stock" label for a product
 * tile, or `null` when there's nothing worth showing (not stock-tracked, or
 * location unresolved — same cases `getAvailableStock` returns `null` for).
 */
export function getStockLabel(product: Product, locationId: string | undefined): string | null {
  const available = getAvailableStock(product, locationId);
  if (available === null) return null;
  if (available <= 0) return 'Out of stock';
  const row = locationId ? findStockRow(product, locationId) : undefined;
  if (row && isStockRowLow(row)) return `Low stock: ${available}`;
  return `${available} in stock`;
}

/** Tone for `getStockLabel`'s text — pair them together at the call site. */
export function getStockTone(
  product: Product,
  locationId: string | undefined,
): 'danger' | 'warning' | 'faint' {
  const available = getAvailableStock(product, locationId);
  if (available === null) return 'faint';
  if (available <= 0) return 'danger';
  const row = locationId ? findStockRow(product, locationId) : undefined;
  if (row && isStockRowLow(row)) return 'warning';
  return 'faint';
}
