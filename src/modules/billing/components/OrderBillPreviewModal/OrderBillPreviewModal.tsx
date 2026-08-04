import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import { Button, Loader, Modal, Select, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useEffectiveLayout } from '@/modules/documentLayouts';
import type { Invoice } from '@/modules/reports/types/reports.types';
import { useInvoiceSettings } from '@/modules/settings';

import { billFilename, useOrderBill } from '../../hooks/useOrderBill';
import { invoiceService } from '../../services/invoiceService';
import type { Order } from '../../types/billing.types';

import { useMutation } from '@tanstack/react-query';

export interface OrderBillPreviewModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern as `ConfirmDialog`. */
  order: Order | null;
  onClose: () => void;
}

interface ReadyState {
  blobUrl: string;
  filename: string;
  invoice: Invoice;
}

/** Sentinel `<Select>` value for "no per-invoice pin — follow the business's current default". */
const FOLLOW_BUSINESS_DEFAULT_VALUE = '__follow_business_default__';

/**
 * Lets staff pull up a completed order's bill again later — from the Orders
 * table, not just right after completion — with Download/Print/Cancel, and
 * a "Layout" picker (A4 invoice or Thermal Bill, whichever this business's
 * `InvoiceSettings.paperWidth` renders as). Unlike a plain preview switcher,
 * picking a layout here is *permanent*: it calls `invoiceService
 * .setInvoiceLayout` to pin `Invoice.layoutTemplateId` before regenerating,
 * so every future view/print/download/WhatsApp-send of this exact invoice
 * uses the picked layout too — not just this one look (`useOrderBill.ts`'s
 * `buildBillBlob` reads that same pin on both the A4 and thermal paths).
 * "Follow business default" unpins it back to `LayoutResolutionService
 * .resolve_effective`'s usual chain. Regenerates the PDF fresh via
 * `useOrderBill`'s `previewBill` rather than fetching whatever's already in
 * S3, so the iframe/download/print below all work off one same-origin
 * `blob:` URL with no cross-origin restrictions to fight.
 */
export function OrderBillPreviewModal({ order, onClose }: OrderBillPreviewModalProps) {
  const { previewBill } = useOrderBill();
  const { showToast } = useToast();
  const [state, setState] = useState<ReadyState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Which doc type's layout system applies depends entirely on this
  // business's own paper width — `undefined` (no resolve call at all) until
  // that's actually known, so this never briefly assumes the wrong one.
  const invoiceSettingsQuery = useInvoiceSettings(order?.businessId);
  const paperWidth = invoiceSettingsQuery.data?.paperWidth;
  const documentType = paperWidth ? (paperWidth === 'a4' ? 'invoice' : 'thermal_bill') : undefined;
  const effectiveQuery = useEffectiveLayout({
    businessId: order?.businessId,
    documentType,
  });

  const loadPreview = useCallback(
    (subject: Order) => {
      let cancelled = false;
      let objectUrl: string | null = null;

      previewBill(subject)
        .then(({ invoice, blob }) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setState({ blobUrl: objectUrl, filename: billFilename(invoice), invoice });
        })
        .catch((error) => {
          if (cancelled) return;
          setErrorMessage(describeApiError(error));
        });

      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    },
    [previewBill],
  );

  useEffect(() => {
    if (!order) {
      setState(null);
      setErrorMessage(null);
      return;
    }
    return loadPreview(order);
    // `loadPreview` intentionally excluded — it's stable per `previewBill`
    // (itself stable), and including it here would be redundant with the
    // `order` dependency that actually drives re-fetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const setLayoutMutation = useMutation({
    mutationFn: ({
      invoiceId,
      layoutTemplateId,
    }: {
      invoiceId: string;
      layoutTemplateId: string | null;
    }) => invoiceService.setInvoiceLayout(invoiceId, layoutTemplateId),
    onSuccess: () => {
      showToast({ tone: 'success', message: 'Saved as this invoice’s layout.' });
      if (order) loadPreview(order);
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  // A pending order's "invoice" is `previewBill`'s never-persisted draft
  // (see `useOrderBill.ts` — `invoiceNumber: 'DRAFT'`, `id` a fresh
  // in-memory UUID with no matching database row). Permanently pinning a
  // layout to it via `setInvoiceLayout` would 404 against that id, so the
  // picker only makes sense once a real invoice exists — the printed
  // preview itself already shows "DRAFT" on the Bill No line either way.
  const isDraft = state?.invoice.invoiceNumber === 'DRAFT';

  const effective = effectiveQuery.data;
  const layoutValue = state
    ? (state.invoice.layoutTemplateId ?? FOLLOW_BUSINESS_DEFAULT_VALUE)
    : undefined;
  const layoutOptions =
    effective && !isDraft
      ? [
          {
            value: FOLLOW_BUSINESS_DEFAULT_VALUE,
            label: `Follow business default${effective.layout ? ` (${effective.layout.name})` : ''}`,
          },
          ...effective.alternatives.map((alternative) => ({
            value: alternative.id,
            label: `${alternative.name}${alternative.isGlobal ? ' (Global)' : ''}`,
          })),
        ]
      : [];

  function handleLayoutChange(next: string) {
    if (!state || next === layoutValue) return;
    setLayoutMutation.mutate({
      invoiceId: state.invoice.id,
      layoutTemplateId: next === FOLLOW_BUSINESS_DEFAULT_VALUE ? null : next,
    });
  }

  function handleDownload() {
    if (!state) return;
    const link = document.createElement('a');
    link.href = state.blobUrl;
    link.download = state.filename;
    link.click();
  }

  function handlePrint() {
    if (!state) return;
    // Prints the already-embedded iframe directly rather than
    // `window.open(...).print()` — a new-tab `window.open` call is exactly
    // the kind of thing popup blockers can silently swallow even from a
    // real click, and there's no need for a new window at all: the iframe's
    // `blob:` URL is same-origin (this app created it), so
    // `contentWindow.print()` triggers the browser's native print dialog
    // for that PDF directly, no popup involved.
    const contentWindow = iframeRef.current?.contentWindow;
    if (contentWindow) {
      contentWindow.print();
    } else {
      window.open(state.blobUrl, '_blank');
    }
  }

  return (
    <Modal
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Bill preview"
      description={
        order
          ? `${order.orderNumber ?? `Token #${order.tokenNumber}`} · ${order.customerName || 'Walk-in'}`
          : undefined
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            leadingIcon={<Printer size={16} />}
            disabled={!state}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button leadingIcon={<Download size={16} />} disabled={!state} onClick={handleDownload}>
            Download
          </Button>
        </>
      }
    >
      {layoutOptions.length > 0 ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <span className="text-xs font-semibold text-ink-soft">Layout</span>
          <Select
            className="h-9 w-64"
            options={layoutOptions}
            value={layoutValue}
            onChange={handleLayoutChange}
            disabled={setLayoutMutation.isPending}
          />
        </div>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : state ? (
        <iframe
          ref={iframeRef}
          title="Bill preview"
          src={state.blobUrl}
          className="h-[70vh] w-full rounded-control border border-border"
        />
      ) : (
        <Loader label="Preparing bill…" />
      )}
    </Modal>
  );
}
