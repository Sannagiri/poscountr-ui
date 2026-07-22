import { apiClient, unwrap } from '@/services/apiClient';

import type { Invoice, InvoiceHsnLine, InvoiceListFilters } from '../types/reports.types';

/**
 * All calls to `/tenant/invoices/` live here — components and hooks never
 * call `apiClient` directly (docs/coding-standards.md §14). Request/response
 * bodies are translated between the backend's snake_case field names and
 * this module's camelCase types.
 */

interface InvoiceHsnLineRaw {
  hsn_code: string;
  gst_rate: string;
  taxable_value: string;
  tax_amount: string;
}

function mapHsnLine(raw: InvoiceHsnLineRaw): InvoiceHsnLine {
  return {
    hsnCode: raw.hsn_code,
    gstRate: raw.gst_rate,
    taxableValue: raw.taxable_value,
    taxAmount: raw.tax_amount,
  };
}

interface InvoiceRaw {
  id: string;
  order_id: string;
  business_id: string;
  location_id: string;
  invoice_number: string;
  financial_year: string;
  sequence_number: number;
  issued_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  customer_state: string;
  business_state: string;
  is_interstate: boolean;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  round_off: string;
  total: string;
  pdf_url: string;
  pdf_uploaded_at: string | null;
  hsn_summary: InvoiceHsnLineRaw[];
}

function mapInvoice(raw: InvoiceRaw): Invoice {
  return {
    id: raw.id,
    orderId: raw.order_id,
    businessId: raw.business_id,
    locationId: raw.location_id,
    invoiceNumber: raw.invoice_number,
    financialYear: raw.financial_year,
    sequenceNumber: raw.sequence_number,
    issuedAt: raw.issued_at,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerEmail: raw.customer_email,
    customerGstin: raw.customer_gstin,
    customerState: raw.customer_state,
    businessState: raw.business_state,
    isInterstate: raw.is_interstate,
    taxableValue: raw.taxable_value,
    cgstAmount: raw.cgst_amount,
    sgstAmount: raw.sgst_amount,
    igstAmount: raw.igst_amount,
    roundOff: raw.round_off,
    total: raw.total,
    pdfUrl: raw.pdf_url,
    pdfUploadedAt: raw.pdf_uploaded_at,
    hsnSummary: raw.hsn_summary.map(mapHsnLine),
  };
}

export const reportsService = {
  /**
   * Every invoice visible to the actor (same tenant_admin/manager scope as
   * billing) — no server-side date filter exists, so the Reports page
   * fetches once and narrows client-side by its own date range, same
   * "fetch once, filter client-side" pattern `OrdersPage` established for
   * orders.
   */
  async listInvoices(filters: InvoiceListFilters = {}): Promise<Invoice[]> {
    const raw = await unwrap<InvoiceRaw[]>(
      apiClient.get('/tenant/invoices/', {
        params: {
          business_id: filters.businessId,
          location_id: filters.locationId,
          financial_year: filters.financialYear,
        },
      }),
    );
    return raw.map(mapInvoice);
  },
};
