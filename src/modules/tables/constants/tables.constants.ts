import type { TableShape, TableSize } from '../types/tables.types';

/**
 * TanStack Query cache keys for this module. Function-keyed by `locationId`
 * (server-filtered, distinct responses per location) — same convention
 * `BILLING_QUERY_KEYS.order`/`.kds` use, not a flat client-filtered list
 * like `businesses`' `locations` key (there's no "all tables" endpoint).
 */
export const TABLES_QUERY_KEYS = {
  tables: (locationId: string) => ['tables', locationId] as const,
};

/** Mirrors the backend's `TableShape.choices` (apps/tables/constants.py). */
export const TABLE_SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
];

/** Mirrors the backend's `TableSize.choices` (apps/tables/constants.py). */
export const TABLE_SIZE_OPTIONS: { value: TableSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/**
 * How often the table-select screen re-polls occupancy while it's open —
 * same cadence the Kitchen Display already polls at (`KDS_POLL_INTERVAL_MS`
 * in `billing.constants.ts`), so two staff picking tables around the same
 * time don't act on stale data for long. Defined locally rather than
 * imported cross-module since billing doesn't export that constant outside
 * its own module.
 */
export const OCCUPANCY_POLL_INTERVAL_MS = 4000;
