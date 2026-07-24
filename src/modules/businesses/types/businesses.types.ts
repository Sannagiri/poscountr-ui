/**
 * Types mirror the real Django serializers in `apps/businesses/` — field
 * names and value unions are the backend's contract, not invented here
 * (docs/coding-standards.md §25). See
 * `apps/businesses/serializers/{input,output}.py`, `apps/businesses/
 * constants.py` (EntityType), `apps/businesses/models/{business_entity,
 * location}.py`.
 */

export type EntityType = 'restaurant' | 'retail' | 'pharmacy' | 'grocery' | 'cafe' | 'other';

/** Mirrors `apps/businesses/constants.py`'s `IndianState` — 2-letter state/UT abbreviation. */
export type IndianState = string;

/** One business (operating entity) under the tenant. */
export interface BusinessEntity {
  id: string;
  name: string;
  entityType: EntityType;
  /** 15-char GSTIN, or `null` when not set — optional on the backend. */
  gstin: string | null;
  phone: string;
  /** The state this business is GST-registered in — required before an invoice can be generated for any of its orders (drives the CGST/SGST vs IGST split). `''` when not yet set. */
  state: IndianState | '';
  isActive: boolean;
  createdAt: string;
}

/** `BusinessEntity` minus server-assigned fields — POST full, PATCH partial. */
export interface BusinessEntityRequest {
  name: string;
  entityType: EntityType;
  gstin?: string;
  phone?: string;
  state?: IndianState | '';
}

/**
 * A physical outlet of a `BusinessEntity`. The address is structured (not one
 * free-text field) — `addressLine1`/`addressLine2` are still free text, but
 * `city`/`state`/`pincode` are their own fields so they can be validated and
 * formatted individually instead of parsed out of one blob of text.
 */
export interface Location {
  id: string;
  businessId: string;
  /** Denormalized by the backend's `LocationOutputSerializer` so a location's card/row never needs a separate business lookup. */
  businessName: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: IndianState | '';
  pincode: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

/** `Location` minus server-assigned fields — `businessId` is fixed at create time, never changed on update. */
export interface LocationRequest {
  businessId: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: IndianState | '';
  pincode?: string;
  phone?: string;
}

/** One capped resource's usage vs. its effective limit (plan cap, or a per-tenant override if set). */
export interface LicenseUsageResource {
  used: number;
  limit: number;
}

/**
 * Mirrors `TenantLicenseUsageView`'s response — deliberately just the two
 * resources the Businesses screen shows, not every resource a
 * license caps (that fuller picture, `QuotaService.summary`, stays
 * ultra_admin-only on the Platform Console).
 */
export interface LicenseUsage {
  businessEntities: LicenseUsageResource;
  locations: LicenseUsageResource;
}
