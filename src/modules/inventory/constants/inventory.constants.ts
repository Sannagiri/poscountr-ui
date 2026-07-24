import type { PharmacySchedule, Unit } from '../types/inventory.types';

/** Route paths owned by the inventory module — imported by the router, never hardcoded at call sites. */
export const INVENTORY_ROUTES = {
  products: '/inventory',
} as const;

/** TanStack Query cache keys for this module — shared between hooks/pages so invalidation stays consistent. Batches are keyed per-product (only fetched when that product's Batches modal is open), not listed tenant-wide. */
export const INVENTORY_QUERY_KEYS = {
  products: ['inventory', 'products'] as const,
  categories: ['inventory', 'categories'] as const,
  batches: (productId: string) => ['inventory', 'products', productId, 'batches'] as const,
};

/** Mirrors the backend's `Unit.choices` (apps/inventory/constants.py) — order shown in the picker. */
export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kilogram' },
  { value: 'g', label: 'Gram' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml', label: 'Millilitre' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'plate', label: 'Plate' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'meter', label: 'Meter' },
];

/** Mirrors the backend's `PharmacySchedule.choices` (apps/inventory/constants.py). */
export const PHARMACY_SCHEDULE_OPTIONS: { value: PharmacySchedule; label: string }[] = [
  { value: 'otc', label: 'OTC (over the counter)' },
  { value: 'h', label: 'Schedule H' },
  { value: 'h1', label: 'Schedule H1' },
  { value: 'x', label: 'Schedule X' },
  { value: 'g', label: 'Schedule G' },
];

/**
 * A stock row counts as low once it has an actual threshold set
 * (`reorderLevel > 0`) and on-hand quantity has fallen to it or below —
 * `reorderLevel === 0` reads as "no threshold configured" rather than
 * "alert at zero," matching `reorder_level`'s own `default=0` on the
 * backend (every product starts with no threshold, not a zero threshold);
 * without this guard every brand-new product would render as "low stock"
 * from the moment it's created.
 */
export function isStockRowLow(row: { quantity: string; reorderLevel: string }): boolean {
  const reorderLevel = Number(row.reorderLevel);
  return reorderLevel > 0 && Number(row.quantity) <= reorderLevel;
}

/**
 * Units sold by count, never by fraction — a quantity in one of these is
 * always a whole number, both on screen and in whatever's typed into a
 * quantity field. Everything else (`kg`/`g`/`litre`/`ml`/`meter`) is a
 * weight/volume/length unit, sold in fractional amounts (0.5 kg of rice),
 * capped at one decimal place rather than left at the backend's full
 * `decimal(_,3)` precision.
 */
const COUNTABLE_UNITS: ReadonlySet<Unit> = new Set([
  'pcs',
  'pack',
  'box',
  'dozen',
  'plate',
  'bottle',
]);

export function isCountableUnit(unit: Unit): boolean {
  return COUNTABLE_UNITS.has(unit);
}

/**
 * Decimal fields stay `string` end-to-end everywhere else in this module
 * (see `inventory.types.ts`'s own doc comment on why) — always at their
 * full stored precision (e.g. `100.000`), which reads as noise for what's
 * usually a plain whole-number quantity. This is *display only*; every
 * read that isn't a label — a form default value, a write payload — keeps
 * using the raw string.
 *
 * Without a `unit` (the caller doesn't know or care which product this
 * quantity belongs to), trims trailing zeros off the full 3-place
 * precision, same as before. With a `unit`, applies the stricter rule
 * above: a whole number for a countable unit, at most one decimal place
 * otherwise.
 */
export function formatQuantity(value: string, unit?: Unit): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  if (!unit) return num.toFixed(3).replace(/\.?0+$/, '') || '0';
  if (isCountableUnit(unit)) return String(Math.round(num));
  return num.toFixed(1).replace(/\.0$/, '') || '0';
}
