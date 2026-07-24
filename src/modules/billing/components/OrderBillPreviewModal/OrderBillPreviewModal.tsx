import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import { Button, Loader, Modal } from '@/components';
import { describeApiError } from '@/utils/errors';

import { billFilename, useOrderBill } from '../../hooks/useOrderBill';
import type { Order } from '../../types/billing.types';

export interface OrderBillPreviewModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern as `ConfirmDialog`. */
  order: Order | null;
  onClose: () => void;
}

interface ReadyState {
  blobUrl: string;
  filename: string;
}

/**
 * Lets staff pull up a completed order's bill again later — from the Orders
 * table, not just right after completion — with Download/Print/Cancel and
 * nothing else ("I will not do anything for that moment" — no re-send, no
 * edit, just look/print/download). Regenerates the PDF fresh via
 * `useOrderBill`'s `previewBill` rather than fetching whatever's already in
 * S3, so the iframe/download/print below all work off one same-origin
 * `blob:` URL with no cross-origin restrictions to fight.
 */
export function OrderBillPreviewModal({ order, onClose }: OrderBillPreviewModalProps) {
  const { previewBill } = useOrderBill();
  const [state, setState] = useState<ReadyState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!order) {
      setState(null);
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    previewBill(order)
      .then(({ invoice, blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ blobUrl: objectUrl, filename: billFilename(invoice) });
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(describeApiError(error));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [order, previewBill]);

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
      description={order ? `${order.orderNumber ?? `Token #${order.tokenNumber}`} · ${order.customerName || 'Walk-in'}` : undefined}
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
