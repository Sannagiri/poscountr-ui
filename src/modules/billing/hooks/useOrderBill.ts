// Concrete-file import, not the `@/modules/reports` barrel — see the note in
// `billingService.ts` (avoids a billing <-> reports barrel cycle).
import { useCallback } from 'react';

import type { LayoutConfig, ThermalLayoutConfig } from '@/modules/documentLayouts';
import {
  documentLayoutsService,
  SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG,
} from '@/modules/documentLayouts';
import { paymentDetailsService } from '@/modules/paymentDetails';
import type { Invoice } from '@/modules/reports/types/reports.types';
import { settingsService } from '@/modules/settings';

import { invoiceService } from '../services/invoiceService';
import type { Order } from '../types/billing.types';
import { buildInvoicePdf } from '../utils/invoicePdf';
import { buildThermalBillPdf } from '../utils/thermalBillPdf';

import { useQueryClient } from '@tanstack/react-query';

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
 *
 * `invoiceSettings.paperWidth === 'a4'` branches to the formal A4 "TAX
 * INVOICE" template (`invoicePdf.ts`) instead of the thermal receipt — the
 * only place in the app that decides which of the two an order's bill
 * renders as. The A4 path additionally resolves the order's business's
 * active payment details (Feature: Payment Details, owned per business); a
 * thermal receipt never shows that block, so the plain path skips the extra
 * fetch entirely.
 *
 * `layoutOverride` — `OrderBillPreviewModal`'s layout-switcher choice for
 * the A4 path only (`buildInvoicePdf`'s own one-off preview override — see
 * that function's doc comment). The thermal path has no equivalent
 * parameter: picking a layout in that same modal persists immediately via
 * `invoiceService.setInvoiceLayout` and re-generates, so by the time this
 * runs again `invoice.layoutTemplateId` already reflects the pick — nothing
 * temporary to thread through here.
 */
async function buildBillBlob(
  order: Order,
  invoice: Invoice,
  layoutOverride?: LayoutConfig,
): Promise<Blob> {
  const invoiceSettings = await settingsService.getInvoiceSettings(order.businessId);
  const logoBlob = invoiceSettings.logoUrl
    ? await settingsService.getInvoiceLogoBlob(order.businessId).catch(() => null)
    : null;
  if (invoiceSettings.paperWidth === 'a4') {
    // Every one of the order's business's locations shows the same payment
    // details now (Feature: Payment Details, per-business not per-location),
    // so this resolves straight off `order.businessId` — no location-specific
    // assignment left to look up.
    const paymentDetails = await paymentDetailsService
      .listPaymentDetails(order.businessId)
      .then((list) => list.filter((item) => item.isActive))
      .catch(() => []);
    return buildInvoicePdf({
      invoice,
      order,
      invoiceSettings,
      logoBlob,
      paymentDetails,
      layoutOverride,
    });
  }
  const config =
    (await resolvePinnedThermalLayoutConfig(invoice.layoutTemplateId)) ??
    (await resolveThermalLayoutConfig(order.businessId));
  const orderSettings = await settingsService.getOrderSettings(order.businessId).catch(() => null);
  return buildThermalBillPdf({
    invoice,
    order,
    invoiceSettings,
    logoBlob,
    config,
    includeKotSlip: orderSettings?.kotReceiptEnabled ?? false,
  });
}

/** The business's effective Thermal Bill layout — same fallback-never-blocks-rendering rule `invoicePdf.ts`'s own resolution chain follows (a broken network call degrades to the hardcoded system default, never fails the whole render). */
async function resolveThermalLayoutConfig(businessId: string): Promise<ThermalLayoutConfig> {
  return documentLayoutsService
    .resolveEffective({ businessId, documentType: 'thermal_bill' })
    .then((effective) => effective.config as ThermalLayoutConfig)
    .catch(() => SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG);
}

/** This invoice's own permanently pinned layout (`Invoice.layoutTemplateId` — the same field/pin `invoicePdf.ts`'s `resolvePinnedLayoutConfig` reads for the A4 path, set via `OrderBillPreviewModal.tsx`'s Layout dropdown), if it still exists and is active. `null` (never throws) when unpinned, deleted, or deactivated, so the caller falls through to the business's current default instead of failing the whole render. */
async function resolvePinnedThermalLayoutConfig(
  layoutTemplateId: string | null,
): Promise<ThermalLayoutConfig | null> {
  if (!layoutTemplateId) return null;
  try {
    const template = await documentLayoutsService.get(layoutTemplateId);
    return template.isActive ? (template.config as ThermalLayoutConfig) : null;
  } catch {
    return null;
  }
}

/**
 * The one place that decides whether an order's bill needs to be
 * (re-)rendered, or already exists in S3 — used right after an order
 * completes so the PDF is ready in S3 (for reprints, and for the WhatsApp
 * "send bill" link, which needs a real URL to share) without popping a
 * browser download on every completion. Never renders/uploads twice for
 * the same invoice: a non-empty `pdfUrl` always means the PDF already made
 * it to S3.
 */
export function useOrderBill() {
  const queryClient = useQueryClient();

  const ensureBillUploaded = useCallback(
    async (order: Order, knownInvoice?: Invoice | null): Promise<Invoice> => {
      // Idempotent on the backend — reuses the invoice `OrderCompleteView`
      // already generated, or fetches it fresh (e.g. after a page reload).
      const invoice = knownInvoice ?? (await invoiceService.generateInvoice(order.id));
      if (invoice.pdfUrl) return invoice;

      const blob = await buildBillBlob(order, invoice);
      const file = new File([blob], billFilename(invoice), { type: 'application/pdf' });
      const uploaded = await invoiceService.uploadInvoicePdf(invoice.id, file);
      queryClient.invalidateQueries({ queryKey: ['reports', 'invoices'] });
      return uploaded;
    },
    [queryClient],
  );

  /**
   * For the "preview this order's bill later" flow (e.g. from the Orders
   * table, after completion) — always regenerates a fresh blob rather than
   * opening the stored `pdfUrl` directly, so the preview modal's iframe/
   * download/print all work from one same-origin `blob:` URL with no
   * cross-origin restrictions to fight (same reasoning as the logo proxy).
   *
   * `layoutOverride` is the layout-switcher's on-the-fly choice — omit for
   * the effective (business/global/system default) layout.
   */
  const previewBill = useCallback(
    async (
      order: Order,
      layoutOverride?: LayoutConfig,
    ): Promise<{ invoice: Invoice; blob: Blob }> => {
      const invoice = await invoiceService.generateInvoice(order.id);
      const blob = await buildBillBlob(order, invoice, layoutOverride);
      return { invoice, blob };
    },
    [],
  );

  return { ensureBillUploaded, previewBill };
}

export { billFilename };
