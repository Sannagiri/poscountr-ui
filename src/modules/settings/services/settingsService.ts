import { apiClient, unwrap } from '@/services/apiClient';

import type {
  EnforcementMode,
  InvoiceSettings,
  InvoiceSettingsRequest,
  LicensePlan,
  LicensePlanResource,
  ResourceKey,
} from '../types/settings.types';

/**
 * All calls to `/tenant/license/plan/` and
 * `/tenant/businesses/{id}/invoice-settings/` live here — components and
 * hooks never call `apiClient` directly (docs/coding-standards.md §14).
 * Request/response bodies are translated between the backend's snake_case
 * field names and this module's camelCase types.
 */

interface LicensePlanRaw {
  license_name: string | null;
  enforcement_mode: EnforcementMode;
  license_valid_until: string | null;
  resources: Record<ResourceKey, LicensePlanResource>;
}

function mapLicensePlan(raw: LicensePlanRaw): LicensePlan {
  return {
    licenseName: raw.license_name,
    enforcementMode: raw.enforcement_mode,
    licenseValidUntil: raw.license_valid_until,
    resources: raw.resources,
  };
}

interface InvoiceSettingsRaw {
  id: string;
  business_id: string;
  numbering_prefix: string;
  numbering_format: string;
  logo_required: boolean;
  logo_url: string;
  header_note: string;
  footer_note: string;
  show_customer_gstin: boolean;
}

function mapInvoiceSettings(raw: InvoiceSettingsRaw): InvoiceSettings {
  return {
    id: raw.id,
    businessId: raw.business_id,
    numberingPrefix: raw.numbering_prefix,
    numberingFormat: raw.numbering_format,
    logoRequired: raw.logo_required,
    logoUrl: raw.logo_url,
    headerNote: raw.header_note,
    footerNote: raw.footer_note,
    showCustomerGstin: raw.show_customer_gstin,
  };
}

function invoiceSettingsRequestToBody(request: InvoiceSettingsRequest) {
  return {
    numbering_prefix: request.numberingPrefix,
    numbering_format: request.numberingFormat,
    logo_required: request.logoRequired,
    header_note: request.headerNote,
    footer_note: request.footerNote,
    show_customer_gstin: request.showCustomerGstin,
  };
}

export const settingsService = {
  /** The acting tenant_admin's own plan & usage — every capped resource, `IsTenantAdmin`-gated server-side. */
  async getLicensePlan(): Promise<LicensePlan> {
    const raw = await unwrap<LicensePlanRaw>(apiClient.get('/tenant/license/plan/'));
    return mapLicensePlan(raw);
  },

  async getInvoiceSettings(businessId: string): Promise<InvoiceSettings> {
    const raw = await unwrap<InvoiceSettingsRaw>(
      apiClient.get(`/tenant/businesses/${businessId}/invoice-settings/`),
    );
    return mapInvoiceSettings(raw);
  },

  async updateInvoiceSettings(
    businessId: string,
    request: InvoiceSettingsRequest,
  ): Promise<InvoiceSettings> {
    const raw = await unwrap<InvoiceSettingsRaw>(
      apiClient.patch(
        `/tenant/businesses/${businessId}/invoice-settings/`,
        invoiceSettingsRequestToBody(request),
      ),
    );
    return mapInvoiceSettings(raw);
  },

  async uploadInvoiceLogo(businessId: string, file: File): Promise<InvoiceSettings> {
    const formData = new FormData();
    formData.append('logo', file);
    const raw = await unwrap<InvoiceSettingsRaw>(
      apiClient.post(`/tenant/businesses/${businessId}/invoice-settings/logo/`, formData),
    );
    return mapInvoiceSettings(raw);
  },

  async removeInvoiceLogo(businessId: string): Promise<InvoiceSettings> {
    const raw = await unwrap<InvoiceSettingsRaw>(
      apiClient.delete(`/tenant/businesses/${businessId}/invoice-settings/logo/`),
    );
    return mapInvoiceSettings(raw);
  },
};
