import type { EntityType } from '../types/businesses.types';

/** Route paths owned by the businesses module — imported by the router, never hardcoded at call sites. */
export const BUSINESSES_ROUTES = {
  businesses: '/businesses',
} as const;

/** TanStack Query cache keys for this module — shared between hooks/pages so invalidation stays consistent. */
export const BUSINESSES_QUERY_KEYS = {
  businesses: ['businesses'] as const,
  locations: ['businesses', 'locations'] as const,
};

/** Mirrors the backend's `EntityType.choices` (apps/businesses/constants.py) — order shown in the picker and every filter dropdown. */
export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'retail', label: 'Retail' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'other', label: 'Other' },
];
