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

/** Mirrors the backend's `apps/billing/constants.py::is_food_flow` / `FOOD_ENTITY_TYPES` — a table (floor-plan seat) only means something for a business that seats dine-in customers. Used to gate the Table layout editor and the "Table-first ordering" setting; a retail/pharmacy/grocery counter never needs either. */
export function isDineInEntityType(entityType: EntityType | undefined): boolean {
  return entityType === 'restaurant' || entityType === 'cafe';
}

/**
 * Mirrors the backend's `apps/quotations/constants.py::can_quote` — the
 * inverse of `isDineInEntityType`: every entity type except the kitchen-flow
 * ones (restaurant/cafe) may raise quotations. Deliberately a deny-list, not
 * an allow-list like `isPurchasingEntityType` below — a new non-food entity
 * type added later is eligible with no change needed here. Used to gate the
 * Quotations nav entry and the "Quotation settings" card on the Orders
 * settings page.
 */
export function isQuotationEligibleEntityType(entityType: EntityType | undefined): boolean {
  return entityType !== undefined && !isDineInEntityType(entityType);
}

/**
 * Mirrors the backend's purchasing-domain gate (`apps/purchasing/`'s own
 * entity-type check) — buy-side purchase orders/suppliers only exist for a
 * stock-holding business; a restaurant/cafe never orders stock in this
 * sense (its "inventory" is made-to-order menu items, not a catalog bought
 * from a supplier). Used to gate the Suppliers/Purchase orders nav entries —
 * see `layouts/AppShell/navConfig.tsx`'s `requiresPurchasingBusiness` flag.
 */
export function isPurchasingEntityType(entityType: EntityType | undefined): boolean {
  return entityType === 'retail' || entityType === 'pharmacy' || entityType === 'grocery';
}

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
