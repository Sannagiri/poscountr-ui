import { apiClient, unwrap } from '@/services/apiClient';

import type { InvoiceRaw } from '@/modules/reports/services/reportsService';
// Concrete-file import, not the `@/modules/reports` barrel — see the same
// note in `billingService.ts` (avoids a billing <-> reports barrel cycle).
import { mapInvoice } from '@/modules/reports/services/reportsService';
import type { Invoice } from '@/modules/reports/types/reports.types';

/**
 * Calls to `/tenant/orders/{id}/invoice/` and `/tenant/invoices/{id}/pdf/` —
 * a separate namespace from `billingService`'s `/tenant/orders/` +
 * `/tenant/kds/` scope, so it gets its own file rather than widening that
 * one. Reuses `Invoice`/`mapInvoice` from `modules/reports` rather than
 * redeclaring the shape.
 */
export const invoiceService = {
  /**
   * Generate the GST invoice for a completed order. Idempotent — the
   * backend returns the already-generated invoice on a repeat call, so this
   * is safe to call from a "Download bill" button even after a page reload.
   */
  async generateInvoice(orderId: string): Promise<Invoice> {
    const raw = await unwrap<InvoiceRaw>(apiClient.post(`/tenant/orders/${orderId}/invoice/`));
    return mapInvoice(raw);
  },

  /** Attaches a client-rendered PDF to an invoice, storing it in S3 (field name `pdf`, matching `InvoicePdfUploadView`). */
  async uploadInvoicePdf(invoiceId: string, file: File): Promise<Invoice> {
    const formData = new FormData();
    formData.append('pdf', file);
    const raw = await unwrap<InvoiceRaw>(
      apiClient.post(`/tenant/invoices/${invoiceId}/pdf/`, formData),
    );
    return mapInvoice(raw);
  },

  /**
   * Permanently pins (or, with `null`, unpins) which print layout this
   * invoice renders with — set from the Bill Preview modal's Layout
   * dropdown. Distinct from the layout-switcher's own `layoutOverride`
   * elsewhere in this module, which only affects one preview render and is
   * never persisted.
   */
  async setInvoiceLayout(invoiceId: string, layoutTemplateId: string | null): Promise<Invoice> {
    const raw = await unwrap<InvoiceRaw>(
      apiClient.post(`/tenant/invoices/${invoiceId}/layout/`, {
        layout_template_id: layoutTemplateId,
      }),
    );
    return mapInvoice(raw);
  },
};
