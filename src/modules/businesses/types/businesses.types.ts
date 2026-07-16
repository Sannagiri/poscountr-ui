/**
 * Types mirror the real Django serializers in `apps/businesses/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See
 * `apps/businesses/serializers/{input,output}.py`, `apps/businesses/
 * constants.py` (EntityType), `apps/businesses/models/{business_entity,
 * location}.py`.
 */

export type EntityType = 'restaurant' | 'retail' | 'pharmacy' | 'grocery' | 'cafe' | 'other';

/** One business (operating entity) under the tenant. */
export interface BusinessEntity {
  id: string;
  name: string;
  entityType: EntityType;
  /** 15-char GSTIN, or `null` when not set — optional on the backend. */
  gstin: string | null;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

/** `BusinessEntity` minus server-assigned fields — POST full, PATCH partial. */
export interface BusinessEntityRequest {
  name: string;
  entityType: EntityType;
  gstin?: string;
  phone?: string;
}

/** A physical outlet of a `BusinessEntity`. */
export interface Location {
  id: string;
  businessId: string;
  /** Denormalized by the backend's `LocationOutputSerializer` so a location's card/row never needs a separate business lookup. */
  businessName: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

/** `Location` minus server-assigned fields — `businessId` is fixed at create time, never changed on update. */
export interface LocationRequest {
  businessId: string;
  name: string;
  address?: string;
  phone?: string;
}
