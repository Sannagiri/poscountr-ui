import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import { Button, Loader, Modal, Select } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useLayoutSwitcher } from '@/modules/documentLayouts';

import { quotationPdfFilename, useQuotationBill } from '../../hooks/useQuotationBill';
import type { Quotation } from '../../types/quotation.types';

export interface QuotationBillPreviewModalProps {
  /** `null` closes the modal — same "controlled by whether there's a subject" pattern `PurchaseOrderBillPreviewModal`/`OrderBillPreviewModal` already use. */
  quotation: Quotation | null;
  onClose: () => void;
}

interface ReadyState {
  blobUrl: string;
  filename: string;
}

/**
 * Structurally identical to `PurchaseOrderBillPreviewModal` — same iframe/
 * blob-url/Print/Download shape — rendering the formal A4 "QUOTATION"
 * document instead. Available regardless of the quotation's `status`: it's
 * the offer you'd send TO the customer, useful the moment it exists.
 *
 * The first successful build also (fire-and-forget) makes sure the PDF
 * exists in S3 via `ensurePdfUploaded`.
 */
export function QuotationBillPreviewModal({ quotation, onClose }: QuotationBillPreviewModalProps) {
  const { previewBill, ensurePdfUploaded } = useQuotationBill();
  const [state, setState] = useState<ReadyState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Unlike a sales bill (which may render as a thermal receipt), a
  // quotation only ever has the formal A4 document — no paper-width branch
  // to gate on, the switcher is always relevant here.
  const switcher = useLayoutSwitcher(
    { businessId: quotation?.businessId, documentType: quotation ? 'quotation' : undefined },
    quotation?.id,
  );

  useEffect(() => {
    if (!quotation) {
      setState(null);
      setErrorMessage(null);
      return;
    }
    // Wait for a just-picked alternative's full config before regenerating
    // — otherwise the preview would flash back to the effective default for
    // one render while `useLayoutTemplate` is still in flight.
    if (switcher.isPending) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    previewBill(quotation, switcher.layoutConfig)
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ blobUrl: objectUrl, filename: quotationPdfFilename(quotation) });
        // `ensurePdfUploaded` never receives `layoutOverride` — persistence
        // always uses the effective layout, regardless of what the switcher
        // is currently previewing (see its own doc comment).
        ensurePdfUploaded(quotation).catch(() => {
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
  }, [quotation, previewBill, ensurePdfUploaded, switcher.layoutConfig, switcher.isPending]);

  function handleDownload() {
    if (!state) return;
    const link = document.createElement('a');
    link.href = state.blobUrl;
    link.download = state.filename;
    link.click();
  }

  function handlePrint() {
    if (!state) return;
    const contentWindow = iframeRef.current?.contentWindow;
    if (contentWindow) {
      contentWindow.print();
    } else {
      window.open(state.blobUrl, '_blank');
    }
  }

  return (
    <Modal
      open={Boolean(quotation)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Quotation preview"
      description={
        quotation
          ? `${quotation.quotationNumber ?? 'Quotation'} · ${quotation.customerName}`
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
      {switcher.options && switcher.options.length > 0 ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <span className="text-xs font-semibold text-ink-soft">Layout</span>
          <Select
            className="h-9 w-56"
            options={switcher.options}
            value={switcher.value}
            onChange={switcher.onChange}
          />
        </div>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : state ? (
        <iframe
          ref={iframeRef}
          title="Quotation preview"
          src={state.blobUrl}
          className="h-[70vh] w-full rounded-control border border-border"
        />
      ) : (
        <Loader label="Preparing quotation…" />
      )}
    </Modal>
  );
}
