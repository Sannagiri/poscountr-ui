import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import { Button, Loader, Modal } from '@/components';
import { describeApiError } from '@/utils/errors';

import { INVENTORY_QUERY_KEYS } from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types/inventory.types';
import { buildBarcodeLabelPdf } from '../../utils/barcodeLabelPdf';

import { useQueryClient } from '@tanstack/react-query';

export interface BarcodeLabelPreviewModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern as `OrderBillPreviewModal`. */
  product: Product | null;
  onClose: () => void;
}

interface ReadyState {
  blobUrl: string;
  filename: string;
}

/**
 * "Print label" from the products table. If the product has no barcode yet,
 * generates one on demand first (`inventoryService.generateBarcode` —
 * idempotent, so re-opening this on the same product never reassigns it),
 * then renders it as a small 50mm x 25mm label PDF and previews it the same
 * iframe-print way `OrderBillPreviewModal` already does for bills.
 */
export function BarcodeLabelPreviewModal({ product, onClose }: BarcodeLabelPreviewModalProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReadyState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!product) {
      setState(null);
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        let ready = product;
        if (!ready.barcode) {
          ready = await inventoryService.generateBarcode(product.id);
          queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
        }
        if (cancelled) return;
        const blob = buildBarcodeLabelPdf(ready);
        objectUrl = URL.createObjectURL(blob);
        setState({ blobUrl: objectUrl, filename: `${ready.sku || ready.barcode}-label.pdf` });
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(describeApiError(error));
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [product, queryClient]);

  function handleDownload() {
    if (!state) return;
    const link = document.createElement('a');
    link.href = state.blobUrl;
    link.download = state.filename;
    link.click();
  }

  function handlePrint() {
    if (!state) return;
    // Same reasoning as `OrderBillPreviewModal.handlePrint` — the iframe's
    // `blob:` URL is same-origin, so `contentWindow.print()` triggers the
    // native print dialog directly with no popup-blocker risk.
    const contentWindow = iframeRef.current?.contentWindow;
    if (contentWindow) {
      contentWindow.print();
    } else {
      window.open(state.blobUrl, '_blank');
    }
  }

  return (
    <Modal
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Barcode label"
      description={product ? product.name : undefined}
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
          title="Barcode label preview"
          src={state.blobUrl}
          className="h-[40vh] w-full rounded-control border border-border"
        />
      ) : (
        <Loader label="Preparing label…" />
      )}
    </Modal>
  );
}
