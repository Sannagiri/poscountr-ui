// Concrete-file import, not the `@/modules/reports` barrel — see the note in
// `billingService.ts` (avoids a billing <-> reports barrel cycle).
import { useCallback } from 'react';

import type { Invoice } from '@/modules/reports/types/reports.types';
import { settingsService } from '@/modules/settings';

import { invoiceService } from '../services/invoiceService';
import type { Order } from '../types/billing.types';
import { buildThermalBillPdf } from '../utils/thermalBillPdf';

import { useQueryClient } from '@tanstack/react-query';

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function billFilename(invoice: Invoice): string {
  return `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
}

/**
 * Renders the bill fresh from the invoice/order/current settings data —
 * used both for the first-ever render (nothing in S3 yet) and for a later
 * preview/reprint. Deliberately doesn't fetch whatever was previously
 * uploaded to S3 (that would need a signed/proxied read same as the logo
 * does) — regenerating from the same snapshot data is simpler and
 * functionally identical bar one edge case: if the business's invoice
 * settings (header/footer/logo) changed after this order completed, a later
 * preview reflects the *current* settings, not the ones in effect at
 * generation time.
 */
async function buildBillBlob(order: Order, invoice: Invoice): Promise<Blob> {
  const invoiceSettings = await settingsService.getInvoiceSettings(order.businessId);
  const logoBlob = invoiceSettings.logoUrl
    ? await settingsService.getInvoiceLogoBlob(order.businessId).catch(() => null)
    : null;
  return buildThermalBillPdf({ invoice, order, invoiceSettings, logoBlob });
}

/**
 * The one place that decides whether an order's bill needs to be
 * (re-)rendered, or already exists in S3 — used both right after an order
 * completes (automatic) and from a manual "Download bill" button (recovery,
 * reprints). Never renders/uploads twice for the same invoice: a non-empty
 * `pdfUrl` always means the PDF already made it to S3.
 */
export function useOrderBill() {
  const queryClient = useQueryClient();

  const ensureBillDownloaded = useCallback(
    async (order: Order, knownInvoice?: Invoice | null): Promise<void> => {
      // Idempotent on the backend — reuses the invoice `OrderCompleteView`
      // already generated, or fetches it fresh (e.g. after a page reload).
      const invoice = knownInvoice ?? (await invoiceService.generateInvoice(order.id));

      if (invoice.pdfUrl) {
        window.open(invoice.pdfUrl, '_blank');
        return;
      }

      const blob = await buildBillBlob(order, invoice);
      triggerBrowserDownload(blob, billFilename(invoice));

      const file = new File([blob], billFilename(invoice), { type: 'application/pdf' });
      await invoiceService.uploadInvoicePdf(invoice.id, file);
      queryClient.invalidateQueries({ queryKey: ['reports', 'invoices'] });
    },
    [queryClient],
  );

  /**
   * For the "preview this order's bill later" flow (e.g. from the Orders
   * table, after completion) — always regenerates a fresh blob rather than
   * opening the stored `pdfUrl` directly, so the preview modal's iframe/
   * download/print all work from one same-origin `blob:` URL with no
   * cross-origin restrictions to fight (same reasoning as the logo proxy).
   */
  const previewBill = useCallback(
    async (order: Order): Promise<{ invoice: Invoice; blob: Blob }> => {
      const invoice = await invoiceService.generateInvoice(order.id);
      const blob = await buildBillBlob(order, invoice);
      return { invoice, blob };
    },
    [],
  );

  return { ensureBillDownloaded, previewBill };
}

export { billFilename };
