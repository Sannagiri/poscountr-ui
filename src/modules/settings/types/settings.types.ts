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
