import type { EntityType, IndianState } from '../types/businesses.types';

/** Route paths owned by the businesses module — imported by the router, never hardcoded at call sites. */
export const BUSINESSES_ROUTES = {
  businesses: '/businesses',
  locations: '/locations',
} as const;

/** TanStack Query cache keys for this module — shared between hooks/pages so invalidation stays consistent. */
export const BUSINESSES_QUERY_KEYS = {
  businesses: ['businesses'] as const,
  locations: ['businesses', 'locations'] as const,
  licenseUsage: ['businesses', 'license-usage'] as const,
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

/** Mirrors `apps/businesses/constants.py`'s `IndianState.choices` exactly — same list used for a location's address `state` field. */
export const INDIAN_STATE_OPTIONS: { value: IndianState; label: string }[] = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CG', label: 'Chhattisgarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OD', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'OT', label: 'Other Territory' },
];
