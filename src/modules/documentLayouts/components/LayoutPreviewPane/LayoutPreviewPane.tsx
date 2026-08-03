import { useEffect, useRef, useState } from 'react';

import { Loader, Tabs } from '@/components';
import { describeApiError } from '@/utils/errors';

import type { A4DocType } from '../../pdf/blockRenderers/types';
import { buildDocumentPdf } from '../../pdf/buildDocumentPdf';
import type { LayoutConfig } from '../../types/documentLayouts.types';
import { SAMPLE_RENDER_CONTEXTS } from '../../utils/sampleDocumentData';

export interface LayoutPreviewPaneProps {
  config: LayoutConfig;
  documentTypes: A4DocType[];
}

const PREVIEW_DEBOUNCE_MS = 400;

const DOC_TYPE_LABELS: Record<A4DocType, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  purchase_order: 'Purchase Order',
};

/** Settles on `value` only after it's stayed unchanged for `delayMs` — dragging a block across slots re-renders `config` on every intermediate frame, but the PDF only needs to be rebuilt once the drag settles. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Live PDF preview of the in-progress `config` — calls `buildDocumentPdf`
 * with fixture data (`sampleDocumentData.ts`) rather than a real document,
 * since the layout being edited may not even be saved yet, and shows the
 * result in an `<iframe src={URL.createObjectURL(blob)}>`, same blob-url
 * pattern `OrderBillPreviewModal.tsx` uses (including revoking the previous
 * URL once a new one takes its place, and on unmount).
 *
 * When the layout supports more than one document type, a small tab strip
 * lets the user switch which fixture renders — the same `config` drives all
 * three, so this is the fastest way to confirm e.g. `PARTY_DETAILS` really
 * does auto-adapt its heading ("Bill To" / "Quoted to" / "Supplier") per
 * doc type.
 */
export function LayoutPreviewPane({ config, documentTypes }: LayoutPreviewPaneProps) {
  const [activeDocType, setActiveDocType] = useState<A4DocType>(documentTypes[0] ?? 'invoice');

  useEffect(() => {
    if (documentTypes.length > 0 && !documentTypes.includes(activeDocType)) {
      setActiveDocType(documentTypes[0]);
    }
  }, [documentTypes, activeDocType]);

  const debouncedConfig = useDebouncedValue(config, PREVIEW_DEBOUNCE_MS);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (documentTypes.length === 0) return;
    let cancelled = false;
    setIsRendering(true);
    setErrorMessage(null);

    const context = SAMPLE_RENDER_CONTEXTS[activeDocType];
    buildDocumentPdf({ docType: activeDocType, config: debouncedConfig, context })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(describeApiError(error));
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedConfig, activeDocType, documentTypes]);

  // Unmount-only cleanup for whichever blob URL is current at that point —
  // the effect above already revokes every *earlier* URL itself once a
  // fresher one replaces it.
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    };
  }, []);

  if (documentTypes.length === 0) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-control border border-dashed border-border text-center text-sm text-ink-faint">
        Pick at least one document type above to preview this layout.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documentTypes.length > 1 ? (
        <Tabs
          value={activeDocType}
          onValueChange={(value) => setActiveDocType(value as A4DocType)}
          items={documentTypes.map((docType) => ({
            value: docType,
            label: DOC_TYPE_LABELS[docType],
            content: null,
          }))}
        />
      ) : null}

      <div className="relative h-[70vh] w-full overflow-hidden rounded-control border border-border">
        {errorMessage ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-danger">
            {errorMessage}
          </div>
        ) : blobUrl ? (
          <iframe title="Layout preview" src={blobUrl} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader label="Rendering preview…" />
          </div>
        )}
        {isRendering && blobUrl ? (
          <div className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-1 text-[10px] font-semibold text-white">
            Updating…
          </div>
        ) : null}
      </div>
    </div>
  );
}
