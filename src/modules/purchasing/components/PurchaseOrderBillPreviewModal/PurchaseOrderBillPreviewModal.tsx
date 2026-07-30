import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import { Button, Loader, Modal } from '@/components';
import { describeApiError } from '@/utils/errors';

import { purchaseOrderPdfFilename, usePurchaseOrderBill } from '../../hooks/usePurchaseOrderBill';
import type { PurchaseOrder } from '../../types/purchasing.types';

export interface PurchaseOrderBillPreviewModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern `OrderBillPreviewModal` already uses. */
  purchaseOrder: PurchaseOrder | null;
  onClose: () => void;
}

interface ReadyState {
  blobUrl: string;
  filename: string;
}

/**
 * Structurally identical to `OrderBillPreviewModal` — same iframe/blob-url/
 * Print/Download shape — rendering the formal A4 "PURCHASE ORDER" document
 * instead of a thermal bill. Available regardless of the purchase order's
 * `status`: unlike a sales invoice (only generated once an order completes),
 * a PO document is the thing you'd send TO the supplier, useful even before
 * completion.
 *
 * The first successful build also (fire-and-forget) makes sure the PDF
 * exists in S3 via `ensurePdfUploaded` — not gated on status, mirroring
 * `OrderDetailPage`'s "make sure the bill exists in S3" call but triggered
 * from here instead, since a PO document has no single "just completed"
 * moment to hang that call off of.
 */
export function PurchaseOrderBillPreviewModal({ purchaseOrder, onClose }: PurchaseOrderBillPreviewModalProps) {
  const { previewBill, ensurePdfUploaded } = usePurchaseOrderBill();
  const [state, setState] = useState<ReadyState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!purchaseOrder) {
      setState(null);
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    previewBill(purchaseOrder)
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ blobUrl: objectUrl, filename: purchaseOrderPdfFilename(purchaseOrder) });
        // Doesn't affect this preview either way (already built and shown
        // above from the fresh blob) — just makes sure a copy lands in S3
        // for later reprints, same as `OrderDetailPage`'s equivalent call.
        ensurePdfUploaded(purchaseOrder).catch(() => {
          /* best-effort — a failed background upload isn't worth interrupting the preview over */
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(describeApiError(error));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [purchaseOrder, previewBill, ensurePdfUploaded]);

  function handleDownload() {
    if (!state) return;
    const link = document.createElement('a');
    link.href = state.blobUrl;
    link.download = state.filename;
    link.click();
  }

  function handlePrint() {
    if (!state) return;
    // Same popup-blocker-avoidance reasoning as `OrderBillPreviewModal`: print
    // the already-embedded same-origin iframe directly rather than opening a
    // new tab.
    const contentWindow = iframeRef.current?.contentWindow;
    if (contentWindow) {
      contentWindow.print();
    } else {
      window.open(state.blobUrl, '_blank');
    }
  }

  return (
    <Modal
      open={Boolean(purchaseOrder)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Purchase order preview"
      description={
        purchaseOrder ? `${purchaseOrder.purchaseNumber ?? 'Purchase order'} · ${purchaseOrder.supplierName}` : undefined
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
      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : state ? (
        <iframe
          ref={iframeRef}
          title="Purchase order preview"
          src={state.blobUrl}
          className="h-[70vh] w-full rounded-control border border-border"
        />
      ) : (
        <Loader label="Preparing purchase order…" />
      )}
    </Modal>
  );
}
