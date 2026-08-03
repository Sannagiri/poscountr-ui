import { useCallback } from 'react';

import { useAuthStore } from '@/modules/auth';
import type { BusinessEntity, Location } from '@/modules/businesses';
import { businessesService } from '@/modules/businesses';
import type { LayoutConfig } from '@/modules/documentLayouts';
import { paymentDetailsService } from '@/modules/paymentDetails';
import { settingsService } from '@/modules/settings';

import { quotationService } from '../services/quotationService';
import type { Quotation } from '../types/quotation.types';
import { buildQuotationPdf } from '../utils/quotationPdf';

import { useQueryClient } from '@tanstack/react-query';

function quotationPdfFilename(quotation: Quotation): string {
  return `${(quotation.quotationNumber ?? quotation.id).replace(/\//g, '-')}.pdf`;
}

/**
 * Best-effort business/location lookup for the quotation document's header
 * — mirrors `usePurchaseOrderBill.ts`'s `fetchBillContext` exactly, minus
 * the supplier lookup (a quotation has a customer, not a supplier, and the
 * customer's own contact fields are already snapshotted directly on the
 * quotation — no separate customer record to fetch). `businessesService.
 * listBusinesses`/`listLocations` are both `IsTenantAdmin`-gated server-side
 * (same constraint `NewOrderPage` already documents), so a manager viewing
 * this page skips the request entirely rather than firing one that's always
 * going to 403 — any failure just means the document renders with the
 * quotation's own already-snapshotted fields and nothing extra.
 */
async function fetchBillContext(
  quotation: Quotation,
): Promise<{ business: BusinessEntity | null; location: Location | null }> {
  const isTenantAdmin = useAuthStore.getState().user?.role === 'tenant_admin';

  const [business, location] = await Promise.all([
    isTenantAdmin
      ? businessesService
          .listBusinesses()
          .then((list) => list.find((item) => item.id === quotation.businessId) ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    isTenantAdmin
      ? businessesService
          .listLocations()
          .then((list) => list.find((item) => item.id === quotation.locationId) ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return { business, location };
}

/**
 * Renders the quotation document fresh from the quotation + the business's
 * one shared invoice-settings logo — there's no separate "quotations
 * settings logo", same reuse `usePurchaseOrderBill.ts` documents for the PO
 * document.
 *
 * `layoutOverride` — `QuotationBillPreviewModal`'s layout-switcher choice —
 * passes straight through to `buildQuotationPdf`; omitted, it resolves the
 * effective layout itself.
 */
async function buildBillBlob(quotation: Quotation, layoutOverride?: LayoutConfig): Promise<Blob> {
  const invoiceSettings = await settingsService.getInvoiceSettings(quotation.businessId);
  const logoBlob = invoiceSettings.logoUrl
    ? await settingsService.getInvoiceLogoBlob(quotation.businessId).catch(() => null)
    : null;
  const { business, location } = await fetchBillContext(quotation);
  // Best-effort, same as `business`/`location` above — `listPaymentDetails`
  // is `tenant_admin`-only server-side, so a manager viewing this page just
  // renders with no payment-details block rather than failing the whole
  // document. Every one of the quotation's business's locations shows the
  // same payment details now (Feature: Payment Details, per-business not
  // per-location), so this resolves straight off `quotation.businessId`.
  const paymentDetails = await paymentDetailsService
    .listPaymentDetails(quotation.businessId)
    .then((list) => list.filter((item) => item.isActive))
    .catch(() => []);
  return buildQuotationPdf({
    quotation,
    invoiceSettings,
    logoBlob,
    business,
    location,
    paymentDetails,
    layoutOverride,
  });
}

/**
 * Mirrors `usePurchaseOrderBill`'s `previewBill`/`ensurePdfUploaded` split —
 * a quotation, like a purchase order (and unlike a sales invoice), has no
 * single "just completed" moment to hang PDF generation off of, so this
 * renders fresh on demand rather than gating behind any particular status.
 */
export function useQuotationBill() {
  const queryClient = useQueryClient();

  /**
   * Always regenerates a fresh blob — current settings/logo rather than
   * whatever was in effect when a stored PDF was last uploaded.
   * `layoutOverride` is the layout-switcher's on-the-fly choice — omit for
   * the effective (business/global/system default) layout.
   */
  const previewBill = useCallback(
    async (quotation: Quotation, layoutOverride?: LayoutConfig): Promise<{ blob: Blob }> => {
      const blob = await buildBillBlob(quotation, layoutOverride);
      return { blob };
    },
    [],
  );

  /** Idempotent on `pdfUrl` — meaningful the moment the quotation exists (it's the document you'd send to the customer to accept/decline), so this is safe to fire right after the first preview builds successfully, regardless of `status`. */
  const ensurePdfUploaded = useCallback(
    async (quotation: Quotation): Promise<Quotation> => {
      if (quotation.pdfUrl) return quotation;
      const blob = await buildBillBlob(quotation);
      const file = new File([blob], quotationPdfFilename(quotation), { type: 'application/pdf' });
      const uploaded = await quotationService.uploadQuotationPdf(quotation.id, file);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      return uploaded;
    },
    [queryClient],
  );

  return { previewBill, ensurePdfUploaded };
}

export { quotationPdfFilename };
