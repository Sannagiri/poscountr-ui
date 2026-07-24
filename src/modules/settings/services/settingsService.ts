import { apiClient, unwrap } from '@/services/apiClient';

import type {
  EnforcementMode,
  InvoiceSettings,
  InvoiceSettingsRequest,
  LicensePlan,
  LicensePlanResource,
  OrderSettings,
  OrderSettingsRequest,
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
  numbering_start: string;
  logo_required: boolean;
  logo_url: string;
  header_note: string;
  footer_note: string;
  show_customer_gstin: boolean;
  paper_width: InvoiceSettings['paperWidth'];
}

function mapInvoiceSettings(raw: InvoiceSettingsRaw): InvoiceSettings {
  return {
    id: raw.id,
    businessId: raw.business_id,
    numberingPrefix: raw.numbering_prefix,
    numberingFormat: raw.numbering_format,
    numberingStart: raw.numbering_start,
    logoRequired: raw.logo_required,
    logoUrl: raw.logo_url,
    headerNote: raw.header_note,
    footerNote: raw.footer_note,
    showCustomerGstin: raw.show_customer_gstin,
    paperWidth: raw.paper_width,
  };
}

function invoiceSettingsRequestToBody(request: InvoiceSettingsRequest) {
  return {
    numbering_prefix: request.numberingPrefix,
    numbering_format: request.numberingFormat,
    numbering_start: request.numberingStart,
    logo_required: request.logoRequired,
    header_note: request.headerNote,
    footer_note: request.footerNote,
    show_customer_gstin: request.showCustomerGstin,
    paper_width: request.paperWidth,
  };
}

interface OrderSettingsRaw {
  id: string;
  business_id: string;
  reset_period: OrderSettings['resetPeriod'];
  numbering_prefix: string;
  numbering_start: string;
  customer_name_required: boolean;
  customer_phone_required: boolean;
  kitchen_enabled: boolean;
  table_layout_enabled: boolean;
}

function mapOrderSettings(raw: OrderSettingsRaw): OrderSettings {
  return {
    id: raw.id,
    businessId: raw.business_id,
    resetPeriod: raw.reset_period,
    numberingPrefix: raw.numbering_prefix,
    numberingStart: raw.numbering_start,
    customerNameRequired: raw.customer_name_required,
    customerPhoneRequired: raw.customer_phone_required,
    kitchenEnabled: raw.kitchen_enabled,
    tableLayoutEnabled: raw.table_layout_enabled,
  };
}

function orderSettingsRequestToBody(request: OrderSettingsRequest) {
  return {
    reset_period: request.resetPeriod,
    numbering_prefix: request.numberingPrefix,
    numbering_start: request.numberingStart,
    customer_name_required: request.customerNameRequired,
    customer_phone_required: request.customerPhoneRequired,
    kitchen_enabled: request.kitchenEnabled,
    table_layout_enabled: request.tableLayoutEnabled,
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

  /**
   * The logo's raw image bytes, proxied through this API rather than
   * fetched from the public S3 URL directly — a cross-origin `fetch()` of
   * that URL fails outright whenever the bucket has no CORS policy for this
   * app's origin, which is exactly the case here. Only the client-rendered
   * thermal bill (`thermalBillPdf.ts`) needs this; every other place that
   * just *displays* the logo keeps using `logoUrl` directly in an `<img>`,
   * which never needed CORS to begin with.
   */
  async getInvoiceLogoBlob(businessId: string): Promise<Blob> {
    const response = await apiClient.get(`/tenant/businesses/${businessId}/invoice-settings/logo/file/`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async getOrderSettings(businessId: string): Promise<OrderSettings> {
    const raw = await unwrap<OrderSettingsRaw>(
      apiClient.get(`/tenant/businesses/${businessId}/order-settings/`),
    );
    return mapOrderSettings(raw);
  },

  async updateOrderSettings(
    businessId: string,
    request: OrderSettingsRequest,
  ): Promise<OrderSettings> {
    const raw = await unwrap<OrderSettingsRaw>(
      apiClient.patch(
        `/tenant/businesses/${businessId}/order-settings/`,
        orderSettingsRequestToBody(request),
      ),
    );
    return mapOrderSettings(raw);
  },
};
