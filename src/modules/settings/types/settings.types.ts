/**
 * Types mirror the real Django serializers/enums in `apps/platform/` and
 * `apps/invoicing/` — field names and value unions are the backend's
 * contract, not invented here (docs/coding-standards.md §25). See
 * `apps/businesses/views/license_usage.py`'s `TenantLicensePlanView`,
 * `apps/platform/constants.py` (`ResourceKey`, `EnforcementMode`),
 * `apps/invoicing/models/invoice_settings.py`,
 * `apps/invoicing/serializers/{input,output}.py`.
 */

/** Mirrors `ResourceKey.choices` (apps/platform/constants.py) exactly. */
export type ResourceKey =
  | 'tenant_admins'
  | 'managers'
  | 'kitchen_staff'
  | 'business_entities'
  | 'locations'
  | 'products'
  | 'monthly_transactions';

/** Mirrors `EnforcementMode.choices` (apps/platform/constants.py). */
export type EnforcementMode = 'lenient' | 'strict';

/** One capped resource's current usage vs. its effective limit (plan cap, or a per-tenant override if set). */
export interface LicensePlanResource {
  used: number;
  limit: number;
}

/**
 * Mirrors `TenantLicensePlanView`'s response — every resource a license
 * caps, plus the plan's name and the tenant's effective enforcement mode.
 * The narrower `LicenseUsage` (businesses module) stays the Businesses
 * screen's own two-resource slice; this is the fuller "My plan & usage"
 * read, `IsTenantAdmin`-gated same as everything else on this page.
 */
export interface LicensePlan {
  licenseName: string | null;
  enforcementMode: EnforcementMode;
  licenseValidUntil: string | null;
  resources: Record<ResourceKey, LicensePlanResource>;
}

/**
 * One business's invoice numbering + branding configuration
 * (`InvoiceSettings` model) — one row per `BusinessEntity`, since numbering
 * and branding are legally tied to a specific GSTIN.
 */
export interface InvoiceSettings {
  id: string;
  businessId: string;
  numberingPrefix: string;
  numberingFormat: string;
  logoRequired: boolean;
  /** Public S3 URL, or `''` when no logo has been uploaded yet. */
  logoUrl: string;
  headerNote: string;
  footerNote: string;
  showCustomerGstin: boolean;
}

/** `PATCH /tenant/businesses/{id}/invoice-settings/` body — partial, every field optional. */
export interface InvoiceSettingsRequest {
  numberingPrefix?: string;
  numberingFormat?: string;
  logoRequired?: boolean;
  headerNote?: string;
  footerNote?: string;
  showCustomerGstin?: boolean;
}

/** Mirrors `OrderResetPeriod.choices` (apps/billing/constants.py) exactly. */
export type OrderResetPeriod = 'daily' | 'monthly' | 'yearly' | 'continuous';

/**
 * One business's order configuration (`OrderSettings` model) — one row per
 * `BusinessEntity`, shared across all of that business's locations: order
 * numbering, whether customer name/phone are mandatory at order creation,
 * and whether the business runs the kitchen (KOT/KDS) flow.
 *
 * `numberingStart` is a digit string (e.g. `'0001'`), not a number — its
 * length is the zero-padding width applied to every generated order number,
 * and its integer value is the sequence used on each reset. A plain
 * `<input type="number">` can't hold a leading zero, which is why this stays
 * a string end-to-end (mirrors `OrderSettings.numbering_start` on the backend).
 */
export interface OrderSettings {
  id: string;
  businessId: string;
  resetPeriod: OrderResetPeriod;
  numberingPrefix: string;
  numberingStart: string;
  customerNameRequired: boolean;
  customerPhoneRequired: boolean;
  kitchenEnabled: boolean;
}

/** `PATCH /tenant/businesses/{id}/order-settings/` body — partial, every field optional. */
export interface OrderSettingsRequest {
  resetPeriod?: OrderResetPeriod;
  numberingPrefix?: string;
  numberingStart?: string;
  customerNameRequired?: boolean;
  customerPhoneRequired?: boolean;
  kitchenEnabled?: boolean;
}
