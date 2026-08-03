import { useCallback } from 'react';

import { useAuthStore } from '@/modules/auth';
import type { BusinessEntity, Location } from '@/modules/businesses';
import { businessesService } from '@/modules/businesses';
import type { LayoutConfig } from '@/modules/documentLayouts';
import { settingsService } from '@/modules/settings';

import { purchasingService } from '../services/purchasingService';
import type { PurchaseOrder } from '../types/purchasing.types';
import { buildPurchaseOrderPdf } from '../utils/purchaseOrderPdf';

import { useQueryClient } from '@tanstack/react-query';

function purchaseOrderPdfFilename(purchaseOrder: PurchaseOrder): string {
  return `${(purchaseOrder.purchaseNumber ?? purchaseOrder.id).replace(/\//g, '-')}.pdf`;
}

/**
 * Best-effort business/location/supplier lookup for the PO document's
 * header. `businessesService.listBusinesses`/`listLocations` are both
 * `IsTenantAdmin`-gated server-side (same constraint `NewOrderPage` already
 * documents) — a manager viewing this page can't resolve either, so this
 * skips the request entirely for them rather than firing a request that's
 * always going to 403. `purchasingService.getSupplier` is manager-accessible,
 * but still wrapped the same way in case the supplier record was since
 * deleted. Any failure just means the document renders with the purchase
 * order's own already-snapshotted fields (`locationName`/`supplierName`/
 * `supplierGstin`/…) and nothing extra — never a blocked/broken preview.
 */
async function fetchBillContext(purchaseOrder: PurchaseOrder): Promise<{
  business: BusinessEntity | null;
  location: Location | null;
  supplier: Awaited<ReturnType<typeof purchasingService.getSupplier>> | null;
}> {
  const isTenantAdmin = useAuthStore.getState().user?.role === 'tenant_admin';

  const [business, location, supplier] = await Promise.all([
    isTenantAdmin
      ? businessesService
          .listBusinesses()
          .then((list) => list.find((item) => item.id === purchaseOrder.businessId) ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    isTenantAdmin
      ? businessesService
          .listLocations()
          .then((list) => list.find((item) => item.id === purchaseOrder.locationId) ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    purchasingService.getSupplier(purchaseOrder.supplierId).catch(() => null),
  ]);

  return { business, location, supplier };
}

/**
 * Renders the PO document fresh from the purchase order + the business's
 * one shared invoice-settings logo — there's no separate "purchasing
 * settings logo" (per the explicit product decision to reuse the same logo
 * uploaded under Settings > Invoices for both sales bills and PO documents).
 *
 * `layoutOverride` — `PurchaseOrderBillPreviewModal`'s layout-switcher
 * choice — passes straight through to `buildPurchaseOrderPdf`; omitted, it
 * resolves the effective layout itself.
 */
async function buildBillBlob(
  purchaseOrder: PurchaseOrder,
  layoutOverride?: LayoutConfig,
): Promise<Blob> {
  const invoiceSettings = await settingsService.getInvoiceSettings(purchaseOrder.businessId);
  const logoBlob = invoiceSettings.logoUrl
    ? await settingsService.getInvoiceLogoBlob(purchaseOrder.businessId).catch(() => null)
    : null;
  const { business, location, supplier } = await fetchBillContext(purchaseOrder);
  return buildPurchaseOrderPdf({
    purchaseOrder,
    invoiceSettings,
    logoBlob,
    business,
    location,
    supplier,
    layoutOverride,
  });
}

/**
 * Mirrors `useOrderBill`'s `previewBill`/`ensureBillUploaded` split, adapted
 * for purchase orders: there's no separate numbered "invoice" record to
 * generate first — a `PurchaseOrder` already carries its own
 * `purchaseNumber` from creation — so `previewBill` renders straight off the
 * order, no generate step.
 */
export function usePurchaseOrderBill() {
  const queryClient = useQueryClient();

  /**
   * Always regenerates a fresh blob — same reasoning as
   * `useOrderBill.previewBill` (one same-origin `blob:` URL for the
   * iframe/print/download, current settings/logo rather than whatever was
   * in effect when a stored PDF was last uploaded). `layoutOverride` is the
   * layout-switcher's on-the-fly choice — omit for the effective
   * (business/global/system default) layout.
   */
  const previewBill = useCallback(
    async (
      purchaseOrder: PurchaseOrder,
      layoutOverride?: LayoutConfig,
    ): Promise<{ blob: Blob }> => {
      const blob = await buildBillBlob(purchaseOrder, layoutOverride);
      return { blob };
    },
    [],
  );

  /**
   * Idempotent on `pdfUrl` — unlike a sales invoice (only generated once an
   * order completes), a PO document is meaningful the moment the purchase
   * order exists (it's the document you'd send TO the supplier), so this is
   * safe to fire right after the first preview builds successfully,
   * regardless of `status`.
   */
  const ensurePdfUploaded = useCallback(
    async (purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> => {
      if (purchaseOrder.pdfUrl) return purchaseOrder;
      const blob = await buildBillBlob(purchaseOrder);
      const file = new File([blob], purchaseOrderPdfFilename(purchaseOrder), {
        type: 'application/pdf',
      });
      const uploaded = await purchasingService.uploadPurchaseOrderPdf(purchaseOrder.id, file);
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'purchase-orders'] });
      return uploaded;
    },
    [queryClient],
  );

  return { previewBill, ensurePdfUploaded };
}

export { purchaseOrderPdfFilename };
